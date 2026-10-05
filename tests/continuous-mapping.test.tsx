// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { App } from '../src/app';
import { translate } from '../src/i18n/core';
import { localizedKeyName } from '../src/i18n/key-names';
import { chooseMappingType } from './page-helpers';
import { acceptRead, application } from './store-helpers';
import { FakeDevice, FakeHID } from './helpers';

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollIntoView ??= () => {};
});
afterAll(() => vi.unstubAllGlobals());
afterEach(cleanup);

test.each(['zh-CN', 'en'] as const)('%s retains filters, searches and both scroll positions when editing another key or layer', async locale => {
  const { store, actions } = application(null, undefined, { locale });
  const view = render(<App store={store} />);
  await act(() => actions.demo());
  const group = translate(locale, 'mapping.group');
  fireEvent.keyDown(screen.getByRole('combobox', { name: group }), { key: 'ArrowDown' });
  fireEvent.keyDown(await screen.findByRole('option', { name: translate(locale, 'mapping.navigation') }), { key: 'Enter' });
  const list = view.container.querySelector<HTMLElement>('.action-options')!;
  const content = view.container.querySelector<HTMLElement>('.inspector-content')!;
  fireEvent.scroll(list, { target: { scrollTop: 120 } });
  fireEvent.scroll(content, { target: { scrollTop: 80 } });
  act(() => { actions.selectKey(1, 1); });
  expect(screen.getByRole('combobox', { name: group })).toHaveTextContent(translate(locale, 'mapping.navigation'));
  expect(view.container.querySelector('.action-options')).not.toBe(list);
  expect(view.container.querySelector('.action-options')!.scrollTop).toBe(120);
  expect(view.container.querySelector('.inspector-content')!.scrollTop).toBe(80);

  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'arrow' } });
  act(() => { actions.selectKey(2, 2); });
  expect(screen.getByRole('searchbox')).toHaveValue('arrow');
  expect(view.container.querySelectorAll('.action-option')).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: translate(locale, 'mapping.clearSearch') }));
  expect(screen.getByRole('combobox', { name: group })).toHaveTextContent(translate(locale, 'mapping.navigation'));
  expect(store.getState().changes).toEqual([]);
  expect(store.getState().hasUnsavedChanges).toBe(false);
});

test('quick choices and shortcut main keys retain separate browsing state while drafts return to their own editor', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.demo());
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'arrow' } });
  await chooseMappingType('快捷键');
  expect(screen.getByRole('searchbox')).toHaveValue('');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'C' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'L Ctrl' }));
  act(() => { actions.selectKey(1); });
  expect(screen.getByRole('combobox', { name: '映射类型' })).toHaveTextContent('快捷键');
  expect(screen.getByRole('searchbox')).toHaveValue('C');
  await chooseMappingType('按键与功能');
  expect(screen.getByRole('searchbox')).toHaveValue('arrow');
  act(() => { actions.selectKey(0); });
  expect(screen.getByRole('combobox', { name: '映射类型' })).toHaveTextContent('快捷键');
  expect(screen.getByRole('checkbox', { name: 'L Ctrl' })).toBeChecked();
  expect(store.getState().draftIndices).toEqual([0]);
  act(() => { actions.selectKey(1); });
  expect(screen.getByRole('combobox', { name: '映射类型' })).toHaveTextContent('按键与功能');
  expect(screen.getByRole('searchbox')).toHaveValue('arrow');
});

test.each(['zh-CN', 'en'] as const)('%s recent actions work outside the current search and cannot overwrite a draft', async locale => {
  const { store, actions } = application(null, undefined, { locale });
  render(<App store={store} />);
  await act(() => actions.demo());
  fireEvent.click(screen.getByRole('button', { name: 'C' }));
  act(() => { actions.selectKey(1); });
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'arrow' } });
  const recent = screen.getByRole('group', { name: translate(locale, 'mapping.recent') });
  fireEvent.click(within(recent).getByRole('button', { name: translate(locale, 'mapping.useRecent', { name: 'C' }) }));
  expect(store.getState().profile!.definition(1).keys).toEqual([58]);
  expect(screen.getByRole('searchbox')).toHaveValue('arrow');
  expect(store.getState().mappingBrowser.recentActions).toEqual([58]);
  act(() => actions.undo());
  expect(store.getState().profile!.definition(1).keys).not.toEqual([58]);
  expect(store.getState().mappingBrowser.recentActions).toEqual([58]);

  await chooseMappingType(translate(locale, 'mapping.advanced'));
  fireEvent.change(screen.getByLabelText(new RegExp(translate(locale, 'editor.sequence'))), { target: { value: 'unfinished' } });
  await chooseMappingType(translate(locale, 'mapping.key'));
  const button = screen.getByRole('button', { name: translate(locale, 'mapping.useRecent', { name: 'C' }) });
  expect(button).toBeDisabled();
  const before = store.getState().profile!.toJSON();
  fireEvent.click(button);
  act(() => actions.assignKey(43));
  expect(store.getState().profile!.toJSON()).toEqual(before);
  expect(store.getState().form.sequence).toBe('unfinished');
  expect(store.getState().mappingBrowser.recentActions).toEqual([58]);
});

test('recent actions keep the six latest distinct successes and update their labels with the language', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.demo());
  act(() => {
    for (const code of [43, 44, 45, 46, 47, 48, 49, 44, 111]) actions.assignKey(code);
  });
  expect(store.getState().mappingBrowser.recentActions).toEqual([111, 44, 49, 48, 47, 46]);
  act(() => actions.assignKey(256)); // Out-of-range codes cannot be staged.
  expect(store.getState().formError).not.toBe('');
  expect(store.getState().mappingBrowser.recentActions).toEqual([111, 44, 49, 48, 47, 46]);
  const recent = screen.getByRole('group', { name: '最近使用' });
  expect(within(recent).getAllByRole('button')).toHaveLength(6);
  expect(within(recent).getAllByRole('button')[0]).toHaveTextContent(localizedKeyName(111, 'zh-CN'));
  act(() => actions.setLocale('en'));
  expect(screen.getByRole('group', { name: 'Recent actions' })).toHaveTextContent(localizedKeyName(111, 'en'));
});

test('each device keeps its own browsing state and recent actions without sending mapping commands', async () => {
  const first = new FakeDevice(), second = new FakeDevice();
  const hid = new FakeHID([first]);
  const { store, actions, session } = application(hid);
  await actions.start();
  await acceptRead(store);
  const firstId = session.activeDeviceId!;
  actions.assignKey(43);
  actions.updateActionPicker('key', { group: 'navigation', query: 'arrow', scrollTop: 90 });
  actions.setMappingScroll('key', 100, { code: 87, offset: 200 });
  const firstBrowser = store.getState().mappingBrowser;
  hid.selection = [second];
  const secondId = (await actions.connect())!;
  expect(store.getState().mappingBrowser).toEqual(firstBrowser);
  const configuring = actions.configureDevice(secondId);
  await acceptRead(store);
  await configuring;
  expect(store.getState().mappingBrowser.recentActions).toEqual([]);
  expect(store.getState().mappingBrowser.pickers.key.query).toBe('');
  actions.assignKey(58);
  actions.updateActionPicker('key', { group: 'media' });
  const secondBrowser = store.getState().mappingBrowser;
  const sent = [first.sent.slice(), second.sent.slice()];
  await actions.configureDevice(firstId);
  expect(store.getState().mappingBrowser).toEqual(firstBrowser);
  await actions.configureDevice(secondId);
  expect(store.getState().mappingBrowser).toEqual(secondBrowser);
  expect(first.sent).toEqual(sent[0]);
  expect(second.sent).toEqual(sent[1]);
});
