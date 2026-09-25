// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { App } from '../src/app';
import { application, ready, profileFile } from './store-helpers';
import { FakeDevice, FakeHID, fixture } from './helpers';
import { msg } from '../src/i18n/core';
import { browserLocale, localeStorageKey, saveBrowserLocale } from '../src/i18n/preferences';

// jsdom has no layout/scrolling; Radix uses this when focusing a select item.
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  window.localStorage.removeItem(localeStorageKey);
});

async function chooseEnglish() {
  fireEvent.keyDown(screen.getByRole('combobox', { name: '语言' }), { key: 'ArrowDown' });
  const option = await screen.findByRole('option', { name: 'English' });
  fireEvent.keyDown(option, { key: 'Enter' });
}

test('the language control changes the UI and remembers the choice on reload', async () => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-CN']);
  const { store, actions } = application(null, undefined, {
    locale: browserLocale(),
    onLocaleChange: saveBrowserLocale,
  });
  const view = render(<App store={store} notices={[msg('environment.unsupported')]} />);
  await act(() => actions.start());
  await chooseEnglish();
  expect(screen.getByRole('button', { name: 'Connect keyboard' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Write to keyboard' })).toBeDisabled();
  expect(screen.getByText('USB is unavailable in this environment')).toBeInTheDocument();
  expect(screen.getByText(/This browser does not support WebHID/)).toBeInTheDocument();
  expect(document.documentElement.lang).toBe('en');
  expect(document.title).toBe('NIZ — Keyboard configurator');
  expect(window.localStorage.getItem(localeStorageKey)).toBe('en');
  view.unmount();
  const reloaded = application(null, undefined, { locale: browserLocale() });
  render(<App store={reloaded.store} />);
  expect(screen.getByRole('combobox', { name: 'Language' })).toHaveTextContent('English');
  expect(screen.getByRole('button', { name: 'Offline demo' })).toBeInTheDocument();
});
test('English editing uses translated names and preserves unsaved input when returning to Chinese', async () => {
  const { store, actions } = application(null, undefined, { locale: 'en' });
  render(<App store={store} />);
  const profile = fixture(9);
  profile.setDefinition(0, { type: 0, keys: [68, 58] });
  await act(() => actions.importFile(profileFile(profile)));
  expect(screen.getByLabelText(/Key sequence/)).toHaveValue('Left Command\nC');
  expect(screen.getByRole('button', { name: /Normal, key 1 Esc, Left Command \+ C/ })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Key sequence/), { target: { value: 'Left Shift\nA' } });
  await act(async () => {
    actions.setLocale('zh-CN');
  });
  expect(screen.getByLabelText(/按键序列/)).toHaveValue('Left Shift\nA');
  fireEvent.click(screen.getByRole('button', { name: '保存此键修改' }));
  expect(store.getState().profile?.definition(0).keys).toEqual([55, 43]);
  expect(screen.getByRole('button', { name: /第 1 键 Esc，左 Shift \+ A，已修改/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '写入键盘' })).toBeDisabled();
});
test('help, validation errors and close controls are translated', async () => {
  const { store, actions } = application(null, undefined, { locale: 'en' });
  render(<App store={store} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open help' }));
  let dialog = screen.getByRole('dialog', { name: 'Help' });
  expect(within(dialog).getByText(/Extended groups are preserved/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  await act(() => actions.demo());
  fireEvent.change(screen.getByLabelText(/Key sequence/), { target: { value: 'unrecognized-key' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save key changes' }));
  dialog = screen.getByRole('dialog', { name: 'Operation unsuccessful' });
  expect(within(dialog).getByText(/Unknown key “unrecognized-key”/)).toBeInTheDocument();
  await act(async () => {
    actions.setLocale('zh-CN');
  });
  expect(screen.getByRole('dialog', { name: '操作未完成' })).toHaveTextContent('无法识别按键');
  expect(screen.getByRole('button', { name: '知道了' })).toBeInTheDocument();
});
test('connection details, read history and historic backup reasons follow the selected language', async () => {
  const device = new FakeDevice(fixture(9)),
    hid = new FakeHID([device]);
  const { store, actions } = application(hid);
  render(<App store={store} usbAvailable />);
  await act(async () => {
    await actions.start();
    await ready(store);
  });
  const sent = device.sent.slice();
  await chooseEnglish();
  expect(screen.getByText(/Connected · ATOM66 fixture/)).toBeInTheDocument();
  expect(screen.getByText(/Automatic read complete: 9 groups, 594 records/)).toBeInTheDocument();
  expect(device.sent).toEqual(sent);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Local backups/ }));
  });
  const dialog = screen.getByRole('dialog', { name: 'Local backups' });
  expect(within(dialog).getByText(/Automatic read backup ·/)).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Import' })).toBeInTheDocument();
  expect(device.sent).toEqual(sent);
});
