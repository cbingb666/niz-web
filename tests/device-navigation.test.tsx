// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from '../src/app';
import { FakeDevice, FakeHID } from './helpers';
import { acceptRead, application, ready } from './store-helpers';
import { openDeviceEditor } from './page-helpers';
import type { ConfigDevice } from '../src/types/hid';

afterEach(cleanup);

function openGuide() {
  fireEvent.click(screen.getByRole('button', { name: '连接设备' }));
}
function confirmCable() {
  fireEvent.click(screen.getByRole('button', { name: '已连接数据线，下一步' }));
}

test('the guide presents one step at a time and only its second step can request device access', async () => {
  const hid = new FakeHID();
  const { store, actions } = application(hid);
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  expect(screen.getByRole('heading', { name: '设备管理' })).toBeVisible();
  expect(screen.queryByRole('button', { name: '离线演示' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '配置设备' })).not.toBeInTheDocument();
  openGuide();
  expect(screen.getByRole('heading', { name: '连接 USB 数据线' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: '授权浏览器访问' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '连接键盘' })).not.toBeInTheDocument();
  expect(within(screen.getByRole('list', { name: '连接步骤' })).queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '离线演示' })).toBeEnabled();
  confirmCable();
  expect(screen.getByRole('heading', { name: '授权浏览器访问' })).toHaveFocus();
  expect(screen.queryByRole('heading', { name: '连接 USB 数据线' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '连接键盘' })).toBeEnabled();
  expect(hid.requestCount).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: '上一步' }));
  expect(screen.getByRole('heading', { name: '连接 USB 数据线' })).toHaveFocus();
  expect(hid.requestCount).toBe(0);
});

test('authorization and a confirmed read gate completion before opening the real device configuration', async () => {
  const device = new FakeDevice(), hid = new FakeHID();
  let select!: (devices: ConfigDevice[]) => void;
  vi.spyOn(hid, 'requestDevice').mockImplementation(() => new Promise(resolve => { select = resolve; }));
  const { store, actions } = application(hid);
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  openGuide();
  confirmCable();
  fireEvent.click(screen.getByRole('button', { name: '连接键盘' }));
  // WebHID must be invoked in the original click to retain user activation.
  expect(hid.requestDevice).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: '上一步' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '离线演示' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: '完成，查看设备' })).not.toBeInTheDocument();
  await act(async () => {
    select([device]);
    await vi.waitFor(() => expect(store.getState().dialog?.kind).toBe('confirm'));
  });
  expect(device.sent.map(packet => packet[1])).toEqual([0xf9]);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '取消' })); });
  expect(screen.getByRole('heading', { name: '读取键盘的当前配置' })).toHaveFocus();
  expect(screen.queryByRole('button', { name: '完成，查看设备' })).not.toBeInTheDocument();
  expect(store.getState().profile).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '读取键盘配置' }));
  await act(() => acceptRead(store));
  expect(screen.getByRole('heading', { name: '一切就绪' })).toHaveFocus();
  const sent = device.sent.slice();
  fireEvent.click(screen.getByRole('button', { name: '完成，查看设备' }));
  const card = screen.getByRole('article', { name: 'ATOM66' });
  expect(card).toHaveTextContent(device.profile.version);
  expect(card).toHaveTextContent('已读取配置');
  await openDeviceEditor();
  expect(screen.getByRole('region', { name: '按键布局' })).toBeVisible();
  expect(store.getState().source).toBe('read');
  expect(device.sent).toEqual(sent);
});

test.each(['cancel', 'error'] as const)('a device picker %s stays on the authorization step and allows retry', async outcome => {
  const hid = new FakeHID();
  if (outcome === 'error') vi.spyOn(hid, 'requestDevice').mockRejectedValueOnce(new Error('USB permission denied'));
  const { store, actions } = application(hid);
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  openGuide();
  confirmCable();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '连接键盘' })); });
  if (outcome === 'error') fireEvent.click(screen.getByRole('button', { name: '知道了' }));
  else expect(screen.getByRole('status')).toHaveTextContent('未选择键盘');
  expect(screen.getByRole('heading', { name: '授权浏览器访问' })).toBeVisible();
  expect(screen.getByRole('button', { name: '连接键盘' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: '读取键盘配置' })).not.toBeInTheDocument();
  expect(store.getState().profile).toBeNull();
});

test('a read failure remains on step three and disconnection returns to authorization with local edits retained', async () => {
  const device = new FakeDevice(), hid = new FakeHID([device]);
  const { store, actions } = application(hid);
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  await act(async () => { actions.confirm(false); });
  openGuide();
  device.readOverride = device.profile.reports.slice(0, 10);
  fireEvent.click(screen.getByRole('button', { name: '读取键盘配置' }));
  await act(async () => {
    actions.confirm(true);
    await vi.waitFor(() => expect(store.getState().dialog?.kind).toBe('message'));
    await ready(store);
  });
  fireEvent.click(screen.getByRole('button', { name: '知道了' }));
  expect(screen.getByRole('heading', { name: '读取键盘的当前配置' })).toBeVisible();
  expect(screen.queryByRole('button', { name: '完成，查看设备' })).not.toBeInTheDocument();
  device.readOverride = undefined;
  fireEvent.click(screen.getByRole('button', { name: '读取键盘配置' }));
  await act(() => acceptRead(store));
  const profile = store.getState().profile!.toJSON();
  await act(async () => { hid.disconnect(device); await ready(store); });
  expect(screen.getByRole('heading', { name: '授权浏览器访问' })).toBeVisible();
  expect(screen.queryByRole('button', { name: '完成，查看设备' })).not.toBeInTheDocument();
  expect(store.getState().profile!.toJSON()).toEqual(profile);
  fireEvent.click(screen.getByRole('button', { name: '返回设备管理' }));
  expect(screen.queryByRole('article', { name: 'ATOM66' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '继续编辑' })).toBeEnabled();
});

test('configuring a connected device cannot silently replace a demo with drafts', async () => {
  const device = new FakeDevice();
  const { store, actions } = application(new FakeHID([device]));
  await actions.demo();
  actions.assignKey(58);
  actions.updateForm({ view: 'advanced', sequence: 'unfinished macro' });
  const profile = store.getState().profile!.toJSON();
  render(<App store={store} usbAvailable />);
  await act(async () => { await actions.start(); await acceptRead(store); });
  fireEvent.click(screen.getByRole('button', { name: '设备管理' }));
  fireEvent.click(screen.getByRole('button', { name: '配置设备' }));
  const confirmation = screen.getByRole('alertdialog', { name: '确认读取键盘配置' });
  expect(confirmation).toHaveTextContent('当前有未写入的修改');
  await act(async () => { fireEvent.click(within(confirmation).getByRole('button', { name: '取消' })); });
  expect(store.getState().page).toBe('devices');
  expect(store.getState().profile!.toJSON()).toEqual(profile);
  expect(store.getState().draftIndices).toEqual([0]);
  fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
  expect(screen.getByLabelText(/按键序列/)).toHaveValue('unfinished macro');
  expect(store.getState().canUndo).toBe(true);
});
