import { expect, test, vi } from 'vitest';
import { FakeDevice, FakeHID } from './helpers';
import { acceptRead, application, ready } from './store-helpers';
import type { ConfigDevice } from '../src/types/hid';
import type { ModelTool } from '../src/model-tools';

test('requesting a device while connected opens the picker in the same user gesture', async () => {
  const device = new FakeDevice(), hid = new FakeHID([device]);
  const { actions, session } = application(hid);
  await actions.start();
  expect(session.connected).toBe(true);
  const connecting = actions.connect();
  expect(hid.requestCount).toBe(1);
  await connecting;
});

test('adding another ATOM66 retains both connections and preserves the selected device until configuration', async () => {
  const first = new FakeDevice(), second = new FakeDevice(), hid = new FakeHID([first]);
  const { store, actions, session } = application(hid);
  await actions.start();
  await acceptRead(store);
  const firstId = session.activeDeviceId, epoch = session.epoch, baseline = session.lastRead;
  const sent = first.sent.slice();
  hid.selection = [second];
  const secondId = await actions.connect();
  expect(secondId).not.toBe(firstId);
  expect(first.opened && second.opened).toBe(true);
  expect(session.activeDeviceId).toBe(firstId);
  expect(session.epoch).toBe(epoch);
  expect(session.lastRead).toBe(baseline);
  expect(first.sent).toEqual(sent);
  expect(second.sent.map(packet => packet[1])).toEqual([0xf9]);
  expect(store.getState().connectedDevices).toMatchObject([
    { id: firstId, number: 1, hasLiveBaseline: true },
    { id: secondId, number: 2, hasLiveBaseline: false },
  ]);
  hid.selection = [first];
  expect(await actions.connect()).toBe(firstId);
  expect(store.getState().connectedDevices).toHaveLength(2);
  expect(first.openCount).toBe(1);
  expect(first.sent).toEqual(sent);
  await actions.stop();
  expect(first.opened || second.opened).toBe(false);
});

test.each(['cancel', 'reject', 'open-error'] as const)('%s while adding a device preserves the original connection and baseline', async outcome => {
  const first = new FakeDevice(), second = new FakeDevice(), hid = new FakeHID([first]);
  const { store, actions, session } = application(hid);
  await actions.start();
  await acceptRead(store);
  const baseline = session.lastRead, epoch = session.epoch, before = first.sent.slice();
  if (outcome === 'reject') vi.spyOn(hid, 'requestDevice').mockRejectedValueOnce(new Error('permission denied'));
  else if (outcome === 'open-error') { second.failOn = 0xf9; hid.selection = [second]; }
  else hid.selection = [];
  expect(await actions.connect()).toBeNull();
  expect(first.opened).toBe(true);
  expect(second.opened).toBe(false);
  expect(session.connected).toBe(true);
  expect(session.epoch).toBe(epoch);
  expect(session.lastRead).toBe(baseline);
  expect(session.hasLiveBaseline).toBe(true);
  expect(first.sent).toEqual(before);
  expect(store.getState().connectedDevices).toHaveLength(1);
});

test('the existing device stays connected while the picker is open, and stopping cannot open a late selection', async () => {
  const first = new FakeDevice(), second = new FakeDevice(), hid = new FakeHID([first]);
  const { actions, session } = application(hid);
  await actions.start();
  let select!: (devices: ConfigDevice[]) => void;
  vi.spyOn(hid, 'requestDevice').mockImplementation(() => new Promise(resolve => { select = resolve; }));
  const pending = actions.connect();
  expect(hid.requestDevice).toHaveBeenCalledOnce();
  expect(session.connected && first.opened).toBe(true);
  await actions.stop();
  select([second]);
  await pending;
  expect(first.opened || second.opened).toBe(false);
  expect(second.openCount).toBe(0);
});

test('device configuration restores independent drafts and undo history, and writes only to the selected keyboard', async () => {
  const first = new FakeDevice(), second = new FakeDevice(), hid = new FakeHID([first]);
  second.profile.setDefinition(0, { type: 0, keys: [44] });
  const { store, actions, session } = application(hid);
  const tools: ModelTool[] = [];
  await actions.start({ registerTool: tool => tools.push(tool) });
  await acceptRead(store);
  const firstId = session.activeDeviceId!;
  actions.assignKey(43);
  actions.updateForm({ view: 'advanced', sequence: 'unfinished first keyboard' });
  const firstProfile = store.getState().profile!.toJSON();
  hid.selection = [second];
  const secondId = (await actions.connect())!;
  expect(store.getState().profile!.toJSON()).toEqual(firstProfile);
  const configuring = actions.configureDevice(secondId);
  await acceptRead(store);
  await configuring;
  expect(store.getState().form.sequence).toBe('S');
  expect(store.getState().draftIndices).toEqual([]);
  expect(store.getState().canUndo).toBe(false);
  expect(store.getState().hasUnsavedChanges).toBe(true);
  tools.at(-1)!.execute({ edits: [{ layer: 0, key: 0, type: 0, sequence: 'C' }] });
  const firstSent = first.sent.slice();
  const writing = actions.write();
  actions.confirm(true);
  await writing;
  expect(second.profile.summary(0)).toBe('C');
  expect(first.sent).toEqual(firstSent);
  expect(first.profile.summary(0)).toBe('Esc');
  expect(store.getState().hasUnsavedChanges).toBe(true);
  const secondSent = second.sent.slice();
  await actions.configureDevice(firstId);
  expect(store.getState().profile!.toJSON()).toEqual(firstProfile);
  expect(store.getState().form.sequence).toBe('unfinished first keyboard');
  expect(store.getState().draftIndices).toEqual([0]);
  expect(store.getState().canUndo).toBe(true);
  expect(store.getState().canWrite).toBe(false);
  actions.discardForm();
  expect(store.getState().canWrite).toBe(true);
  actions.undo();
  expect(store.getState().form.sequence).toBe('Esc');
  expect(store.getState().hasUnsavedChanges).toBe(false);
  expect(first.sent).toEqual(firstSent);
  expect(second.sent).toEqual(secondSent);
});

test('unplugging or disconnecting another device does not invalidate the active keyboard', async () => {
  const first = new FakeDevice(), second = new FakeDevice(), hid = new FakeHID([first, second]);
  const { store, actions, session } = application(hid);
  await actions.start();
  await acceptRead(store);
  await actions.configureDevice();
  const epoch = session.epoch, baseline = session.lastRead;
  hid.disconnect(second);
  await ready(store);
  expect(session.connected).toBe(true);
  expect(session.epoch).toBe(epoch);
  expect(session.lastRead).toBe(baseline);
  expect(store.getState().connectedDevices).toHaveLength(1);
  expect(store.getState().page).toBe('editor');
  hid.connect(second);
  await ready(store);
  expect(store.getState().connectedDevices).toHaveLength(2);
  const secondId = store.getState().connectedDevices.find(device => device.id !== session.activeDeviceId)!.id;
  await actions.disconnect(secondId);
  await session.restore();
  expect(first.opened).toBe(true);
  expect(second.opened).toBe(false);
  expect(session.hasLiveBaseline).toBe(true);
  expect(session.lastRead).toBe(baseline);
  expect(store.getState().connectedDevices).toHaveLength(1);
  expect(store.getState().page).toBe('editor');
});

test.each(['manual', 'unplug'] as const)('%s disconnect returns to Devices and keeps the active edits and drafts', async kind => {
  const device = new FakeDevice(), hid = new FakeHID([device]);
  const { store, actions } = application(hid);
  await actions.start();
  await acceptRead(store);
  await actions.configureDevice();
  actions.assignKey(43);
  actions.updateForm({ view: 'advanced', sequence: 'unfinished macro' });
  const before = store.getState();
  if (kind === 'manual') await actions.disconnect();
  else hid.disconnect(device);
  expect(store.getState().page).toBe('devices');
  expect(store.getState().session.connected).toBe(false);
  expect(store.getState().profile!.toJSON()).toEqual(before.profile!.toJSON());
  expect(store.getState().drafts).toEqual(before.drafts);
  expect(store.getState().canUndo).toBe(true);
  expect(store.getState().hasUnsavedChanges).toBe(true);
  await actions.navigate('editor');
  expect(store.getState().page).toBe('editor');
  expect(store.getState().form.sequence).toBe('unfinished macro');
  expect(store.getState().canWrite).toBe(false);
});

test('unplugging during a leave confirmation closes it and returns to Devices', async () => {
  const device = new FakeDevice(), hid = new FakeHID([device]);
  const { store, actions } = application(hid);
  await actions.start();
  await acceptRead(store);
  await actions.configureDevice();
  actions.assignKey(43);
  const leaving = actions.navigate('devices');
  expect(store.getState().dialog?.kind).toBe('confirm');
  hid.disconnect(device);
  await leaving;
  expect(store.getState().page).toBe('devices');
  expect(store.getState().dialog).toBeNull();
  expect(store.getState().profile!.summary(0)).toBe('A');
});

test('edits on another device do not prompt when leaving an unchanged active editor', async () => {
  const first = new FakeDevice(), second = new FakeDevice(), hid = new FakeHID([first, second]);
  const { store, actions, session } = application(hid);
  await actions.start();
  await acceptRead(store);
  await actions.configureDevice();
  actions.assignKey(43);
  const secondId = session.connectedDevices.find(device => device.id !== session.activeDeviceId)!.id;
  const configuring = actions.configureDevice(secondId);
  await acceptRead(store);
  await configuring;
  expect(store.getState().hasUnsavedChanges).toBe(true);
  await actions.navigate('devices');
  expect(store.getState().page).toBe('devices');
  expect(store.getState().dialog).toBeNull();
});

test('edits for an unplugged inactive keyboard remain accessible without using another device connection', async () => {
  const first = new FakeDevice(), second = new FakeDevice(), hid = new FakeHID([first, second]);
  const { store, actions, session } = application(hid);
  await actions.start();
  await acceptRead(store);
  const firstId = session.activeDeviceId!, secondId = session.connectedDevices[1].id;
  actions.assignKey(43);
  const original = store.getState().profile!.toJSON();
  const configureSecond = actions.configureDevice(secondId);
  await acceptRead(store);
  await configureSecond;
  hid.disconnect(first);
  expect(store.getState().disconnectedEditors).toMatchObject([{ id: firstId }]);
  const sent = second.sent.slice();
  actions.resumeEditor(firstId);
  expect(store.getState().profile!.toJSON()).toEqual(original);
  expect(store.getState().canUndo).toBe(true);
  expect(store.getState().hasUnsavedChanges).toBe(true);
  expect(store.getState().canWrite).toBe(false);
  expect(session.connected).toBe(false);
  expect(second.opened).toBe(true);
  await actions.configureDevice(secondId);
  expect(session.connected).toBe(true);
  expect(store.getState().profile!.summary(0)).toBe('Esc');
  expect(second.sent).toEqual(sent);
});
