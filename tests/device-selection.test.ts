import { expect, test, vi } from 'vitest';
import { FakeDevice, FakeHID } from './helpers';
import { acceptDisconnect, acceptRead, application, ready } from './store-helpers';
import type { ConfigDevice } from '../src/types/hid';
import type { ModelTool } from '../src/model-tools';

test('manually disconnected devices stay disconnected after the page session is recreated', async () => {
  const device = new FakeDevice(), hid = new FakeHID([device]);
  const first = application(hid);
  await first.actions.start();
  await acceptDisconnect(first.store);
  expect(device.opened).toBe(false);
  await first.session.restore();
  expect(first.store.getState().connectedDevices).toHaveLength(0);
  await first.actions.stop();
  const reloaded = application(hid);
  await reloaded.actions.start();
  expect(reloaded.store.getState().connectedDevices).toHaveLength(0);
  await reloaded.actions.connect();
  expect(reloaded.store.getState().connectedDevices).toHaveLength(1);
  await reloaded.actions.stop();
  const afterReconnect = application(hid);
  await afterReconnect.actions.start();
  expect(afterReconnect.store.getState().connectedDevices).toHaveLength(1);
});

test.each([0, 1])('disconnecting device %i revokes only its own permission across page sessions', async index => {
  const devices = [new FakeDevice(), new FakeDevice()];
  const hid = new FakeHID(devices);
  const first = application(hid);
  await first.actions.start();
  await acceptDisconnect(first.store, first.session.connectedDevices[index].id);
  expect(devices[index].forgotten).toBe(true);
  expect(devices[1 - index].forgotten).toBe(false);
  await first.actions.stop();
  const reloaded = application(hid);
  await reloaded.actions.start();
  expect(reloaded.session.connectedDevices).toHaveLength(1);
  expect(reloaded.session.device).toBe(devices[1 - index]);
});

test.each([0, 1])('disconnect confirmation for device %i is invalidated before reconnecting it', async index => {
  const devices = [new FakeDevice(), new FakeDevice()], hid = new FakeHID(devices);
  const { store, actions, session } = application(hid);
  await actions.start();
  await acceptRead(store);
  actions.assignKey(43);
  actions.updateForm({ view: 'advanced', sequence: 'unfinished input' });
  const before = store.getState(), target = session.connectedDevices[index];
  const pending = actions.disconnect(target.id);
  expect(store.getState().dialog).toMatchObject({ kind: 'confirm', disconnectTarget: { id: target.id, epoch: target.epoch } });
  hid.disconnect(devices[index]);
  await pending;
  expect(store.getState().dialog).toBeNull();
  hid.connect(devices[index]);
  await ready(store);
  expect(session.connectedDevices.find(device => device.id === target.id)?.epoch).not.toBe(target.epoch);
  actions.confirm(true);
  expect(session.connectedDevices).toHaveLength(2);
  expect(devices.every(device => device.opened && !device.forgotten)).toBe(true);
  expect(store.getState().profile!.toJSON()).toEqual(before.profile!.toJSON());
  expect(store.getState().drafts).toEqual(before.drafts);
});

test.each([0, 1])('queued disconnect for device %i does not revoke a changed connection', async index => {
  const devices = [new FakeDevice(), new FakeDevice()], hid = new FakeHID(devices);
  const { session, store, actions } = application(hid);
  await actions.start();
  const target = session.connectedDevices[index];
  const pending = session.disconnectDevice(target.id, target.epoch);
  hid.disconnect(devices[index]);
  hid.connect(devices[index]);
  await pending;
  expect(devices[index].forgotten).toBe(false);
  await session.restore();
  await ready(store);
  expect(session.connectedDevices).toHaveLength(2);
  expect(devices.every(device => device.opened && !device.forgotten)).toBe(true);
});

test.each(['unavailable', 'rejected'] as const)('a device is closed and the user is notified when forgetting is %s', async failure => {
  const device = new FakeDevice();
  if (failure === 'unavailable') Object.defineProperty(device, 'forget', { value: undefined });
  else vi.spyOn(device, 'forget').mockRejectedValueOnce(new Error('permission store unavailable'));
  const { store, actions } = application(new FakeHID([device]));
  await actions.start();
  await acceptDisconnect(store);
  expect(device.opened).toBe(false);
  expect(store.getState().connectedDevices).toHaveLength(0);
  expect(store.getState().session.pending).toBe(0);
  expect(store.getState().dialog).toMatchObject({
    kind: 'message', body: { key: failure === 'unavailable' ? 'error.forgetUnsupported' : 'error.forgetDevice' },
  });
});

test('device actions stay locked until revoking permission finishes', async () => {
  const device = new FakeDevice(), hid = new FakeHID([device]);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const forget = device.forget.bind(device);
  const revoke = vi.spyOn(device, 'forget').mockImplementation(async () => { await gate; await forget(); });
  const { store, actions } = application(hid);
  await actions.start();
  const disconnecting = actions.disconnect();
  actions.confirm(true);
  try {
    await vi.waitFor(() => expect(revoke).toHaveBeenCalledOnce());
    expect(store.getState().session.pending).toBe(1);
    expect(await actions.connect()).toBeNull();
    expect(hid.requestCount).toBe(0);
  } finally {
    release();
    await disconnecting;
  }
  expect(store.getState().session.pending).toBe(0);
  expect(device.forgotten).toBe(true);
});

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
  await acceptDisconnect(store, secondId);
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
  if (kind === 'manual') await acceptDisconnect(store);
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
