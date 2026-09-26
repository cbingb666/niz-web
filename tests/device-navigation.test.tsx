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

test('the authorization step can open the picker when a keyboard is already connected', async () => {
  const device = new FakeDevice(), hid = new FakeHID([device]);
  const { store, actions } = application(hid);
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  openGuide();
  confirmCable();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /连接(另一台)?键盘/ })); });
  expect(hid.requestCount).toBe(1);
});

test('the guide adds another ATOM66 and both cards configure and disconnect their own device', async () => {
  const first = new FakeDevice(), second = new FakeDevice(), hid = new FakeHID([first]);
  second.profile.setDefinition(0, { type: 0, keys: [44] });
  const { store, actions, session } = application(hid);
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  const firstId = session.activeDeviceId;
  openGuide();
  confirmCable();
  hid.selection = [];
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '连接另一台键盘' })); });
  expect(first.opened).toBe(true);
  expect(screen.queryByRole('button', { name: '下一步' })).not.toBeInTheDocument();
  hid.selection = [second];
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '连接另一台键盘' })); });
  expect(screen.getByRole('status')).toHaveTextContent('已连接 · ATOM66 · 设备 2');
  expect(first.opened && second.opened).toBe(true);
  expect(session.activeDeviceId).toBe(firstId);
  expect(first.sent.map(packet => packet[1])).toEqual([0xf9]);
  expect(second.sent.map(packet => packet[1])).toEqual([0xf9]);
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  fireEvent.click(screen.getByRole('button', { name: '完成，查看设备' }));
  expect(screen.getAllByRole('article')).toHaveLength(2);
  const secondCard = screen.getByRole('article', { name: 'ATOM66 · 设备 2' });
  fireEvent.click(within(secondCard).getByRole('button', { name: '配置设备' }));
  await act(() => acceptRead(store));
  expect(store.getState().profile!.summary(0)).toBe('S');
  fireEvent.click(screen.getByRole('button', { name: '设备管理' }));
  fireEvent.click(within(screen.getByRole('article', { name: 'ATOM66 · 设备 1' })).getByRole('button', { name: '配置设备' }));
  await act(() => acceptRead(store));
  expect(store.getState().profile!.summary(0)).toBe('Esc');
  fireEvent.click(screen.getByRole('button', { name: '设备管理' }));
  await act(async () => {
    fireEvent.click(within(screen.getByRole('article', { name: 'ATOM66 · 设备 2' })).getByRole('button', { name: '断开' }));
  });
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(first.opened).toBe(true);
  expect(second.opened).toBe(false);
  expect(session.activeDeviceId).toBe(firstId);
});

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

test('every guide step requires a click, and configuration is read only after choosing Configure device', async () => {
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
    await vi.waitFor(() => expect(store.getState().session.connected).toBe(true));
  });
  expect(device.sent.map(packet => packet[1])).toEqual([0xf9]);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '授权浏览器访问' })).toBeVisible();
  expect(screen.queryByRole('button', { name: '完成，查看设备' })).not.toBeInTheDocument();
  expect(store.getState().profile).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  expect(screen.getByRole('heading', { name: '键盘已连接' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: '上一步' }));
  expect(screen.getByRole('heading', { name: '授权浏览器访问' })).toHaveFocus();
  expect(hid.requestDevice).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  fireEvent.click(screen.getByRole('button', { name: '完成，查看设备' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  const card = screen.getByRole('article', { name: 'ATOM66' });
  expect(card).toHaveTextContent(device.profile.version);
  expect(card).toHaveTextContent('尚未读取配置');
  expect(device.sent.map(packet => packet[1])).toEqual([0xf9]);
  await openDeviceEditor();
  expect(screen.getByRole('alertdialog', { name: '确认读取键盘配置' })).toBeVisible();
  await act(() => acceptRead(store));
  expect(screen.getByRole('region', { name: '按键布局' })).toBeVisible();
  expect(store.getState().source).toBe('read');
  const sent = device.sent.slice();
  fireEvent.click(screen.getByRole('button', { name: '设备管理' }));
  await openDeviceEditor();
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

test('a disconnect at the last step requires reconnecting and never enables Finish', async () => {
  const device = new FakeDevice(), hid = new FakeHID([device]);
  const { store, actions } = application(hid);
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  openGuide();
  expect(screen.getByRole('heading', { name: '连接 USB 数据线' })).toBeVisible();
  confirmCable();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '连接另一台键盘' })); });
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  await act(async () => { hid.disconnect(device); await ready(store); });
  expect(screen.getByRole('heading', { name: '键盘已断开' })).toHaveFocus();
  expect(screen.queryByRole('button', { name: '完成，查看设备' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '返回连接步骤' }));
  expect(screen.getByRole('heading', { name: '授权浏览器访问' })).toHaveFocus();
  expect(screen.getByRole('button', { name: '连接键盘' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '返回设备管理' }));
  expect(screen.queryByRole('article', { name: 'ATOM66' })).not.toBeInTheDocument();
  expect(store.getState().profile).toBeNull();
});

test('configuring a connected device cannot silently replace a demo with drafts', async () => {
  const device = new FakeDevice();
  const { store, actions } = application(new FakeHID([device]));
  await actions.demo();
  actions.assignKey(58);
  actions.updateForm({ view: 'advanced', sequence: 'unfinished macro' });
  const profile = store.getState().profile!.toJSON();
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
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
