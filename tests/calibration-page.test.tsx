// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from '../src/app';
import { translate, type MessageArgs, type MessageKey } from '../src/i18n/core';
import { FakeHID } from './helpers';
import { application } from './store-helpers';
import { CalibrationDevice, calibrationTraffic, rgbCalibrationDevice } from './calibration-helpers';

afterEach(cleanup);

async function setup(locale: 'en' | 'zh-CN' = 'zh-CN', deadline = 1000) {
  const device = new CalibrationDevice();
  const app = application(new FakeHID([device]), undefined, { locale }, {
    calibrationTimeout: deadline, sendTimeout: 1000,
  });
  const view = render(<App store={app.store} usbAvailable />);
  await act(() => app.actions.start());
  return { ...app, ...view, device };
}

test('normal application offers calibration by default without reading or calibrating automatically', async () => {
  const { device, store } = await setup('en');
  expect(screen.getByRole('button', { name: 'Calibrate keys' })).toBeEnabled();
  expect(device.sent.map(bytes => bytes[1])).toEqual([0xf9]);
  expect(store.getState().profile).toBeNull();
});

test.each([
  { productId: 0x502a, version: '66EC(XRGB)BLe;V1.2.5;V1.0;', name: '66EC-XRGB' },
  { productId: 0x542a, version: '66EC(RGB)BLe;V1.5.1;V1.0;', name: '66EC-RGB' },
])('$name exposes calibration without loading a configuration', async ({ productId, version, name }) => {
  const device = rgbCalibrationDevice();
  device.productId = productId;
  device.productName = name;
  device.profile.version = version;
  const { actions, store } = application(new FakeHID([device]));
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  const card = screen.getByRole('article', { name });
  expect(within(card).getByRole('button', { name: '校准按键' })).toBeVisible();
  const detailsEntry = within(card).getByRole('button', { name: '设备详情' });
  fireEvent.click(detailsEntry);
  const details = screen.getByRole('dialog', { name: '设备详情' });
  expect(details).toHaveTextContent(`0x${productId.toString(16).toUpperCase()}`);
  expect(details).toHaveTextContent(version);
  await act(async () => { fireEvent.click(within(details).getByRole('button', { name: '关闭' })); });
  await vi.waitFor(() => expect(detailsEntry).toHaveFocus());
  const entry = within(card).getByRole('button', { name: '校准按键' });
  expect(entry).toBeEnabled();
  fireEvent.click(entry);
  const cancel = within(screen.getByRole('alertdialog')).getByRole('button', { name: '取消' });
  expect(cancel).toHaveFocus();
  fireEvent.click(cancel);
  expect(store.getState().profile).toBeNull();
  expect(device.sent.map(bytes => bytes[1])).toEqual([0xf9]);
});

test.each(['en', 'zh-CN'] as const)('%s preview focuses cancel and produces no calibration or configuration traffic', async locale => {
  const { device, store } = await setup(locale);
  const sent = device.sent.slice();
  fireEvent.click(screen.getByRole('button', { name: translate(locale, 'calibration.entry') }));
  const dialog = screen.getByRole('alertdialog', { name: translate(locale, 'calibration.title') });
  const cancel = within(dialog).getByRole('button', { name: translate(locale, 'common.cancel') });
  expect(cancel).toHaveFocus();
  expect(dialog).toHaveTextContent(translate(locale, 'calibration.backupNotice'));
  expect(dialog).toHaveTextContent(translate(locale, 'calibration.validationNotice'));
  expect(within(dialog).getByRole('img', { name: translate(locale, 'calibration.lockIllustration') })).toBeVisible();
  fireEvent.click(cancel);
  expect(device.sent).toEqual(sent);
  expect(store.getState().profile).toBeNull();
  expect(store.getState().calibration).toBeNull();
  await vi.waitFor(() => expect(screen.getByRole('button', { name: translate(locale, 'calibration.entry') })).toHaveFocus());
});

test.each(['Enter', ' '])('%s activation waits for keyup without duplicate dispatch', async key => {
  const { device, store, actions, container } = await setup();
  fireEvent.click(screen.getByRole('button', { name: '校准按键' }));
  const start = screen.getByRole('button', { name: '开始校准' });
  start.focus();
  fireEvent.keyDown(start, { key });
  fireEvent.keyDown(start, { key, repeat: true });
  fireEvent.click(start, { detail: 0 });
  expect(calibrationTraffic(device)).toEqual([]);
  await act(async () => {
    fireEvent.keyUp(start, { key });
    await vi.waitFor(() => expect(store.getState().calibration?.state.phase).toBe('awaiting-held-keys'));
  });
  expect(calibrationTraffic(device)).toEqual([[0, 0xd9, 0], [0, 0xdb, 0]]);
  expect(container.querySelector('[inert]')).not.toBeNull();
  expect(screen.getByRole('button', { name: '校准按住的键' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
  fireEvent.pointerDown(document.body);
  await actions.navigate('connect');
  expect(store.getState().page).toBe('devices');
  expect(store.getState().hardwareOperation).toBe('calibrate');
  const leaving = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(leaving);
  expect(leaving.defaultPrevented).toBe(true);
  await act(async () => { await actions.finishCalibration(); });
  expect(container.querySelector('[inert]')).toBeNull();
});

test('missing activation release is recoverable by a pointer click, without a timer or implicit retry', async () => {
  const { device, store, actions } = await setup();
  fireEvent.click(screen.getByRole('button', { name: '校准按键' }));
  const start = screen.getByRole('button', { name: '开始校准' });
  fireEvent.keyDown(start, { key: 'Enter' });
  fireEvent.blur(start);
  expect(calibrationTraffic(device)).toEqual([]);
  await act(async () => {
    fireEvent.pointerDown(start);
    fireEvent.click(start);
    await vi.waitFor(() => expect(store.getState().calibration?.state.phase).toBe('awaiting-held-keys'));
  });
  await act(async () => { await actions.finishCalibration(); });
  expect(calibrationTraffic(device)).toEqual([[0, 0xd9, 0], [0, 0xdb, 0], [0, 0xd9, 1]]);
});

test.each(['en', 'zh-CN'] as const)('%s complete wizard waits for held-key completion and exports only the opted-in trace', async locale => {
  const { device, store, actions, download, container } = await setup(locale);
  function t<K extends MessageKey>(key: K, ...args: MessageArgs<K>) { return translate(locale, key, ...args); }
  fireEvent.click(screen.getByRole('button', { name: t('calibration.entry') }));
  fireEvent.click(screen.getByRole('checkbox', { name: t('calibration.trace') }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: t('calibration.start') }));
    await vi.waitFor(() => expect(store.getState().calibration?.state.phase).toBe('awaiting-held-keys'));
  });
  expect(store.getState().profile).toBeNull();
  device.omitResponses.add(0xdd);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: t('calibration.press') }));
    await vi.waitFor(() => expect(calibrationTraffic(device).at(-1)).toEqual([0, 0xdd, 0]));
  });
  expect(screen.getByRole('alertdialog')).toHaveTextContent(t('calibration.keepHeld'));
  expect(screen.queryByRole('button', { name: t('calibration.finish') })).not.toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  await act(async () => {
    device.emit(device.pressReply);
    await vi.waitFor(() => expect(store.getState().calibration?.state.batches).toBe(1));
  });
  await act(async () => { await actions.finishCalibration(); });
  expect(container.querySelector('[inert]')).toBeNull();
  expect(screen.getByRole('textbox', { name: t('calibration.testLabel') })).toHaveFocus();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'private typing' } });
  fireEvent.click(screen.getByRole('button', { name: t('calibration.export') }));
  expect(download).toHaveBeenCalledOnce();
  const capture: unknown = download.mock.calls[0][1];
  expect(capture).toMatchObject({ format: 'niz-calibration-capture', outcome: { batches: 1, unlock: 'sent' } });
  expect(JSON.stringify(capture)).not.toContain('private typing');
  expect(device.sent.map(bytes => bytes[1])).not.toContain(0xf2);
  fireEvent.click(screen.getByRole('button', { name: t('calibration.done') }));
  expect(store.getState().calibration).toBeNull();
});

test('failure removes the page lock and retains a reviewable result without requiring a loaded profile', async () => {
  const { device, store, container, session } = await setup('zh-CN', 50);
  device.omitResponses.add(0xdb);
  fireEvent.click(screen.getByRole('button', { name: '校准按键' }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '开始校准' }));
    await vi.waitFor(() => expect(store.getState().hardwareOperation).toBeNull());
  });
  expect(store.getState().calibration?.state.phase).toBe('failed');
  expect(container.querySelector('[inert]')).toBeNull();
  expect(store.getState().profile).toBeNull();
  expect(screen.getByRole('alertdialog')).toHaveTextContent('结果尚不确定');
  expect(screen.queryByRole('button', { name: '导出校准诊断' })).not.toBeInTheDocument();
  expect(session.calibrationCapture('device-1')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '完成' }));
  fireEvent.click(screen.getByRole('button', { name: '查看校准结果' }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent('校准未完成');
  expect(screen.queryByRole('button', { name: '开始校准' })).not.toBeInTheDocument();
});
