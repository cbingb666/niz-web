// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from '../src/app';
import { translate } from '../src/i18n/core';
import { FakeDevice, FakeHID } from './helpers';
import { acceptRead, application, profileFile, ready } from './store-helpers';

afterEach(cleanup);

test.each(['zh-CN', 'en'] as const)('%s cards expose disconnect and calibration directly while expanding details sends no commands', async locale => {
  const device = new FakeDevice(), hid = new FakeHID([device]);
  const { store, actions } = application(hid, undefined, { locale });
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  const card = within(screen.getByRole('article', { name: device.productName }));
  const configure = card.getByRole('button', { name: translate(locale, 'devices.configure') });
  expect(configure).toBeVisible();
  const disconnect = card.getByRole('button', { name: translate(locale, 'connection.disconnect') });
  const calibration = card.getByRole('button', { name: translate(locale, 'calibration.entry') });
  expect(disconnect).toBeVisible();
  expect(calibration).toBeVisible();
  expect(configure).toHaveAccessibleDescription(translate(locale, 'connection.notRead'));
  expect(card.getByText(device.profile.version)).not.toBeVisible();
  const summary = card.getByText(translate(locale, 'connection.details'), { selector: 'summary' });
  expect(summary.closest('details')).not.toHaveAttribute('open');
  const sent = device.sent.slice();
  fireEvent.click(summary);
  expect(summary.closest('details')).toHaveAttribute('open');
  expect(card.getByText(device.profile.version)).toBeVisible();
  expect(disconnect).toHaveAccessibleDescription(translate(locale, 'devices.disconnectHint'));
  fireEvent.click(summary);
  expect(disconnect).toBeVisible();
  expect(calibration).toBeVisible();
  expect(device.sent).toEqual(sent);
  expect(hid.requestCount).toBe(0);
  expect(store.getState().profile).toBeNull();
  expect(store.getState().dialog).toBeNull();
});

test('removing the focused device card returns keyboard focus to the devices heading', async () => {
  const device = new FakeDevice();
  const { store, actions } = application(new FakeHID([device]));
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  const disconnect = screen.getByRole('button', { name: '断开' });
  disconnect.focus();
  await act(async () => {
    fireEvent.click(disconnect);
    await ready(store);
  });
  expect(screen.getByRole('heading', { name: '连接键盘' })).toHaveFocus();
});

test.each(['zh-CN', 'en'] as const)('%s empty devices page opens the offline demo without USB authorization', async locale => {
  const hid = new FakeHID();
  const { store, actions } = application(hid, undefined, { locale });
  render(<App store={store} />);
  await act(() => actions.start());
  expect(screen.getByText(translate(locale, 'devices.supported', { models: 'ATOM66' }))).toBeVisible();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: translate(locale, 'keyboard.demo') })); });
  expect(store.getState().page).toBe('editor');
  expect(store.getState().source).toBe('demo');
  expect(store.getState().canWrite).toBe(false);
  expect(hid.requestCount).toBe(0);
});

test('a bound import has one device entry and returning to it preserves drafts without another read', async () => {
  const first = new FakeDevice(), second = new FakeDevice(), hid = new FakeHID([first, second]);
  const { store, actions, session } = application(hid);
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  const firstId = session.activeDeviceId!;
  const configuring = actions.configureDevice(firstId);
  await act(async () => { await acceptRead(store); await configuring; });
  const imported = first.profile.clone();
  imported.setDefinition(0, { type: 0, keys: [43] });
  await act(() => actions.importFile(profileFile(imported)));
  act(() => actions.updateForm({ view: 'advanced', sequence: 'unfinished macro' }));
  const before = store.getState();
  await act(async () => {
    const leaving = actions.navigate('devices');
    actions.confirm(true);
    await leaving;
  });
  expect(screen.queryByRole('region', { name: '当前编辑内容' })).not.toBeInTheDocument();
  const firstCard = within(screen.getByRole('article', { name: 'ATOM66 fixture · 设备 1' }));
  expect(firstCard.getByRole('button', { name: '配置设备' })).toHaveAccessibleDescription('已读取配置 有未写入的修改');
  expect(within(screen.getByRole('article', { name: 'ATOM66 fixture · 设备 2' })).queryByText('有未写入的修改')).not.toBeInTheDocument();
  const sent = [first.sent.slice(), second.sent.slice()];
  act(() => actions.setLocale('en'));
  expect(firstCard.getByRole('button', { name: 'Configure device' })).toHaveAccessibleDescription('Configuration loaded Changes pending');
  await act(async () => { fireEvent.click(firstCard.getByRole('button', { name: 'Configure device' })); });
  expect(store.getState().page).toBe('editor');
  expect(store.getState().profile!.toJSON()).toEqual(before.profile!.toJSON());
  expect(store.getState().drafts).toEqual(before.drafts);
  expect(store.getState().form.sequence).toBe('unfinished macro');
  expect([first.sent, second.sent]).toEqual(sent);
});

test('disconnecting an inactive card keeps its drafts accessible and leaves the other keyboard connected', async () => {
  const first = new FakeDevice(), second = new FakeDevice(), hid = new FakeHID([first, second]);
  const { store, actions, session } = application(hid);
  render(<App store={store} usbAvailable />);
  await act(() => actions.start());
  const firstId = session.activeDeviceId!, secondId = session.connectedDevices[1].id;
  await act(() => acceptRead(store));
  act(() => {
    actions.assignKey(43);
    actions.updateForm({ view: 'advanced', sequence: 'unfinished macro' });
  });
  const before = store.getState();
  const configuring = actions.configureDevice(secondId);
  await act(async () => { await acceptRead(store); await configuring; });
  await act(() => actions.navigate('devices'));
  const secondSent = second.sent.slice();
  const firstCard = within(screen.getByRole('article', { name: 'ATOM66 fixture · 设备 1' }));
  await act(async () => {
    fireEvent.click(firstCard.getByRole('button', { name: '断开' }));
    await ready(store);
  });
  expect(first.forgotten).toBe(true);
  expect(second.opened).toBe(true);
  expect(session.activeDeviceId).toBe(secondId);
  const saved = screen.getByRole('region', { name: '保留的编辑内容' });
  expect(saved).toHaveTextContent('ATOM66 fixture · 设备 1');
  expect(saved).toHaveTextContent('设备已断开，可离线编辑或导出。');
  fireEvent.click(within(saved).getByRole('button', { name: '继续编辑' }));
  expect(session.activeDeviceId).toBe(firstId);
  expect(store.getState().profile!.toJSON()).toEqual(before.profile!.toJSON());
  expect(store.getState().drafts).toEqual(before.drafts);
  expect(store.getState().canUndo).toBe(true);
  expect(store.getState().canWrite).toBe(false);
  expect(second.sent).toEqual(secondSent);
  await act(async () => {
    const leaving = actions.navigate('devices');
    actions.confirm(true);
    await leaving;
  });
  const current = screen.getByRole('region', { name: '当前编辑内容' });
  expect(within(current).getByRole('heading', { name: 'ATOM66 fixture · 设备 1' })).toBeVisible();
  act(() => actions.setLocale('en'));
  expect(within(current).getByRole('heading', { name: 'ATOM66 fixture · Device 1' })).toBeVisible();
  expect(second.sent).toEqual(secondSent);
});
