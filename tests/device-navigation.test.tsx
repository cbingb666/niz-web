// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from '../src/app';
import { FakeDevice, FakeHID } from './helpers';
import { acceptRead, application, ready } from './store-helpers';
import { confirmSupportedModel, openDeviceEditor } from './page-helpers';
import { translate } from '../src/i18n/core';
import type { ConfigDevice } from '../src/types/hid';

afterEach(cleanup);

function openGuide() {
  fireEvent.click(screen.getByRole('button', { name: '连接设备' }));
  confirmSupportedModel();
}
function confirmCable() {
  fireEvent.click(screen.getByRole('button', { name: '已连接数据线，下一步' }));
}

test.each(['zh-CN', 'en'] as const)('%s empty devices page has a single connection entry that opens the model check', async locale => {
  const hid = new FakeHID();
  const { store, actions } = application(hid, undefined, { locale });
  const view = render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  const buttons = screen.getAllByRole('button', { name: translate(locale, 'devices.add') });
  expect(buttons).toHaveLength(1);
  const empty = view.container.querySelector('.devices-empty')!;
  expect(empty).toContainElement(buttons[0]);
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
  expect(screen.getByRole('heading', { name: translate(locale, 'devices.emptyTitle') })).toBeVisible();
  expect(screen.queryByRole('heading', { name: translate(locale, 'devices.connected') })).not.toBeInTheDocument();
  expect(view.container.querySelector('.device-page-heading button')).toBeNull();
  expect(empty.querySelector('img')).toBeNull();
  expect(within(empty as HTMLElement).getByRole('figure', { name: translate(locale, 'guide.cableIllustration') })).toBeVisible();
  fireEvent.click(buttons[0]);
  const heading = screen.getByRole('heading', { name: translate(locale, 'guide.supportTitle') });
  expect(screen.getAllByRole('heading', { level: 2 })).toEqual([heading]);
  expect(heading).toHaveFocus();
  expect(heading).toHaveAccessibleDescription(translate(locale, 'guide.step', { current: 1, total: 4 }));
  const help = screen.getByText(translate(locale, 'guide.modelHelp'), { selector: 'summary' });
  expect(help.closest('details')).not.toHaveAttribute('open');
  expect(screen.getByText(translate(locale, 'guide.unsupportedModel'))).not.toBeVisible();
  fireEvent.click(help);
  expect(screen.getByText(translate(locale, 'guide.unsupportedModel'))).toBeVisible();
  const nameplate = screen.getByRole('figure', { name: translate(locale, 'guide.nameplateIllustration') });
  expect(nameplate).toHaveTextContent('ATOM66');
  expect(nameplate).toHaveTextContent(translate(locale, 'guide.nameplateCaption'));
  expect(nameplate.querySelector('img')).toBeNull();
  expect(hid.requestCount).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: translate(locale, 'devices.back') }));
  expect(screen.getByRole('heading', { name: translate(locale, 'devices.emptyTitle') })).toHaveFocus();
});

test('the authorization step can open the picker when a keyboard is already connected', async () => {
  const device = new FakeDevice(), hid = new FakeHID([device]);
  const { store, actions } = application(hid);
  const view = render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  expect(view.container.querySelector('.device-page-heading')).toContainElement(screen.getByRole('button', { name: '连接设备' }));
  expect(view.container.querySelector('.devices-empty')).toBeNull();
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
  expect(screen.getByRole('status')).toHaveTextContent('已连接 · ATOM66 fixture · 设备 2');
  expect(first.opened && second.opened).toBe(true);
  expect(session.activeDeviceId).toBe(firstId);
  expect(first.sent.map(packet => packet[1])).toEqual([0xf9]);
  expect(second.sent.map(packet => packet[1])).toEqual([0xf9]);
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  fireEvent.click(screen.getByRole('button', { name: '查看设备' }));
  expect(screen.getAllByRole('article')).toHaveLength(2);
  const secondCard = screen.getByRole('article', { name: 'ATOM66 fixture · 设备 2' });
  fireEvent.click(within(secondCard).getByRole('button', { name: '配置设备' }));
  await act(() => acceptRead(store));
  expect(store.getState().profile!.summary(0)).toBe('S');
  fireEvent.click(screen.getByRole('button', { name: '设备管理' }));
  fireEvent.click(within(screen.getByRole('article', { name: 'ATOM66 fixture · 设备 1' })).getByRole('button', { name: '配置设备' }));
  await act(() => acceptRead(store));
  expect(store.getState().profile!.summary(0)).toBe('Esc');
  fireEvent.click(screen.getByRole('button', { name: '设备管理' }));
  await act(async () => {
    fireEvent.click(within(screen.getByRole('article', { name: 'ATOM66 fixture · 设备 2' })).getByRole('button', { name: '断开' }));
  });
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(first.opened).toBe(true);
  expect(second.opened).toBe(false);
  expect(session.activeDeviceId).toBe(firstId);
});

test('different device names and USB IDs identify their own cards and workbench details', async () => {
  const first = new FakeDevice(), second = new FakeDevice(), hid = new FakeHID([first]);
  first.productName = '66EC-XRGB';
  first.productId = 0x502a;
  second.productName = '66EC-S';
  second.productId = 0x512a;
  const { store, actions } = application(hid);
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  openGuide();
  confirmCable();
  hid.selection = [second];
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '连接另一台键盘' })); });
  expect(screen.getByRole('status')).toHaveTextContent('已连接 · 66EC-S');
  expect(screen.getByRole('status')).not.toHaveTextContent('设备 2');
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  fireEvent.click(screen.getByRole('button', { name: '查看设备' }));
  const firstCard = screen.getByRole('article', { name: '66EC-XRGB' });
  expect(firstCard).toHaveTextContent('0x0483');
  expect(firstCard).toHaveTextContent('0x502A');
  expect(firstCard).not.toHaveTextContent('0x512A');
  const secondCard = screen.getByRole('article', { name: '66EC-S' });
  expect(secondCard).toHaveTextContent('0x0483');
  expect(secondCard).toHaveTextContent('0x512A');
  expect(secondCard).not.toHaveTextContent('0x502A');
  fireEvent.click(within(secondCard).getByRole('button', { name: '配置设备' }));
  await act(() => acceptRead(store));
  expect(screen.getByRole('button', { name: '已连接 · 66EC-S' })).toBeVisible();
  expect(within(screen.getByRole('navigation', { name: '页面导航' })).getByText('66EC-S')).toHaveAttribute('aria-current', 'page');
  const sent = second.sent.slice();
  fireEvent.click(screen.getByRole('button', { name: '已连接 · 66EC-S' }));
  const details = screen.getByRole('dialog', { name: '设备详情' });
  expect(within(details).getByText('厂商 ID').nextElementSibling).toHaveTextContent('0x0483');
  expect(within(details).getByText('产品 ID').nextElementSibling).toHaveTextContent('0x512A');
  expect(details).not.toHaveTextContent('0x502A');
  act(() => actions.setLocale('en'));
  expect(within(details).getByText('Vendor ID').nextElementSibling).toHaveTextContent('0x0483');
  expect(within(details).getByText('Product ID').nextElementSibling).toHaveTextContent('0x512A');
  expect(second.sent).toEqual(sent);
});

test('the guide requires model confirmation before showing the cable and authorization steps', async () => {
  const hid = new FakeHID();
  const { store, actions } = application(hid);
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  fireEvent.click(screen.getByRole('button', { name: '连接设备' }));
  expect(screen.getByRole('heading', { name: '查看键盘底部的型号' })).toBeVisible();
  expect(within(screen.getByRole('list', { name: '连接步骤' })).getAllByRole('listitem')).toHaveLength(4);
  expect(screen.getByRole('list', { name: '支持的型号' })).toHaveTextContent('ATOM66');
  expect(screen.getByRole('button', { name: '确认型号，下一步' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: '连接键盘' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '已连接数据线，下一步' })).not.toBeInTheDocument();
  confirmSupportedModel();
  expect(screen.getByRole('heading', { name: '连接 USB 数据线' })).toHaveFocus();
  expect(hid.requestCount).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: '上一步' }));
  expect(screen.getByRole('checkbox', { name: '我的型号在列表中' })).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: '我的型号在列表中' }));
  expect(screen.getByRole('button', { name: '确认型号，下一步' })).toBeDisabled();
});

test('the guide presents one step at a time and only its third step can request device access', async () => {
  const hid = new FakeHID();
  const { store, actions } = application(hid);
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  expect(screen.getByRole('heading', { name: '连接键盘' })).toBeVisible();
  expect(screen.getByRole('button', { name: '离线演示' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: '配置设备' })).not.toBeInTheDocument();
  openGuide();
  expect(screen.getByRole('heading', { name: '连接 USB 数据线' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: '在弹窗中选择键盘' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '连接键盘' })).not.toBeInTheDocument();
  expect(within(screen.getByRole('list', { name: '连接步骤' })).queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '离线演示' })).toBeEnabled();
  confirmCable();
  expect(screen.getByRole('heading', { name: '在弹窗中选择键盘' })).toHaveFocus();
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
  expect(screen.queryByRole('button', { name: '查看设备' })).not.toBeInTheDocument();
  await act(async () => {
    select([device]);
    await vi.waitFor(() => expect(store.getState().session.connected).toBe(true));
  });
  expect(device.sent.map(packet => packet[1])).toEqual([0xf9]);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '在弹窗中选择键盘' })).toBeVisible();
  expect(screen.queryByRole('button', { name: '查看设备' })).not.toBeInTheDocument();
  expect(store.getState().profile).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  expect(screen.getByRole('heading', { name: '键盘已连接' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: '上一步' }));
  expect(screen.getByRole('heading', { name: '在弹窗中选择键盘' })).toHaveFocus();
  expect(hid.requestDevice).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  fireEvent.click(screen.getByRole('button', { name: '查看设备' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  const card = screen.getByRole('article', { name: 'ATOM66 fixture' });
  expect(card).toHaveTextContent(device.profile.version);
  expect(card).toHaveTextContent('尚未读取配置');
  expect(device.sent.map(packet => packet[1])).toEqual([0xf9]);
  await openDeviceEditor();
  expect(screen.getByRole('alertdialog', { name: '键盘将暂时锁定' })).toBeVisible();
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
  expect(screen.getByRole('status')).toHaveTextContent('再次点击连接按钮，选择键盘并确认');
  if (outcome === 'error') expect(screen.getByRole('status')).toHaveTextContent('USB permission denied');
  expect(screen.getByRole('heading', { name: '在弹窗中选择键盘' })).toBeVisible();
  expect(screen.getByRole('button', { name: '连接键盘' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: '读取键盘配置' })).not.toBeInTheDocument();
  expect(store.getState().profile).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '上一步' }));
  confirmCable();
  expect(screen.getByRole('status')).toHaveTextContent('再次点击连接按钮，选择键盘并确认');
  const device = new FakeDevice();
  hid.selection = [device];
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '连接键盘' })); });
  expect(screen.getByRole('status')).toHaveTextContent('已连接 · ATOM66 fixture');
  expect(screen.getByRole('status')).not.toHaveTextContent('再次点击连接按钮');
  expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled();
  expect(store.getState().profile).toBeNull();
});

test('a failed reselection keeps the chosen keyboard and shows its retry instructions', async () => {
  const device = new FakeDevice(), hid = new FakeHID();
  const { store, actions } = application(hid);
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  openGuide();
  confirmCable();
  hid.selection = [device];
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '连接键盘' })); });
  hid.selection = [];
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重新选择键盘' })); });
  expect(screen.getByRole('status')).toHaveTextContent('已连接 · ATOM66 fixture');
  expect(screen.getByRole('status')).toHaveTextContent('未选择键盘');
  expect(screen.getByRole('status')).toHaveTextContent('点击「重新选择键盘」重试，或用当前键盘继续');
  expect(device.opened).toBe(true);
  expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  expect(screen.getByRole('heading', { name: '键盘已连接' })).toHaveFocus();
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
  expect(screen.queryByRole('button', { name: '查看设备' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '返回连接步骤' }));
  expect(screen.getByRole('heading', { name: '在弹窗中选择键盘' })).toHaveFocus();
  expect(screen.getByRole('button', { name: '连接键盘' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '返回设备管理' }));
  expect(screen.queryByRole('article', { name: 'ATOM66 fixture' })).not.toBeInTheDocument();
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
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '保留编辑并返回' })); });
  fireEvent.click(screen.getByRole('button', { name: '配置设备' }));
  const confirmation = screen.getByRole('alertdialog', { name: '键盘将暂时锁定' });
  expect(confirmation).toHaveTextContent('未写入的修改会被替换');
  await act(async () => { fireEvent.click(within(confirmation).getByRole('button', { name: '取消' })); });
  expect(store.getState().page).toBe('devices');
  expect(store.getState().profile!.toJSON()).toEqual(profile);
  expect(store.getState().draftIndices).toEqual([0]);
  fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
  expect(screen.getByLabelText(/按键序列/)).toHaveValue('unfinished macro');
  expect(store.getState().canUndo).toBe(true);
});

test.each([
  { entry: '设备管理', edit: 'mapping' },
  { entry: '返回设备管理', edit: 'draft' },
  { entry: '返回设备管理', edit: 'lighting' },
])('$entry confirms leaving with $edit changes and preserves them for resuming', async ({ entry, edit }) => {
  const { store, actions } = application();
  await actions.demo();
  if (edit === 'mapping') actions.assignKey(58);
  else if (edit === 'draft') actions.updateForm({ view: 'advanced', sequence: 'unfinished macro' });
  else { actions.updateForm({ color: '#ff0000' }); actions.applyColor(); }
  const before = store.getState();
  render(<App store={store} />);
  fireEvent.click(screen.getByRole('button', { name: entry }));
  expect(screen.getByRole('alertdialog', { name: '返回设备管理？' })).toHaveTextContent('编辑内容会保留');
  expect(within(screen.getByRole('alertdialog')).queryByRole('img')).not.toBeInTheDocument();
  expect(store.getState().page).toBe('editor');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '取消' })); });
  expect(store.getState().page).toBe('editor');
  fireEvent.click(screen.getByRole('button', { name: entry }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '保留编辑并返回' })); });
  expect(screen.getByRole('heading', { name: '连接键盘' })).toBeVisible();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
  expect(store.getState().page).toBe('editor');
  expect(store.getState().profile!.toJSON()).toEqual(before.profile!.toJSON());
  expect(store.getState().drafts).toEqual(before.drafts);
  expect(store.getState().form).toEqual(before.form);
  expect(store.getState().canUndo).toBe(before.canUndo);
});

test('returning from an unchanged editor needs no confirmation', async () => {
  const { store, actions } = application();
  await actions.demo();
  render(<App store={store} />);
  fireEvent.click(screen.getByRole('button', { name: '返回设备管理' }));
  expect(screen.getByRole('heading', { name: '连接键盘' })).toBeVisible();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});
