// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from '../src/app';
import { chooseMappingType, confirmSupportedModel, openDeviceEditor } from './page-helpers';
import { application, acceptRead, memoryBackups, profileFile } from './store-helpers';
import { FakeDevice, FakeHID, fixture } from './helpers';
import { msg, renderMessage, translate, type Locale } from '../src/i18n/core';
import { ProtocolError } from '../src/protocol';

afterEach(cleanup);

test.each<Locale>(['zh-CN', 'en'])('offline editing keeps drafts visible and connects from the footer in %s', async locale => {
  const { store, actions } = application(null, undefined, { locale });
  const view = render(<App store={store} />);
  await act(() => actions.demo());
  const footer = within(view.container.querySelector<HTMLElement>('.commit-bar')!);
  expect(view.container.querySelector('.connection-bar')).toBeNull();
  await chooseMappingType(translate(locale, 'mapping.advanced'));
  fireEvent.change(screen.getByLabelText(new RegExp(translate(locale, 'editor.sequence'))), { target: { value: 'unfinished' } });
  const editor = screen.getByRole('complementary', { name: translate(locale, 'editor.section') });
  expect(within(editor).getByText(translate(locale, 'mapping.draft'))).toBeVisible();
  expect(footer.queryByText(translate(locale, 'mapping.finishDrafts'))).not.toBeInTheDocument();
  expect(footer.getByRole('button', { name: translate(locale, 'keyboard.export') })).toBeDisabled();
  fireEvent.click(footer.getByRole('button', { name: translate(locale, 'guide.title') }));
  expect(store.getState().page).toBe('connect');
  expect(store.getState().draftIndices).toEqual([0]);
  await act(() => actions.navigate('editor'));
  expect(screen.getByLabelText(new RegExp(translate(locale, 'editor.sequence')))).toHaveValue('unfinished');
});

test('backup failure details remain available in Activity after footer status text is removed', async () => {
  const device = new FakeDevice();
  const backups = memoryBackups();
  const error = msg('error.storageTransaction');
  vi.mocked(backups.save).mockRejectedValueOnce(new ProtocolError(error));
  const { store, actions } = application(new FakeHID([device]), backups);
  const view = render(<App store={store} usbAvailable />);
  await act(async () => { await actions.start(); await acceptRead(store); });
  await openDeviceEditor();
  const footer = within(view.container.querySelector<HTMLElement>('.commit-bar')!);
  const status = msg('status.readReady', { backup: msg('status.backupFailed') });
  expect(footer.queryByText(renderMessage(status))).not.toBeInTheDocument();
  fireEvent.click(footer.getByRole('button', { name: '操作记录' }));
  expect(within(screen.getByRole('dialog', { name: '操作记录' })).getByText(renderMessage(error))).toBeVisible();
  act(() => actions.setLocale('en'));
  expect(within(screen.getByRole('dialog', { name: 'Activity' })).getByText(renderMessage(error, 'en'))).toBeVisible();
});

test('activity opens from the workbench footer, handles an empty session and keeps diagnostic export read-only', async () => {
  const device = new FakeDevice();
  const { store, actions, download } = application(new FakeHID([device]));
  store.setState({ page: 'editor' });
  const view = render(<App store={store} usbAvailable />);
  const header = within(view.container.querySelector<HTMLElement>('.app-header')!);
  const footer = within(view.container.querySelector<HTMLElement>('.commit-bar')!);
  const trigger = footer.getByRole('button', { name: '操作记录' });
  expect(header.queryByRole('button', { name: '操作记录' })).not.toBeInTheDocument();
  expect(within(screen.getByRole('main')).queryByText('操作记录')).not.toBeInTheDocument();
  fireEvent.click(trigger);
  const empty = screen.getByRole('dialog', { name: '操作记录' });
  expect(empty).toHaveTextContent('暂无操作记录。');
  expect(within(empty).queryByRole('button', { name: '导出读取诊断' })).not.toBeInTheDocument();
  await act(async () => { fireEvent.click(within(empty).getByRole('button', { name: '关闭' })); });
  await vi.waitFor(() => expect(trigger).toHaveFocus());
  await act(async () => { await actions.start(); await acceptRead(store); });
  const sent = device.sent.slice();
  fireEvent.click(trigger);
  const log = screen.getByRole('dialog', { name: '操作记录' });
  expect(within(log).getAllByRole('listitem').length).toBeGreaterThan(0);
  fireEvent.click(within(log).getByRole('button', { name: '导出读取诊断' }));
  expect(download).toHaveBeenCalledOnce();
  expect(device.sent).toEqual(sent);
  await act(async () => { fireEvent.keyDown(log, { key: 'Escape' }); });
  expect(screen.queryByRole('dialog', { name: '操作记录' })).not.toBeInTheDocument();
  await vi.waitFor(() => expect(trigger).toHaveFocus());
});

test('the header shows the device breadcrumb and disconnecting from the footer returns to Devices', async () => {
  const device = new FakeDevice();
  const { store, actions } = application(new FakeHID([device]));
  const view = render(<App store={store} usbAvailable />);
  const initialHeader = view.container.querySelector('.app-header')!.textContent;
  expect(screen.queryByRole('navigation', { name: '页面导航' })).not.toBeInTheDocument();
  await act(async () => { await actions.start(); await acceptRead(store); await actions.configureDevice(); });
  const header = within(view.container.querySelector<HTMLElement>('.app-header')!);
  const footer = within(view.container.querySelector<HTMLElement>('.commit-bar')!);
  expect(header.getByRole('navigation', { name: '页面导航' })).toHaveTextContent('设备管理ATOM66 fixture');
  expect(header.getByText('ATOM66 fixture')).toHaveAttribute('aria-current', 'page');
  expect(header.queryByRole('button', { name: '已连接 · ATOM66 fixture' })).not.toBeInTheDocument();
  expect(header.queryByRole('button', { name: '断开' })).not.toBeInTheDocument();
  expect(header.queryByRole('button', { name: '配置工作台' })).not.toBeInTheDocument();
  const details = footer.getByRole('button', { name: '已连接 · ATOM66 fixture' });
  expect(details).toHaveTextContent('ATOM66');
  expect(details).not.toHaveTextContent(device.profile.version);
  expect(view.container.querySelector('.connection-bar')).toBeNull();
  expect(footer.getByRole('button', { name: '断开' })).toBeEnabled();
  const sent = device.sent.slice();
  fireEvent.click(details);
  const dialog = screen.getByRole('dialog', { name: '设备详情' });
  expect(dialog).toHaveTextContent(device.productName);
  expect(dialog).toHaveTextContent(device.profile.version);
  expect(dialog).toHaveTextContent('已读取配置');
  expect(within(dialog).queryByRole('button', { name: '断开' })).not.toBeInTheDocument();
  expect(device.sent).toEqual(sent);
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: '关闭' })); });
  await vi.waitFor(() => expect(details).toHaveFocus());
  await act(async () => { fireEvent.click(footer.getByRole('button', { name: '断开' })); });
  const disconnectConfirmation = screen.getByRole('alertdialog', { name: '断开 ATOM66 fixture？' });
  expect(within(disconnectConfirmation).getByRole('button', { name: '取消' })).toHaveFocus();
  expect(device.opened).toBe(true);
  await act(async () => { fireEvent.click(within(disconnectConfirmation).getByRole('button', { name: '断开' })); });
  expect(store.getState().session.connected).toBe(false);
  expect(footer.queryByRole('button', { name: '断开' })).not.toBeInTheDocument();
  expect(view.container.querySelector('.commit-bar')).toBeNull();
  expect(screen.getByRole('heading', { name: '连接键盘' })).toBeVisible();
  expect(view.container.querySelector('.app-header')!.textContent).toBe(initialHeader);
  expect(screen.queryByRole('navigation', { name: '页面导航' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '连接设备' })).toBeEnabled();
});

test('keyboard and mapping panes can receive keyboard focus after selecting another key', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.demo());
  const keyboard = screen.getByRole('region', { name: '按键布局' });
  act(() => keyboard.focus());
  expect(keyboard).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: /^普通层，第 2 键，/ }));
  const editor = screen.getByRole('complementary', { name: '选中按键设置' });
  act(() => editor.focus());
  expect(editor).toHaveFocus();
  expect(store.getState().key).toBe(1);
});

test('switching keys resets editor scrolling while preserving the previous draft', async () => {
  const { store, actions } = application();
  const view = render(<App store={store} />);
  await act(() => actions.demo());
  await chooseMappingType('宏 / 高级');
  fireEvent.change(screen.getByLabelText(/按键序列/), { target: { value: 'unfinished' } });
  const content = view.container.querySelector<HTMLElement>('.inspector-content')!;
  content.scrollTop = 200;
  fireEvent.click(screen.getByRole('button', { name: /^普通层，第 2 键，/ }));
  expect(view.container.querySelector<HTMLElement>('.inspector-content')!.scrollTop).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: /^普通层，第 1 键，/ }));
  expect(screen.getByLabelText(/按键序列/)).toHaveValue('unfinished');
});

test('the separate changes sidebar lists every change, jumps to a mapping and stays collapsed while editing', async () => {
  const { store, actions } = application();
  const view = render(<App store={store} />);
  await act(() => actions.demo());
  const sidebar = screen.getByRole('complementary', { name: '待写入改动' });
  expect(sidebar).toHaveTextContent('选择键位和目标功能后，改动会显示在这里。');
  expect(within(screen.getByRole('region', { name: '按键布局' })).queryByText('待写入改动')).not.toBeInTheDocument();
  act(() => {
    for (let key = 0; key < 6; key++) {
      actions.selectKey(key, 0);
      actions.assignKey(58);
    }
  });
  expect(within(sidebar).getByLabelText('6 项待写入改动')).toBeInTheDocument();
  fireEvent.click(within(sidebar).getByRole('button', { name: /普通层 · 键位 #1 / }));
  expect(store.getState()).toMatchObject({ key: 0, layer: 0 });
  expect(within(sidebar).getByRole('button', { name: /普通层 · 键位 #6 / })).toBeInTheDocument();
  const collapse = within(sidebar).getByRole('button', { name: '收起改动侧栏' });
  fireEvent.click(collapse);
  expect(collapse).toHaveAttribute('aria-expanded', 'false');
  expect(document.getElementById(collapse.getAttribute('aria-controls')!)).not.toBeVisible();
  expect(within(sidebar).queryByRole('button', { name: /普通层 · 键位/ })).not.toBeInTheDocument();
  expect(view.container.querySelector('.app-shell')).toHaveAttribute('data-changes-collapsed', 'true');
  act(() => { actions.selectKey(6, 0); actions.assignKey(58); });
  expect(sidebar).not.toBeVisible();
  const expand = screen.getByRole('button', { name: '展开改动侧栏' });
  expect(within(expand).getByLabelText('7 项待写入改动')).toBeVisible();
  expect(expand).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(expand);
  expect(within(sidebar).getByRole('button', { name: /普通层 · 键位 #7 / })).toHaveAttribute('aria-current', 'true');
});

test('compact desktop keeps changes in a drawer and returns to the selected mapping', async () => {
  vi.stubGlobal('matchMedia', vi.fn(query => ({ matches: query.includes('1599'), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  try {
    const { store, actions } = application();
    render(<App store={store} />);
    await act(() => actions.demo());
    act(() => { actions.selectKey(1, 0); actions.assignKey(58); actions.selectKey(0, 0); });
    expect(screen.queryByRole('complementary', { name: '待写入改动' })).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: '展开改动侧栏' });
    expect(trigger).toHaveTextContent('待写入改动');
    expect(within(trigger).getByLabelText('1 项待写入改动')).toBeInTheDocument();
    fireEvent.click(trigger);
    const drawer = screen.getByRole('dialog', { name: '待写入改动' });
    await act(async () => { fireEvent.click(within(drawer).getByRole('button', { name: /普通层 · 键位 #2 / })); });
    expect(store.getState()).toMatchObject({ key: 1, layer: 0 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await vi.waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.getByRole('complementary', { name: '选中按键设置' })).toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole('dialog', { name: '待写入改动' })).getByRole('button', { name: '查看全部改动' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog')).toHaveTextContent('载入时');
  } finally {
    cleanup();
    vi.unstubAllGlobals();
  }
});

test('narrow screens open an editor drawer, preserve edits, restore key focus and reopen the same key', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  try {
    const { store, actions } = application();
    render(<App store={store} />);
    await act(() => actions.demo());
    expect(screen.queryByRole('complementary', { name: '选中按键设置' })).not.toBeInTheDocument();
    const key = screen.getByRole('button', { name: /^普通层，第 2 键，/ });
    fireEvent.click(key);
    const drawer = screen.getByRole('dialog', { name: '选中按键设置' });
    fireEvent.click(within(drawer).getByRole('button', { name: 'C' }));
    expect(store.getState().profile!.definition(1).keys).toEqual([58]);
    await chooseMappingType('宏 / 高级');
    fireEvent.change(screen.getByLabelText(/按键序列/), { target: { value: 'unfinished' } });
    await act(async () => { fireEvent.click(within(drawer).getByRole('button', { name: '关闭' })); });
    expect(screen.queryByRole('dialog', { name: '选中按键设置' })).not.toBeInTheDocument();
    await vi.waitFor(() => expect(key).toHaveFocus());
    fireEvent.click(key);
    expect(screen.getByRole('dialog', { name: '选中按键设置' })).toBeInTheDocument();
    expect(screen.getByLabelText(/按键序列/)).toHaveValue('unfinished');
    await act(async () => { fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  } finally {
    cleanup();
    vi.unstubAllGlobals();
  }
});

test('the workbench footer owns configuration tools and removed editor hints stay absent', async () => {
  const { store, download } = application();
  store.setState({ page: 'editor' });
  const view = render(<App store={store} />);
  const header = within(view.container.querySelector<HTMLElement>('.app-header')!);
  const footer = within(view.container.querySelector<HTMLElement>('.commit-bar')!);
  const hints = ['点击即暂存，可连续修改其他键位。', '读取键盘或导入配置后，即可编辑此键。'];
  for (const hint of hints) expect(screen.queryByText(hint)).not.toBeInTheDocument();
  for (const name of ['导入配置', '导出配置', /本地备份/]) {
    expect(footer.getByRole('button', { name })).toBeInTheDocument();
    expect(header.queryByRole('button', { name })).not.toBeInTheDocument();
  }
  expect(header.queryByRole('button', { name: '离线演示' })).not.toBeInTheDocument();
  expect(footer.getByRole('button', { name: '导出配置' })).toBeDisabled();
  const input = screen.getByLabelText<HTMLInputElement>('导入配置文件');
  const pickFile = vi.spyOn(input, 'click');
  fireEvent.click(footer.getByRole('button', { name: '导入配置' }));
  expect(pickFile).toHaveBeenCalledOnce();
  await act(async () => {
    fireEvent.change(input, { target: { files: [profileFile(fixture())] } });
    await vi.waitFor(() => expect(store.getState().source).toBe('import'));
  });
  fireEvent.click(footer.getByRole('button', { name: '导出配置' }));
  expect(download).toHaveBeenCalledWith('配置', store.getState().profile!.toJSON());
  const panel = within(view.container.querySelector<HTMLElement>('.keyboard-panel')!);
  for (const name of ['导入配置', '导出配置', /本地备份/, '离线演示']) {
    expect(panel.queryByRole('button', { name })).not.toBeInTheDocument();
  }
  for (const hint of hints) expect(screen.queryByText(hint)).not.toBeInTheDocument();
  await act(async () => { fireEvent.click(footer.getByRole('button', { name: /本地备份/ })); });
  const backups = await screen.findByRole('dialog', { name: '本地备份' });
  fireEvent.click(within(backups).getByRole('button', { name: '关闭' }));
  await chooseMappingType('宏 / 高级');
  fireEvent.change(screen.getByLabelText(/按键序列/), { target: { value: 'A' } });
  expect(footer.getByRole('button', { name: '导出配置' })).toBeDisabled();
});

test('React boots on Devices without WebHID and the guide opens a usable offline editor', async () => {
  const { store, actions } = application();
  render(<App store={store} notices={['当前浏览器不支持 WebHID。']} />);
  await act(() => actions.start());
  expect(screen.getByRole('heading', { name: '连接键盘' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: '按键布局' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '连接设备' }));
  confirmSupportedModel();
  fireEvent.click(screen.getByRole('button', { name: '已连接数据线，下一步' }));
  expect(screen.getByRole('button', { name: '连接键盘' })).toBeDisabled();
  expect(screen.getByText('当前环境无法连接 USB')).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '离线演示' })); });
  expect(screen.getByRole('button', { name: '核对并写入' })).toBeDisabled();
  expect(screen.getAllByRole('button', { name: /第 \d+ 键/ })).toHaveLength(198);
  expect(screen.getByText('当前浏览器不支持 WebHID。')).toBeInTheDocument();
});
test('demo editing, Fn key surfaces and reset update the React UI through Zustand', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.start());
  fireEvent.click(screen.getByRole('button', { name: '连接设备' }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '离线演示' }));
  });
  await chooseMappingType('快捷键');
  fireEvent.click(screen.getByRole('checkbox', { name: 'L Cmd' }));
  fireEvent.click(screen.getByRole('button', { name: 'C' }));
  fireEvent.click(screen.getByRole('button', { name: '使用此快捷键' }));
  expect(screen.getByRole('button', { name: /普通层，第 1 键，L Cmd \+ C，已修改/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '核对并写入' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /^右 Fn，第 1 键，/ }));
  expect(screen.getByRole('button', { name: /^右 Fn，第 1 键，/ })).toHaveAttribute('aria-pressed', 'true');
  expect(store.getState().form.sequence).toBe('');
  fireEvent.click(screen.getByRole('button', { name: /^普通层，第 1 键，/ }));
  expect(store.getState().form.sequence).toBe('L Cmd\nC');
  fireEvent.click(screen.getByRole('button', { name: '还原' }));
  expect(store.getState().form.sequence).toBe('Esc');
});
test('physical keyboard supports arrow selection and exposes counters', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.demo());
  const first = screen.getByRole('button', { name: /普通层，第 1 键，/ });
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(screen.getByRole('button', { name: /普通层，第 2 键，/ })).toHaveFocus();
  expect(store.getState().key).toBe(1);
  fireEvent.click(screen.getByRole('checkbox', { name: '显示计数' }));
  expect(store.getState().showCounts).toBe(true);
});
test('StrictMode does not duplicate HID connections, listeners or automatic reads', async () => {
  const device = new FakeDevice();
  const hid = new FakeHID([device]);
  const { store, actions } = application(hid);
  render(
    <StrictMode>
      <App store={store} usbAvailable />
    </StrictMode>,
  );
  await act(async () => {
    await actions.start();
    await acceptRead(store);
    await actions.configureDevice();
  });
  expect(device.openCount).toBe(1);
  expect(device.sent.filter((packet) => packet[1] === 0xf2)).toHaveLength(1);
  expect(screen.getByRole('button', { name: '已连接 · ATOM66 fixture' })).toBeInTheDocument();
});
test('shadcn confirmation dialog cancels a replacement and retains unsaved input', async () => {
  const { store, actions } = application();
  render(<App store={store} />);
  await act(() => actions.demo());
  await chooseMappingType('宏 / 高级');
  fireEvent.change(screen.getByLabelText(/按键序列/), { target: { value: 'A' } });
  fireEvent.click(screen.getByRole('button', { name: '设备连接引导' }));
  fireEvent.click(screen.getByRole('button', { name: '离线演示' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByRole('button', { name: '取消' })).toHaveFocus();
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));
  });
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '配置工作台' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '设备管理' }));
  fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
  expect(screen.getByLabelText(/按键序列/)).toHaveValue('A');
});
test('help uses a labelled dialog and can be dismissed', () => {
  const { store } = application();
  render(<App store={store} />);
  fireEvent.click(screen.getByRole('button', { name: '打开使用说明' }));
  const dialog = screen.getByRole('dialog', { name: '使用说明' });
  expect(within(dialog).getByText(/扩展组记录完整保留/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
