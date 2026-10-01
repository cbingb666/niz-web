import { expect, onTestFinished, test, vi } from 'vitest';
import { identifyModel } from '../src/devices';
import { atom68 } from '../src/devices/atom68/model';
import { HIDSession, validateDescriptor } from '../src/hid';
import { Profile, encodeDefinition, mergeImported } from '../src/protocol';
import type { OperationProgress } from '../src/types/hid';
import { atom68Fixture } from './atom68-fixture';
import { FakeDevice, FakeHID, fixture } from './helpers';

test('ATOM68 identity requires its official PID, firmware family and configuration collection', () => {
  const device = new FakeDevice(atom68Fixture());
  for (const productId of [0x5032, 0x5132, 0x5232, 0x5332]) {
    device.productId = productId;
    for (const family of ['68EC(S)', '68EC(S)BLe', '68EC(XRGB)', '68EC(XRGB)BLe'])
      expect(identifyModel(device, `${family};V1.4.1;V1.0;`)).toBe(atom68);
    for (const version of ['66EC(S);V1.4.4;', '68pro(S);V1.0;', '68EC(UNKNOWN);V1;', '68EC(S)other;V1;'])
      expect(identifyModel(device, version)).toBeNull();
  }
  for (const productId of [0x522a, 0x5432, 0x5532, 0x5632, 0x5732]) {
    device.productId = productId;
    expect(identifyModel(device, '68EC(S);V1.4.1;V1.0;')).toBeNull();
  }
  device.productId = 0x5232;
  device.collections[0].outputReports![0].reportId = 1;
  expect(() => validateDescriptor(device)).toThrow();
  device.collections[0].usagePage = 1;
  expect(identifyModel(device, '68EC(S);V1.4.1;V1.0;')).toBeNull();
});

test('the official 68-key layout and six-group address range preserve all opaque groups', () => {
  expect(atom68.rows.map(row => row.length)).toEqual([15, 15, 14, 14, 10]);
  expect([atom68.keyCount, atom68.editableRecords, atom68.maxRecords]).toEqual([68, 204, 408]);
  expect([13, 14, 28, 29, 43, 56, 57, 61, 62, 63, 67].map(key => atom68.keys[key].label))
    .toEqual(['⌫', '`', '\\', 'PgUp', 'PgDn', '↑', 'End', 'Space', 'Alt', 'Fn', '→']);
  const profile = atom68Fixture();
  expect(profile.records[407][0].slice(2, 4)).toEqual(new Uint8Array([6, 68]));
  expect(Profile.fromReports(profile.reports, atom68).reports).toEqual(profile.reports);
  expect(() => Profile.fromReports(profile.reports.slice(0, -1), atom68)).toThrow();
  expect(() => Profile.fromReports(fixture().reports, atom68)).toThrow();
  expect(() => encodeDefinition({ type: 0, keys: [43] }, 408, atom68)).toThrow();
  profile.setDefinition(67, { type: 0, keys: [166] });
  expect([67, 135, 203].map(index => profile.definition(index).keys)).toEqual([[166], [166], [166]]);
  profile.validateForWriting();
  expect(profile.records.slice(204)).toEqual(atom68Fixture().records.slice(204));
  const rawChanged = profile.clone();
  rawChanged.records[407][0][63] ^= 1;
  expect(rawChanged.differences(profile)).toEqual([407]);
});

test('ATOM68 JSON and imports enforce model ownership and retain six-group baselines', () => {
  const baseline = atom68Fixture(6, true), imported = atom68Fixture(3, true);
  const data = baseline.toJSON();
  expect(data).toMatchObject({ format: 'niz-web', schema: 1, model: 'atom68' });
  expect(Profile.fromJSON(JSON.stringify(data)).toJSON()).toEqual(data);
  for (const patch of [{ model: undefined }, { model: 'atom66' }, { counters: Array(66).fill(0) }, { lights: '00'.repeat(198) }])
    expect(() => Profile.fromJSON({ ...data, ...patch })).toThrow();
  imported.setDefinition(67, { type: 0, keys: [44] });
  const merged = mergeImported(imported, baseline);
  expect(merged.groupCount).toBe(6);
  expect(merged.differences(baseline)).toEqual([67]);
  expect(merged.records.slice(204)).toEqual(baseline.records.slice(204));
  expect(() => mergeImported(imported, fixture())).toThrow(/型号/);
});

test.each([false, true])('ATOM68 simulated reads and backed-up writes use 68-key lengths (RGB: %s)', async (rgb) => {
  const device = new FakeDevice(atom68Fixture(6, rgb));
  const session = new HIDSession(new FakeHID([device]), { retryMs: 60_000 });
  onTestFinished(() => session.stop());
  await session.start();
  expect(session.model).toBe(atom68);
  expect(device.sent.map(packet => packet[1])).toEqual([0xf9]);
  expect(session.connectedDevices[0].calibration).toBe('unsupported');
  const { profile } = await session.read();
  expect(profile.counters).toHaveLength(68);
  expect(profile.lights?.length ?? 0).toBe(rgb ? 204 : 0);
  expect(session.lastCapture).toMatchObject({ format: 'niz-read-capture', model: 'atom68' });
  const target = profile.clone();
  target.setDefinition(67, { type: 2, keys: Array(80).fill(44), cycles: 2, interval: 30, customDelay: 0 });
  if (target.lights) target.lights.set([1, 2, 3], 201);
  const backup = vi.fn(async (saved: Profile) => {
    expect(saved.model).toBe(atom68);
    expect(saved.reports).toEqual(profile.reports);
    expect(saved.version).toBe(profile.version);
    expect(saved.lights).toEqual(profile.lights);
    expect(device.sent.some(packet => packet[1] === 0xf1)).toBe(false);
    return 'saved';
  });
  const progress: OperationProgress[] = [];
  await session.write(target, backup, (event) => progress.push(event));
  expect(backup).toHaveBeenCalledOnce();
  expect(device.profile.differences(target)).toEqual([]);
  expect(device.profile.lights).toEqual(target.lights);
  expect(device.profile.records.slice(204)).toEqual(profile.records.slice(204));
  expect(progress).toContainEqual({ phase: 'write', transfer: { completed: 409, total: 409, unit: 'packets' } });
  expect(device.sent.filter(packet => packet[1] === 0xf2)).toHaveLength(3);
  const before = device.sent.length;
  await expect(session.write(fixture(), backup)).rejects.toThrow(/型号/);
  expect(device.sent).toHaveLength(before);
});

test('ATOM68 write verification rejects corruption in an opaque sixth-group byte', async (t) => {
  const device = new FakeDevice(atom68Fixture());
  const session = new HIDSession(new FakeHID([device]), { retryMs: 60_000 });
  t.onTestFinished(() => session.stop());
  await session.start();
  const { profile } = await session.read();
  const target = profile.clone();
  target.setDefinition(67, { type: 0, keys: [44] });
  const send = device.sendReport.bind(device);
  vi.spyOn(device, 'sendReport').mockImplementation(async (id, packet) => {
    await send(id, packet);
    if (packet[1] === 0xf6) device.profile.records[407][0][63] ^= 1;
  });
  await expect(session.write(target, async () => 'saved')).rejects.toThrow(/写后回读不一致/);
  expect(session.lastRead).toBeNull();
});
