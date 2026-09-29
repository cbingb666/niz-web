import { expect, test, vi } from 'vitest';
import { HIDSession } from '../src/hid';
import { command } from '../src/protocol';
import { initialCalibration } from '../src/calibration';
import { FakeHID, fixture } from './helpers';
import { application, acceptRead, ready } from './store-helpers';
import { CalibrationDevice, calibrationTraffic, promiseGate, rgbCalibrationDevice } from './calibration-helpers';

async function connected(options: ConstructorParameters<typeof HIDSession>[1] = {}, devices = [new CalibrationDevice()]) {
  const hid = new FakeHID(devices);
  const app = application(hid, undefined, {}, { calibrationTimeout: 35, sendTimeout: 35, ...options });
  await app.actions.start();
  return { ...app, hid, devices, device: devices[0], target: () => app.session.calibrationTarget(app.session.connectedDevices[0].id) };
}

test('default sessions offer calibration for the configured tuple without sending calibration commands', async () => {
  const { session, device } = await connected();
  const id = session.connectedDevices[0].id;
  expect(session.connectedDevices[0].calibration).toBe('available');
  expect(session.calibrationTarget(id)).toMatchObject({ id, version: '66EC(S);V1.4.4;V1.0;' });
  expect(calibrationTraffic(device)).toEqual([]);
  expect(device.sent.map(bytes => bytes[1])).toEqual([0xf9]);
});

test('66EC-XRGB V1.2.5 completes the calibration sequence without configuration or RGB traffic', async () => {
  const { session, device, store, target } = await connected({}, [rgbCalibrationDevice()]);
  const configuration = device.profile.toJSON();
  expect(session.connectedDevices[0].calibration).toBe('available');
  expect(device.sent.map(bytes => bytes[1])).toEqual([0xf9]);
  let state = initialCalibration();
  const run = session.beginCalibration(target(), value => { state = value; });
  await vi.waitFor(() => expect(state.phase).toBe('awaiting-held-keys'));
  await run.calibrateHeldKeys();
  expect(await run.finish()).toMatchObject({ phase: 'testing', batches: 1, unlock: 'sent' });
  expect(calibrationTraffic(device)).toEqual([[0, 0xd9, 0], [0, 0xdb, 0], [0, 0xdd, 0], [0, 0xd9, 1]]);
  expect(device.sent.map(bytes => bytes[1])).toEqual([0xf9, 0xf9, 0xd9, 0xdb, 0xdd, 0xd9]);
  expect(device.profile.toJSON()).toEqual(configuration);
  expect(store.getState().profile).toBeNull();
});

test.each([
  { productId: 0x522a, version: '66EC(XRGB)BLe;V1.2.5;V1.0;' },
  { productId: 0x502a, version: '66EC(XRGB)BLe;V1.2.6;V1.0;' },
])('RGB calibration rejects an unconfigured tuple $productId / $version', async ({ productId, version }) => {
  const device = rgbCalibrationDevice();
  device.productId = productId;
  device.profile.version = version;
  const { session } = await connected({}, [device]);
  expect(session.connectedDevices[0].calibration).toBe('unsupported');
  expect(() => session.calibrationTarget(session.connectedDevices[0].id)).toThrow();
  expect(device.sent.map(bytes => bytes[1])).toEqual([0xf9]);
});

test.each(['66EC(S);V1.4.3;V1.0;', '66EC(XRGB);V1.4.4;V1.0;'])('unqualified firmware %s cannot start calibration', async version => {
  const profile = fixture(); profile.version = version;
  const { session, device } = await connected({}, [new CalibrationDevice(profile)]);
  expect(session.connectedDevices[0].calibration).toBe('unsupported');
  expect(() => session.calibrationTarget(session.connectedDevices[0].id)).toThrow();
  expect(calibrationTraffic(device)).toEqual([]);
});

test('preview does no I/O; whole-session ownership rejects configuration work and duplicate actions', async () => {
  const { session, device, target } = await connected();
  const before = device.sent.length;
  const token = target();
  expect(device.sent).toHaveLength(before);
  let state = initialCalibration();
  const run = session.beginCalibration(token, value => { state = value; }, { recordTrace: true });
  await vi.waitFor(() => expect(state.phase).toBe('awaiting-held-keys'));
  expect(session.pending).toBe(1);
  await expect(session.read()).rejects.toThrow();
  await expect(session.write(fixture(), async () => 'backup')).rejects.toThrow();
  await expect(session.authorize()).rejects.toThrow();
  await expect(session.disconnect()).rejects.toThrow();
  expect(session.selectDevice(token.id)).toBe(false);
  await run.calibrateHeldKeys();
  await run.calibrateHeldKeys();
  await run.finish();
  expect(await run.done).toMatchObject({ batches: 2, unlock: 'sent', phase: 'testing' });
  expect(session.pending).toBe(0);
  expect(calibrationTraffic(device)).toEqual([[0, 0xd9, 0], [0, 0xdb, 0], [0, 0xdd, 0], [0, 0xdd, 0], [0, 0xd9, 1]]);
  expect(device.sent.map(bytes => bytes[1])).not.toContain(0xf2);
  expect(session.calibrationCapture(token.id)?.entries.some(entry => entry.event === 'rx' && entry.bytes.startsWith('00da'))).toBe(true);
  expect(() => session.beginCalibration(token, () => {})).toThrow();
});

test('captured confirmation cannot authorize a new connection or altered descriptor', async () => {
  const { session, device, hid, target } = await connected();
  const token = target();
  hid.disconnect(device);
  hid.connect(device);
  await session.tail;
  expect(() => session.beginCalibration(token, () => {})).toThrow();
  const fresh = session.calibrationTarget(session.connectedDevices[0].id);
  device.collections[0].outputReports![0].items![0].reportCount = 63;
  expect(() => session.beginCalibration(fresh, () => {})).toThrow();
  expect(calibrationTraffic(device)).toEqual([]);
});

test('a firmware change after confirmation preparation fails before locking', async () => {
  const { session, device, target } = await connected();
  const token = target();
  device.profile.version = '66EC(S);V1.4.5;V1.0;';
  const run = session.beginCalibration(token, () => {});
  expect(await run.done).toMatchObject({ phase: 'failed', unlock: 'not-needed', releaseCompleted: false });
  expect(calibrationTraffic(device)).toEqual([]);
});

test('shared VID and firmware are insufficient when the product ID is not qualified', async () => {
  const device = new CalibrationDevice(); device.productId = 0x512a;
  const { session } = await connected({}, [device]);
  expect(session.connectedDevices[0].calibration).toBe('unsupported');
  expect(() => session.calibrationTarget(session.connectedDevices[0].id)).toThrow();
});

test('calibrating an inactive device preserves both editors and only invalidates its baseline', async () => {
  const devices = [new CalibrationDevice(), new CalibrationDevice()];
  const { session, store, actions } = await connected({}, devices);
  const [a, b] = session.connectedDevices;
  await acceptRead(store);
  actions.assignKey(44);
  actions.updateForm({ sequence: 'A' });
  const draftA = store.getState().drafts;
  const profileA = store.getState().profile?.toJSON();
  const configure = actions.configureDevice(b.id);
  await acceptRead(store); await configure;
  actions.assignKey(45);
  actions.updateForm({ sequence: 'B' });
  const draftB = store.getState().drafts;
  const profileB = store.getState().profile?.toJSON();
  expect(session.selectDevice(a.id)).toBe(true);
  let state = initialCalibration();
  const run = session.beginCalibration(session.calibrationTarget(b.id), value => { state = value; });
  await vi.waitFor(() => expect(state.phase).toBe('awaiting-held-keys'));
  expect(session.activeDeviceId).toBe(a.id);
  expect(session.hasLiveBaseline).toBe(true);
  expect(session.connectedDevices.find(d => d.id === b.id)?.hasLiveBaseline).toBe(false);
  expect(store.getState().drafts).toEqual(draftA);
  expect(store.getState().profile?.toJSON()).toEqual(profileA);
  await run.finish();
  session.selectDevice(b.id);
  expect(store.getState().drafts).toEqual(draftB);
  expect(store.getState().profile?.toJSON()).toEqual(profileB);
  expect(store.getState().canUndo).toBe(true);
});

test.each(['wrong', 'timeout', 'malformed', 'duplicate'] as const)('%s reply ends the run with one cleanup and no automatic retry', async failure => {
  const { session, device, target } = await connected();
  if (failure === 'wrong') device.releaseReply = command(0xde);
  if (failure === 'timeout') device.omitResponses.add(0xdb);
  if (failure === 'malformed') device.releaseReply = new Uint8Array(63);
  let state = initialCalibration();
  const token = target();
  const run = session.beginCalibration(token, value => { state = value; });
  if (failure === 'duplicate') {
    await vi.waitFor(() => expect(state.phase).toBe('awaiting-held-keys'));
    device.emit(command(0xde));
    await expect(run.calibrateHeldKeys()).rejects.toThrow();
  }
  expect(await run.done).toMatchObject({ phase: 'failed', unlock: 'sent' });
  expect(calibrationTraffic(device)).toEqual([[0, 0xd9, 0], [0, 0xdb, 0], [0, 0xd9, 1]]);
  expect(session.pending).toBe(0);
  expect(session.connectedDevices).toHaveLength(0);
  const before = device.sent.length;
  await session.restore();
  expect(device.sent).toHaveLength(before);
});

test('stalled physical send is not followed by a competing cleanup or restored automatically', async t => {
  const { session, device, target } = await connected();
  const gate = promiseGate(); t.onTestFinished(gate.resolve);
  device.calibrationSend = bytes => bytes[1] === 0xdb ? gate.promise : Promise.resolve();
  const run = session.beginCalibration(target(), () => {});
  expect(await run.done).toMatchObject({ phase: 'failed', unlock: 'unknown' });
  expect(calibrationTraffic(device)).toEqual([[0, 0xd9, 0], [0, 0xdb, 0]]);
  gate.resolve(); await Promise.resolve();
  await session.restore();
  expect(session.connectedDevices).toHaveLength(0);
});

test('settled send rejection still permits a single terminal unlock on a failed channel', async () => {
  const { session, device, target } = await connected();
  device.calibrationSend = async bytes => { if (bytes[1] === 0xdb) throw new Error('write rejected'); };
  const run = session.beginCalibration(target(), () => {});
  expect(await run.done).toMatchObject({ phase: 'failed', unlock: 'sent' });
  expect(calibrationTraffic(device).at(-1)).toEqual([0, 0xd9, 1]);
});

test('an extra immediate completion is not left in the queue for another stage', async () => {
  const { session, device, target } = await connected();
  device.calibrationSend = async bytes => { if (bytes[1] === 0xdb) device.emit(command(0xda)); };
  const run = session.beginCalibration(target(), () => {});
  expect(await run.done).toMatchObject({ phase: 'failed', unlock: 'sent' });
  expect(calibrationTraffic(device)).toEqual([[0, 0xd9, 0], [0, 0xdb, 0], [0, 0xd9, 1]]);
});

test('malformed input while waiting for the user ends calibration without needing another action', async () => {
  const { session, device, target } = await connected();
  let state = initialCalibration();
  const run = session.beginCalibration(target(), value => { state = value; });
  await vi.waitFor(() => expect(state.phase).toBe('awaiting-held-keys'));
  device.emit(new Uint8Array(63));
  expect(await run.done).toMatchObject({ phase: 'failed', unlock: 'sent' });
  expect(session.pending).toBe(0);
});

test('unlock failure is not success and is never retried', async () => {
  const { session, device, target } = await connected();
  device.calibrationSend = async bytes => { if (bytes[1] === 0xd9 && bytes[2] === 1) throw new Error('unlock rejected'); };
  let state = initialCalibration();
  const run = session.beginCalibration(target(), value => { state = value; });
  await vi.waitFor(() => expect(state.phase).toBe('awaiting-held-keys'));
  expect(await run.finish()).toMatchObject({ phase: 'failed', unlock: 'failed' });
  expect(calibrationTraffic(device).filter(bytes => bytes[2] === 1)).toHaveLength(1);
});

test('inactive target disconnect settles user waiting without touching the other device', async () => {
  const { session, hid, devices } = await connected({}, [new CalibrationDevice(), new CalibrationDevice()]);
  const [a, b] = session.connectedDevices;
  let state = initialCalibration();
  const run = session.beginCalibration(session.calibrationTarget(b.id), value => { state = value; });
  await vi.waitFor(() => expect(state.phase).toBe('awaiting-held-keys'));
  hid.disconnect(devices[1]);
  expect(await run.done).toMatchObject({ phase: 'failed', unlock: 'unknown' });
  expect(session.activeDeviceId).toBe(a.id);
  expect(session.connectedDevices.map(d => d.id)).toEqual([a.id]);
  expect(calibrationTraffic(devices[0])).toEqual([]);
});

test('unplugging a different device does not abort the target calibration', async () => {
  const { session, hid, devices } = await connected({}, [new CalibrationDevice(), new CalibrationDevice()]);
  const b = session.connectedDevices[1];
  let state = initialCalibration();
  const run = session.beginCalibration(session.calibrationTarget(b.id), value => { state = value; });
  await vi.waitFor(() => expect(state.phase).toBe('awaiting-held-keys'));
  hid.disconnect(devices[0]);
  await run.calibrateHeldKeys();
  expect(await run.finish()).toMatchObject({ phase: 'testing', batches: 1, unlock: 'sent' });
  expect(session.connectedDevices.map(d => d.id)).toEqual([b.id]);
});

test('disconnect during a pressed-key response wait rejects the action and settles the run', async () => {
  const { session, hid, device, target } = await connected({ calibrationTimeout: 10000 });
  let state = initialCalibration();
  const run = session.beginCalibration(target(), value => { state = value; });
  await vi.waitFor(() => expect(state.phase).toBe('awaiting-held-keys'));
  device.omitResponses.add(0xdd);
  const press = run.calibrateHeldKeys();
  const rejection = expect(press).rejects.toThrow();
  await vi.waitFor(() => expect(calibrationTraffic(device).at(-1)).toEqual([0, 0xdd, 0]));
  hid.disconnect(device);
  await rejection;
  expect(await run.done).toMatchObject({ phase: 'failed', unlock: 'unknown', batches: 0 });
  expect(session.pending).toBe(0);
});

test('an unresolved unlock is reported as unknown and is attempted only once', async t => {
  const { session, device, target } = await connected();
  const gate = promiseGate(); t.onTestFinished(gate.resolve);
  device.calibrationSend = bytes => bytes[1] === 0xd9 && bytes[2] === 1 ? gate.promise : Promise.resolve();
  let state = initialCalibration();
  const run = session.beginCalibration(target(), value => { state = value; });
  await vi.waitFor(() => expect(state.phase).toBe('awaiting-held-keys'));
  expect(await run.finish()).toMatchObject({ phase: 'failed', unlock: 'unknown' });
  expect(calibrationTraffic(device).filter(bytes => bytes[2] === 1)).toHaveLength(1);
});

test('stop interrupts a user wait, unlocks before closing, and leaves no exclusive task behind', async () => {
  const { session, device, target, store } = await connected();
  let state = initialCalibration();
  const run = session.beginCalibration(target(), value => { state = value; });
  await vi.waitFor(() => expect(state.phase).toBe('awaiting-held-keys'));
  await session.stop();
  expect(await run.done).toMatchObject({ phase: 'failed', unlock: 'sent' });
  expect(calibrationTraffic(device).at(-1)).toEqual([0, 0xd9, 1]);
  expect(device.opened).toBe(false);
  await ready(store);
});
