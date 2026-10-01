// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from '../src/app';
import { FakeDevice, FakeHID } from './helpers';
import { acceptRead, application, memoryBackups, ready } from './store-helpers';
import { openDeviceEditor } from './page-helpers';
import { translate } from '../src/i18n/core';

afterEach(cleanup);

test.each(['zh-CN', 'en'] as const)('%s read confirmation explains the lock and cancellation sends no commands', async locale => {
  const device = new FakeDevice();
  const { store, actions } = application(new FakeHID([device]), undefined, { locale });
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  const before = device.sent.slice();
  fireEvent.click(screen.getByRole('button', { name: translate(locale, 'devices.configure') }));
  const dialog = screen.getByRole('alertdialog', { name: translate(locale, 'confirm.readTitle') });
  expect(within(dialog).getByRole('img', { name: translate(locale, 'confirm.lockIllustration') })).toBeVisible();
  expect(dialog).toHaveTextContent(translate(locale, 'confirm.readBody'));
  expect(dialog).toHaveAccessibleDescription(new RegExp(translate(locale, 'confirm.readBody').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  expect(within(dialog).getByText(translate(locale, 'operation.keepConnected'), { exact: false })).toBeVisible();
  const cancel = within(dialog).getByRole('button', { name: translate(locale, 'common.cancel') });
  expect(cancel).toHaveFocus();
  await act(async () => { fireEvent.click(cancel); });
  expect(device.sent).toEqual(before);
  expect(store.getState().hardwareOperation).toBeNull();
  expect(store.getState().profile).toBeNull();
});

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

test('Configure device requests consent; confirmation alone opens a global non-dismissible progress overlay', async (t) => {
  const device = new FakeDevice(), backups = memoryBackups(), backupGate = gate();
  t.onTestFinished(backupGate.release);
  const persist = vi.mocked(backups.save).getMockImplementation()!;
  vi.mocked(backups.save).mockImplementationOnce(async (...args) => {
    await backupGate.promise;
    return persist(...args);
  });
  const { store, actions } = application(new FakeHID([device]), backups);
  const view = render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '配置设备' }));
  const confirmation = screen.getByRole('alertdialog', { name: '键盘将暂时锁定' });
  expect(confirmation).not.toHaveTextContent('ATOM66 fixture');
  expect(confirmation).toHaveTextContent('无法输入');
  expect(within(confirmation).getByRole('button', { name: '取消' })).toHaveFocus();
  expect(device.sent.map((packet) => packet[1])).toEqual([0xf9]);
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  await act(async () => { fireEvent.click(within(confirmation).getByRole('button', { name: '取消' })); });
  expect(store.getState().profile).toBeNull();
  expect(device.sent.map((packet) => packet[1])).toEqual([0xf9]);

  fireEvent.click(screen.getByRole('button', { name: '配置设备' }));
  const retry = screen.getByRole('alertdialog', { name: '键盘将暂时锁定' });
  await act(async () => {
    fireEvent.click(within(retry).getByRole('button', { name: '开始读取' }));
    await vi.waitFor(() => expect(backups.save).toHaveBeenCalledOnce());
  });
  const overlay = screen.getByRole('alertdialog', { name: '正在读取配置' });
  expect(overlay).toHaveClass('operation-overlay');
  expect(within(overlay).getByRole('img', { name: translate('zh-CN', 'operation.transferIllustration') })).toBeVisible();
  expect(overlay).toHaveFocus();
  expect(view.container.querySelector('[inert]')).toHaveAttribute('aria-busy', 'true');
  expect(overlay).toHaveTextContent('键盘暂时无法输入');
  expect(overlay).toHaveTextContent('正在保存本地备份');
  expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  expect(within(overlay).queryByRole('list')).not.toBeInTheDocument();
  expect(overlay.querySelector('.operation-progress-fill')).toBeNull();
  expect(overlay.querySelectorAll('.operation-spinner')).toHaveLength(1);
  expect(overlay.querySelector('.operation-count')).toBeNull();
  expect(within(overlay).queryByRole('button')).not.toBeInTheDocument();
  fireEvent.keyDown(overlay, { key: 'Escape' });
  fireEvent.pointerDown(document.body);
  expect(screen.getByRole('alertdialog', { name: '正在读取配置' })).toBeInTheDocument();
  actions.showHelp();
  actions.showActivity();
  actions.showDeviceDetails();
  actions.setLocale('en');
  actions.setShowCounts(true);
  actions.setShowKeyNumbers(true);
  await actions.navigate('connect');
  expect(store.getState().page).toBe('devices');
  expect(store.getState()).toMatchObject({ hardwareOperation: 'read', locale: 'zh-CN', showCounts: false, showKeyNumbers: false });
  await act(async () => {
    backupGate.release();
    await ready(store);
  });
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(view.container.querySelector('[inert]')).toBeNull();
  expect(screen.getByRole('button', { name: '重新读取配置' })).toBeEnabled();
});

test('write progress locks the whole transaction, including backup and read-back verification', async (t) => {
  const device = new FakeDevice(), backups = memoryBackups();
  const { store, actions } = application(new FakeHID([device]), backups);
  const view = render(<App store={store} usbAvailable />);
  await act(async () => { await actions.start(); await acceptRead(store); });
  await openDeviceEditor();
  const backupGate = gate(), writeGate = gate(), readbackGate = gate();
  t.onTestFinished(() => { backupGate.release(); writeGate.release(); readbackGate.release(); });
  const persist = vi.mocked(backups.save).getMockImplementation()!;
  vi.mocked(backups.save).mockImplementationOnce(async (...args) => {
    await backupGate.promise;
    return persist(...args);
  });
  const send = device.sendReport.bind(device);
  let reads = 0, sent = 0;
  vi.spyOn(device, 'sendReport').mockImplementation(async (id, packet) => {
    if (packet[1] === 0xf0 && ++sent === 21) await writeGate.promise;
    if (packet[1] === 0xf2 && ++reads === 2) await readbackGate.promise;
    await send(id, packet);
  });
  await act(() => actions.assignKey(43));
  const before = device.sent.slice();
  fireEvent.click(screen.getByRole('button', { name: '核对并写入' }));
  const confirmation = screen.getByRole('alertdialog', { name: '键盘将暂时锁定' });
  expect(confirmation).toHaveTextContent('无法输入');
  expect(within(confirmation).getByRole('img', { name: translate('zh-CN', 'confirm.lockIllustration') })).toBeVisible();
  expect(within(confirmation).queryByText('实机写入尚未验证。', { exact: false })).not.toBeInTheDocument();
  expect(confirmation.querySelector('.confirmation-review')).not.toHaveAttribute('open');
  expect(within(confirmation).getByRole('table')).not.toBeVisible();
  fireEvent.click(within(confirmation).getByText('查看改动明细', { selector: 'summary' }));
  expect(within(confirmation).getByRole('table')).toBeVisible();
  expect(within(confirmation).getByRole('button', { name: '取消' })).toBeEnabled();
  expect(device.sent).toEqual(before);
  await act(async () => {
    fireEvent.click(within(confirmation).getByRole('button', { name: '开始写入' }));
    await vi.waitFor(() => expect(store.getState().progress?.phase).toBe('backup'));
  });
  expect(screen.getByRole('alertdialog', { name: '正在写入配置' })).toHaveTextContent('正在保存本地备份');
  expect(within(screen.getByRole('alertdialog', { name: '正在写入配置' })).getByRole('img', { name: translate('zh-CN', 'operation.transferIllustration') })).toBeVisible();
  expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  expect(view.container.querySelector('[inert]')).not.toBeNull();
  await act(async () => {
    backupGate.release();
    await vi.waitFor(() => expect(store.getState().progress).toEqual({
      phase: 'write', transfer: { completed: 20, total: 198, unit: 'packets' },
    }));
  });
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(Math.floor(20 / 198 * 100)));
  expect(screen.queryByText('20 / 198 个数据包')).not.toBeInTheDocument();
  expect(screen.queryByText('传输详情')).not.toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '正在发送按键配置…');
  await act(async () => {
    writeGate.release();
    await vi.waitFor(() => expect(store.getState().progress?.phase).toBe('settle'), { timeout: 5_000 });
  });
  expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  expect(screen.getByRole('alertdialog', { name: '正在写入配置' })).toHaveTextContent('数据已发送，等待设备处理…');
  await act(async () => {
    await vi.waitFor(() => expect(store.getState().progress?.phase).toBe('readback'));
  });
  const overlay = screen.getByRole('alertdialog', { name: '正在写入配置' });
  expect(overlay).toHaveTextContent('正在核对键盘中的按键设置');
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '正在核对键盘中的按键设置…');
  fireEvent.keyDown(overlay, { key: 'Escape' });
  expect(store.getState().hardwareOperation).toBe('write');
  await act(async () => {
    readbackGate.release();
    await ready(store);
  });
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(view.container.querySelector('[inert]')).toBeNull();
  expect(store.getState()).toMatchObject({ hardwareOperation: null, canWrite: false });
  expect(device.profile.summary(0)).toBe('A');
});

test.each(['read', 'write'] as const)('%s failure unlocks the page and exposes a dismissible error', async (operation) => {
  const device = new FakeDevice();
  const { store, actions } = application(new FakeHID([device]));
  const view = render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  if (operation === 'write') {
    await act(() => acceptRead(store));
    await openDeviceEditor();
    device.failOn = 0xf1;
    await act(() => actions.assignKey(43));
    fireEvent.click(screen.getByRole('button', { name: '核对并写入' }));
  } else {
    device.readOverride = device.profile.reports.slice(0, 10);
    fireEvent.click(screen.getByRole('button', { name: '配置设备' }));
  }
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: operation === 'read' ? '开始读取' : '开始写入' }));
    await vi.waitFor(() => expect(store.getState().dialog?.kind).toBe('message'));
    await ready(store);
  });
  expect(store.getState().hardwareOperation).toBeNull();
  expect(view.container.querySelector('[inert]')).toBeNull();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  const error = screen.getByRole('dialog', { name: '操作未完成' });
  fireEvent.click(within(error).getByRole('button', { name: '知道了' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: operation === 'read' ? '配置设备' : '重新读取配置' })).toBeEnabled();
});
