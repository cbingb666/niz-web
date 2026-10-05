import { expect, test, vi } from 'vitest';
import { initialFirmware, stockFirmware } from '../src/firmware';
import { command } from '../src/protocol';
import { FakeHID, FakeDevice, inputEvent } from './helpers';
import { application, acceptRead } from './store-helpers';
import { firmwareDevice, syntheticFirmware, syntheticFirmwareFile } from './firmware-helpers';
import { promiseGate } from './calibration-helpers';

async function setup(devices = [firmwareDevice()], options: Parameters<typeof application>[3] = {}) {
  const hid = new FakeHID(devices);
  const app = application(hid, undefined, {}, { firmwarePacketDelay: 0, firmwareRestartTimeout: 10, ...options });
  await app.actions.start();
  const target = () => app.session.firmwareTarget(app.session.connectedDevices[0].id);
  return { ...app, hid, device: devices[0], target };
}

test('exact device eligibility and preview cannot read or flash a configuration', async () => {
  const { session, device, target } = await setup();
  expect(session.connectedDevices[0].firmwareFlash).toBe(true);
  const token = target();
  expect(device.sent.map(bytes => bytes[1])).toEqual([0xf9]);
  expect(token.id).toBe(session.connectedDevices[0].id);
  await syntheticFirmware();
  expect(device.sent.map(bytes => bytes[1])).toEqual([0xf9]);
  expect(device.flashCount).toBe(0);
});

test.each([{ pid: 0x502a, version: stockFirmware.version },
  { pid: 0x542a, version: '66EC(RGB)BLe;M1.5.1;V1.0;' },
  { pid: 0x542a, version: '66EC(RGB)BLe;V1.5.0;V1.0;' }])('rejects an unqualified tuple $pid / $version', async ({ pid, version }) => {
  const device = firmwareDevice(); device.productId = pid; device.profile.version = version;
  const { session } = await setup([device]);
  expect(session.connectedDevices[0].firmwareFlash).toBe(false);
  expect(() => session.firmwareTarget(session.connectedDevices[0].id)).toThrow();
  expect(device.flashCount).toBe(0);
});

test.each(['backup', 'keys', 'lights', 'counters', 'firmware'] as const)('%s preflight failure sends no firmware', async failure => {
  const { session, device, store, target, backups } = await setup();
  await acceptRead(store);
  const file = await syntheticFirmware(), token = target();
  if (failure === 'keys') device.omitResponses.add(0xf2);
  if (failure === 'lights') device.omitResponses.add(0xe2);
  if (failure === 'counters') device.omitResponses.add(0xe3);
  if (failure === 'firmware') device.profile.version = '66EC(RGB)BLe;V1.5.0;V1.0;';
  if (failure === 'backup') vi.mocked(backups.save).mockRejectedValueOnce(new Error('backup unavailable'));
  const result = await session.flashFirmware(token, file, backups.save, () => {});
  expect(result).toMatchObject({ phase: 'failed', attempted: false, completed: 0 });
  expect(device.flashCount).toBe(0);
  expect(session.hasLiveBaseline).toBe(true);
  expect(() => session.flashFirmware(token, file, backups.save, () => {})).toThrow();
});

test('start automatically reads and backs up the complete configuration without a prior read', async () => {
  const { session, device, store, target, hid, backups } = await setup();
  expect(store.getState().profile).toBeNull();
  expect(session.hasLiveBaseline).toBe(false);
  const file = await syntheticFirmware(), token = target();
  device.firmwareSend = bytes => { if (bytes[2] === 5) hid.disconnect(device); };
  let state = initialFirmware();
  const result = await session.flashFirmware(token, file, async (profile, reason) => {
    expect(device.flashCount).toBe(0);
    expect(reason).toBe('固件刷写前');
    expect(profile.records).toEqual(device.profile.records);
    expect(profile.lights).toEqual(device.profile.lights);
    expect(profile.counters).toEqual(device.profile.counters);
    return backups.save(profile, reason);
  }, value => { state = value; });
  expect(result).toMatchObject({ phase: 'awaiting-reconnect', completed: 3352, total: 3352, attempted: true });
  expect(result.backupId).toBeTruthy();
  expect(device.sent.slice(1, 5).map(bytes => bytes[1])).toEqual([0xf9, 0xf2, 0xe2, 0xe3]);
  expect(store.getState().profile).toBeNull();
  expect(state.phase).toBe('awaiting-reconnect');
  expect(device.flashCount).toBe(3352);
  expect(device.sent.every(bytes => ![0xd9, 0xf1, 0xe1].includes(bytes[1]))).toBe(true);
  expect(session.hasLiveBaseline).toBe(false);
  expect(session.pending).toBe(0);
  expect(session.firmwareCanVerify(token)).toBe(true);
  hid.connect(device);
  await session.tail;
  hid.selection = [device];
  const before = device.flashCount;
  const verification = session.verifyFirmware(token);
  expect(hid.requestCount).toBe(1); // Picker stays in the synchronous activation chain.
  await verification;
  expect(device.flashCount).toBe(before);
  expect(session.hasLiveBaseline).toBe(false);
});

test('the backup uses the newly read device state and preserves previously loaded edits', async () => {
  const { session, device, store, actions, target, backups } = await setup();
  await acceptRead(store);
  actions.assignKey(45);
  const edits = store.getState().profile?.toJSON();
  device.profile.setDefinition(0, { type: 0, keys: [44] });
  device.profile.lights![0] ^= 1;
  device.profile.counters[0] = 321;
  device.firmwareSend = () => { throw new Error('stop synthetic flash after backup'); };
  const result = await session.flashFirmware(target(), await syntheticFirmware(), backups.save, () => {});
  const saved = await backups.profile(result.backupId!);
  expect(saved.definition(0).keys).toEqual([44]);
  expect(saved.lights).toEqual(device.profile.lights);
  expect(saved.counters[0]).toBe(321);
  expect(store.getState().profile?.toJSON()).toEqual(edits);
  expect(store.getState().canUndo).toBe(true);
});

test('automatic read and backup remain in one exclusive transaction before the first firmware report', async () => {
  const { session, device, store, target, backups } = await setup();
  const commit = promiseGate();
  let state = initialFirmware();
  const run = session.flashFirmware(target(), await syntheticFirmware(), async (profile, reason) => {
    await commit.promise;
    return backups.save(profile, reason);
  }, next => { state = next; });
  await vi.waitFor(() => expect(state.phase).toBe('backup'));
  expect(device.sent.map(bytes => bytes[1])).toEqual([0xf9, 0xf9, 0xf2, 0xe2, 0xe3]);
  expect(device.flashCount).toBe(0);
  expect(session.pending).toBe(1);
  expect(store.getState().profile).toBeNull();
  device.firmwareSend = () => { throw new Error('stop synthetic flash after backup'); };
  commit.resolve();
  expect(await run).toMatchObject({ phase: 'failed', attempted: true, backupId: expect.any(String) });
  expect(device.flashCount).toBe(1);
});

test('transfer completion without a disconnect stays unconfirmed, including a same-version reply', async () => {
  const { session, device, store, target, hid, backups } = await setup();
  await acceptRead(store);
  const token = target();
  expect(await session.flashFirmware(token, await syntheticFirmware(), backups.save, () => {})).toMatchObject({ phase: 'unconfirmed' });
  expect(session.firmwareCanVerify(token)).toBe(false);
  await expect(session.verifyFirmware(token)).rejects.toThrow();
  expect(hid.requestCount).toBe(0);
  expect(device.flashCount).toBe(3352);
  const before = device.sent.length;
  await session.restore();
  expect(device.sent).toHaveLength(before);
  hid.disconnect(device);
  expect(session.firmwareCanVerify(token)).toBe(true);
});

test.each([0xa0, 0xa1])('device rejection %s stops the stream, invalidates only its baseline, and never sends EOF or cleanup', async code => {
  const a = firmwareDevice(), b = firmwareDevice();
  const { session, store, target, backups } = await setup([a, b]);
  await acceptRead(store);
  a.firmwareSend = () => { if (a.flashCount === 3) { const reply = command(0x3a); reply[2] = code; a.emit(reply); } };
  const result = await session.flashFirmware(target(), await syntheticFirmware(), backups.save, () => {});
  expect(result.phase).toBe('failed');
  expect(result.completed).toBe(3);
  expect(a.flashCount).toBe(3);
  expect(a.sent.map(bytes => bytes[1])).not.toContain(0xd9);
  expect(session.connectedDevices.map(device => device.id)).toEqual(['device-2']);
  const before = a.sent.length;
  await session.restore();
  expect(a.sent).toHaveLength(before);
  expect(b.sent.map(bytes => bytes[1])).toEqual([0xf9]);
});

test('connection and descriptor changes invalidate a captured target before any firmware is sent', async () => {
  const { session, device, store, target, hid, backups } = await setup();
  await acceptRead(store);
  const file = await syntheticFirmware(), token = target();
  hid.disconnect(device); hid.connect(device); await session.tail;
  expect(() => session.flashFirmware(token, file, backups.save, () => {})).toThrow();
  const fresh = target(); await acceptRead(store);
  device.collections[0].outputReports![0].items![0].reportCount = 63;
  expect(() => session.flashFirmware(fresh, file, backups.save, () => {})).toThrow();
  expect(device.flashCount).toBe(0);
});

test('ownership prevents competing operations; a timed-out send receives no cleanup or automatic retry', async t => {
  const { session, device, store, target, backups } = await setup(undefined, { sendTimeout: 35 });
  await acceptRead(store);
  const gate = promiseGate(); t.onTestFinished(gate.resolve);
  device.firmwareSend = () => gate.promise;
  let state = initialFirmware();
  const token = target(), file = await syntheticFirmware();
  const run = session.flashFirmware(token, file, backups.save, value => { state = value; });
  await vi.waitFor(() => expect(state.attempted).toBe(true), { interval: 1 });
  await expect(session.read()).rejects.toThrow();
  await expect(session.authorize()).rejects.toThrow();
  await expect(session.disconnect()).rejects.toThrow();
  expect(session.selectDevice(token.id)).toBe(false);
  expect(await run).toMatchObject({ phase: 'failed', completed: 0, attempted: true });
  expect(device.flashCount).toBe(1);
  const before = device.sent.length;
  gate.resolve(); await Promise.resolve();
  await session.restore();
  expect(device.sent).toHaveLength(before);
});

test('manual verification rejects another keyboard already connected before flashing', async () => {
  const a = firmwareDevice(), b = firmwareDevice();
  const { session, store, target, hid, backups } = await setup([a, b]);
  await acceptRead(store);
  const token = target();
  a.firmwareSend = bytes => { if (bytes[2] === 5) hid.disconnect(a); };
  await session.flashFirmware(token, await syntheticFirmware(), backups.save, () => {});
  const before = b.sent.length;
  hid.selection = [b];
  await expect(session.verifyFirmware(token)).rejects.toThrow();
  expect(b.sent).toHaveLength(before);
});

test('unknown models are never offered firmware flashing', async () => {
  const { session, actions } = application(new FakeHID([new FakeDevice()]));
  await actions.start();
  expect(session.connectedDevices[0].firmwareFlash).toBe(false);
});

test('flashing an inactive device preserves both editors, unapplied input on the other device, and extended backup groups', async () => {
  const a = firmwareDevice(), b = firmwareDevice(9);
  const { session, store, actions, backups, hid } = await setup([a, b]);
  const [first, second] = session.connectedDevices;
  await acceptRead(store);
  actions.assignKey(45); actions.updateForm({ sequence: 'A' });
  const profileA = store.getState().profile?.toJSON(), draftsA = store.getState().drafts;
  const configure = actions.configureDevice(second.id); await acceptRead(store); await configure;
  actions.assignKey(46);
  const profileB = store.getState().profile?.toJSON();
  expect(session.selectDevice(first.id)).toBe(true);
  actions.openFirmware(second.id);
  expect(store.getState().firmware?.pendingInput).toBe(false);
  const digest = Uint8Array.from(stockFirmware.sha256.match(/../g)!, byte => parseInt(byte, 16));
  vi.spyOn(crypto.subtle, 'digest').mockResolvedValueOnce(digest.buffer);
  await actions.selectFirmwareFile(syntheticFirmwareFile());
  b.firmwareSend = bytes => { if (bytes[2] === 5) hid.disconnect(b); };
  await actions.startFirmware();
  expect(session.activeDeviceId).toBe(first.id);
  expect(session.hasLiveBaseline).toBe(true);
  expect(store.getState().profile?.toJSON()).toEqual(profileA);
  expect(store.getState().drafts).toEqual(draftsA);
  const result = store.getState().firmware!;
  expect((await backups.profile(result.state.backupId!)).records).toHaveLength(594);
  expect(result.state.phase).toBe('awaiting-reconnect');
  actions.closeFirmware();
  actions.resumeEditor(second.id);
  expect(store.getState().profile?.toJSON()).toEqual(profileB);
  expect(store.getState().canUndo).toBe(true);
});

test('controlled shutdown during packet pacing stops without another report or unlock', async () => {
  const { session, device, store, target, backups } = await setup(undefined, { firmwarePacketDelay: 100 });
  await acceptRead(store);
  const run = session.flashFirmware(target(), await syntheticFirmware(), backups.save, state => {
    if (state.completed === 1) void session.stop();
  });
  expect(await run).toMatchObject({ phase: 'failed', completed: 1, attempted: true });
  expect(device.flashCount).toBe(1);
  expect(device.sent.map(bytes => bytes[1])).not.toContain(0xd9);
});

test('an early disconnect stops before EOF and cannot enable version verification', async () => {
  const { session, device, store, target, backups, hid } = await setup();
  await acceptRead(store);
  const token = target();
  device.firmwareSend = () => { if (device.flashCount === 2) hid.disconnect(device); };
  expect(await session.flashFirmware(token, await syntheticFirmware(), backups.save, () => {})).toMatchObject({ phase: 'failed' });
  expect(device.flashCount).toBe(2);
  expect(session.firmwareCanVerify(token)).toBe(false);
});

test('a rejection after EOF during restart observation still fails and disables verification', async () => {
  const { session, device, store, target, backups } = await setup(undefined, { firmwareRestartTimeout: 100 });
  await acceptRead(store);
  const token = target();
  const run = session.flashFirmware(token, await syntheticFirmware(), backups.save, state => {
    if (state.phase === 'awaiting-restart') {
      const error = command(0x3a); error[2] = 0xa1; device.emit(error);
    }
  });
  expect(await run).toMatchObject({ phase: 'failed', completed: 3352 });
  expect(session.firmwareCanVerify(token)).toBe(false);
});

test('reconnected wrong-version devices and picker cancellation never receive firmware or report confirmation', async () => {
  const { session, device, store, target, backups, hid } = await setup();
  await acceptRead(store);
  const token = target();
  device.firmwareSend = bytes => { if (bytes[2] === 5) hid.disconnect(device); };
  await session.flashFirmware(token, await syntheticFirmware(), backups.save, () => {});
  hid.selection = [];
  await expect(session.verifyFirmware(token)).rejects.toThrow();
  expect(device.flashCount).toBe(3352);
  hid.selection = [device]; device.profile.version = '66EC(RGB)BLe;V1.5.0;V1.0;';
  await expect(session.verifyFirmware(token)).rejects.toThrow();
  expect(device.flashCount).toBe(3352);
  expect(session.pending).toBe(0);
  expect(session.authorizing).toBe(false);
});

test.each(['unexpected', 'malformed', 'report-id'] as const)('%s input stops before another firmware report', async kind => {
  const { session, device, store, target, backups } = await setup();
  await acceptRead(store);
  const token = target();
  device.firmwareSend = () => {
    const reply = kind === 'malformed' ? new Uint8Array(63) : command(0xf9);
    device.dispatchEvent(inputEvent(device, reply, kind === 'report-id' ? 1 : 0));
  };
  expect(await session.flashFirmware(token, await syntheticFirmware(), backups.save, () => {})).toMatchObject({
    phase: 'failed', completed: 1, error: { key: 'firmware.unexpectedReply' },
  });
  expect(device.flashCount).toBe(1);
  expect(session.firmwareCanVerify(token)).toBe(false);
});

test('the exact Mac firmware tuple can select a stock recovery package without sending firmware', async () => {
  const device = firmwareDevice();
  device.profile.version = '66EC(RGB)BLe;V1.5.1-F.1;V1.0;';
  const { session, target } = await setup([device]);
  expect(session.connectedDevices[0].firmwareFlash).toBe(true);
  expect(target().version).toBe(device.profile.version);
  expect((await syntheticFirmware()).version).toBe(stockFirmware.version);
  expect(device.flashCount).toBe(0);
});
