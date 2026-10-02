// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from '../src/app';
import { atom68 } from '../src/devices/atom68/model';
import { translate } from '../src/i18n/core';
import { FakeHID } from './helpers';
import { application } from './store-helpers';

afterEach(cleanup);

function chooseModel(name: string) {
  fireEvent.click(screen.getByRole('radio', { name }));
}

test.each([
  { locale: 'zh-CN', page: 'devices' },
  { locale: 'en', page: 'devices' },
  { locale: 'zh-CN', page: 'connect' },
  { locale: 'en', page: 'connect' },
] as const)('$locale $page demo entry selects ATOM68 without authorizing or reading USB', async ({ locale, page }) => {
  const hid = new FakeHID();
  const { store, actions, download } = application(hid, undefined, { locale });
  render(<App store={store} />);
  await act(() => actions.start());
  if (page === 'connect') await act(() => actions.navigate('connect'));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: translate(locale, 'keyboard.demo') })); });
  expect(store.getState().page).toBe('demo');
  expect(screen.getByRole('heading', { name: translate(locale, 'demo.title') })).toHaveFocus();
  expect(screen.getByRole('radio', { name: 'ATOM66' })).toBeChecked();
  expect(screen.getAllByRole('radio').map(option => option.getAttribute('value'))).toEqual(['atom66', 'atom68', 'micro82', 'micro84']);
  expect(screen.queryByRole('combobox', { name: translate(locale, 'keyboard.demoModel') })).not.toBeInTheDocument();
  chooseModel('ATOM68');
  expect(store.getState().profile).toBeNull();
  expect(store.getState().page).toBe('demo');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: translate(locale, 'demo.start') })); });
  expect(store.getState().model).toBe(atom68);
  expect(store.getState().source).toBe('demo');
  expect(store.getState().canWrite).toBe(false);
  expect(store.getState().profile?.records).toHaveLength(204);
  expect(store.getState().profile?.lights).toHaveLength(204);
  expect(screen.getAllByRole('button', { name: /(?:第 \d+ 键|key \d+,)/ })).toHaveLength(204);
  actions.exportProfile();
  expect(download).toHaveBeenCalledWith(translate(locale, 'download.profile'), expect.objectContaining({ format: 'niz-web', model: 'atom68' }));
  expect(hid.requestCount).toBe(0);
  expect(hid.devices).toEqual([]);
});

test('model selection survives a language switch and replacing a demo requires confirmation for edits and drafts', async () => {
  const { store, actions } = application();
  await actions.demo();
  actions.assignKey(58);
  actions.selectKey(1);
  actions.updateForm({ view: 'advanced', sequence: 'unfinished macro' });
  const before = store.getState();
  render(<App store={store} />);
  await act(async () => {
    const returning = actions.navigate('devices');
    actions.confirm(true);
    await returning;
  });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '离线演示' })); });
  chooseModel('ATOM68');
  await act(() => actions.setLocale('en'));
  expect(screen.getByRole('radio', { name: 'ATOM68' })).toBeChecked();
  expect(store.getState().profile?.toJSON()).toEqual(before.profile?.toJSON());
  expect(store.getState().drafts).toEqual(before.drafts);
  fireEvent.click(screen.getByRole('button', { name: 'Start demo' }));
  const confirmation = screen.getByRole('alertdialog');
  expect(confirmation.querySelector('img')).toBeNull();
  expect(screen.getByDisplayValue('atom68')).toBeDisabled();
  await act(async () => { fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' })); });
  expect(store.getState().model.id).toBe('atom66');
  expect(store.getState().profile?.toJSON()).toEqual(before.profile?.toJSON());
  expect(store.getState().drafts).toEqual(before.drafts);
  expect(store.getState().canUndo).toBe(true);
  expect(screen.getByRole('radio', { name: 'ATOM68' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Start demo' }));
  await act(async () => { fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Replace editor contents' })); });
  expect(store.getState().model).toBe(atom68);
  expect(store.getState().draftIndices).toEqual([]);
  expect(store.getState().canUndo).toBe(false);
});

test('returning to the demo entry defaults to the currently loaded model and can start ATOM66 again', async () => {
  const { store, actions } = application();
  await actions.demo('atom68');
  render(<App store={store} />);
  await act(() => actions.navigate('devices'));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '离线演示' })); });
  expect(screen.getByRole('radio', { name: 'ATOM68' })).toBeChecked();
  chooseModel('ATOM66');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '开始演示' })); });
  expect(store.getState().model.id).toBe('atom66');
  expect(store.getState().profile?.toJSON().format).toBe('atom66-macos');
  expect(screen.getAllByRole('button', { name: /第 \d+ 键/ })).toHaveLength(198);
});

test('the selected demo model stays shared between entry pages without replacing the current configuration', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '离线演示' })); });
  chooseModel('ATOM68');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '返回设备管理' })); });
  await act(() => actions.navigate('connect'));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '离线演示' })); });
  expect(screen.getByRole('radio', { name: 'ATOM68' })).toBeChecked();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '返回连接引导' })); });
  expect(store.getState().page).toBe('connect');
  expect(store.getState().profile).toBeNull();
});

test('returning from the demo picker preserves the connection guide step and focuses its heading', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.navigate('connect'));
  fireEvent.click(screen.getByRole('checkbox', { name: '我的型号在列表中' }));
  fireEvent.click(screen.getByRole('button', { name: '确认型号，下一步' }));
  expect(screen.getByRole('heading', { name: '连接 USB 数据线' })).toBeVisible();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '离线演示' })); });
  expect(screen.getByRole('heading', { name: '选择演示键盘' })).toHaveFocus();
  expect(screen.queryByRole('heading', { name: '连接 USB 数据线' })).not.toBeInTheDocument();
  chooseModel('ATOM68');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '返回连接引导' })); });
  expect(screen.getByRole('heading', { name: '连接 USB 数据线' })).toHaveFocus();
  expect(store.getState().demoModelId).toBe('atom68');
});
