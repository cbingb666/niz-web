import { expect, onTestFinished, test, vi } from 'vitest';
import { identifyModel } from '../src/devices';
import { micro82 } from '../src/devices/micro82/model';
import { micro84 } from '../src/devices/micro84/model';
import { HIDSession, validateDescriptor } from '../src/hid';
import { Profile, encodeDefinition, mergeImported } from '../src/protocol';
import type { OperationProgress } from '../src/types/hid';
import { FakeDevice, FakeHID, fixture } from './helpers';
import { microFixture, microModels } from './micro-fixture';

test.each(microModels)('$name identification requires official USB IDs, firmware family and reports', (model) => {
  const prefix = model === micro82 ? '82' : '84';
  const families = model === micro82 ? ['S', 'S)BLe', 'XRGB', 'XRGB)BLe'] : ['S', 'S)BLe', 'XRGB)BLe'];
  const device = new FakeDevice(microFixture(model));
  for (const filter of model.filters) {
    device.productId = filter.productId;
    for (const family of families) {
      const version = `${prefix}EC(${family.includes(')') ? family : family + ')'};V1.4.1;V1.0;`;
      expect(identifyModel(device, version)).toBe(model);
    }
    for (const version of ['66EC(S);V1;', '68EC(S);V1;', '82pro(S);V1;', '84pro(S);V1;', `${prefix}EC(UNKNOWN);V1;`, `${prefix}EC(S)other;V1;`])
      expect(identifyModel(device, version)).toBeNull();
    expect(identifyModel(device, `${model === micro82 ? '84' : '82'}EC(S);V1;`)).toBeNull();
  }
  device.productId = 0x522a;
  expect(identifyModel(device, device.profile.version)).toBeNull();
  device.productId = model.filters[0].productId;
  device.collections[0].inputReports![0].reportId = 1;
  expect(() => validateDescriptor(device)).toThrow();
  device.collections[0].usagePage = 1;
  expect(identifyModel(device, device.profile.version)).toBeNull();
  expect(identifyModel(new FakeDevice(microFixture(micro84)), '84EC(XRGB);V1;')).toBeNull();
});

test.each(microModels)('$name wire IDs, Fn synchronization and file ownership follow its own geometry', model => {
  const profile = microFixture(model, true);
  expect(model.rows.map(row => row.length)).toEqual([14, 15, 15, 14, 14, model === micro82 ? 10 : 12]);
  expect(model.rows.map(row => row.reduce((sum, key) => sum + key.width + (key.gapBefore ?? 0), 0))).toEqual(Array(6).fill(16));
  expect(model.keys.slice(72).map(key => key.label)).toEqual(model === micro82
    ? ['Ctrl', 'Win', 'Alt', 'Space', 'Alt', 'Fn', 'Ctrl', '←', '↓', '→']
    : ['Ctrl', 'Win', 'Alt', 'L Fn', 'Space', 'R Fn', 'Alt', 'Menu', 'Ctrl', '←', '↓', '→']);
  expect(profile.records.at(-1)![0].slice(2, 4)).toEqual(new Uint8Array([3, model.keyCount]));
  expect(Profile.fromReports(profile.reports, model).reports).toEqual(profile.reports);
  expect(() => Profile.fromReports(profile.reports.slice(0, -1), model)).toThrow();
  const invalid = profile.reports;
  invalid[0][3] = model.keyCount + 1;
  expect(() => Profile.fromReports(invalid, model)).toThrow();
  expect(() => encodeDefinition({ type: 0, keys: [43] }, model.maxRecords, model)).toThrow();
  profile.setDefinition(model.keyCount - 1, { type: 0, keys: [166] });
  expect([0, 1, 2].map(layer => profile.definition((layer + 1) * model.keyCount - 1).keys)).toEqual([[166], [166], [166]]);
  profile.validateForWriting();
  const data = profile.toJSON();
  expect(data).toMatchObject({ format: 'niz-web', schema: 1, model: model.id });
  expect(Profile.fromJSON(JSON.stringify(data)).toJSON()).toEqual(data);
  for (const patch of [{ model: undefined }, { model: model === micro82 ? 'micro84' : 'micro82' }, { counters: Array(66).fill(0) }, { lights: '00'.repeat(198) }])
    expect(() => Profile.fromJSON({ ...data, ...patch })).toThrow();
  expect(() => mergeImported(profile, microFixture(model === micro82 ? micro84 : micro82))).toThrow(/型号/);
});

test.each(microModels.flatMap(model => [false, true].map(rgb => ({ model, rgb }))))('$model.name simulated read and write preserve model lengths and the backup transaction (RGB: $rgb)', async ({ model, rgb }) => {
  const device = new FakeDevice(microFixture(model, rgb));
  const session = new HIDSession(new FakeHID([device]), { retryMs: 60_000 });
  onTestFinished(() => session.stop());
  await session.start();
  expect(session.model).toBe(model);
  expect(device.sent.map(packet => packet[1])).toEqual([0xf9]);
  expect(session.connectedDevices[0].calibration).toBe('unsupported');
  const { profile } = await session.read();
  expect(profile.counters).toHaveLength(model.keyCount);
  expect(profile.lights?.length ?? 0).toBe(rgb ? model.keyCount * 3 : 0);
  expect(session.lastCapture).toMatchObject({ format: 'niz-read-capture', model: model.id });
  const target = profile.clone();
  target.setDefinition(model.keyCount - 1, { type: 2, keys: Array(80).fill(44), cycles: 2, interval: 30, customDelay: 0 });
  target.lights?.set([1, 2, 3], (model.keyCount - 1) * 3);
  const backup = vi.fn(async (saved: Profile) => {
    expect(saved.model).toBe(model);
    expect(saved.reports).toEqual(profile.reports);
    expect(saved.version).toBe(profile.version);
    expect(saved.lights).toEqual(profile.lights);
    expect(device.sent.some(packet => packet[1] === 0xf1)).toBe(false);
    return 'saved';
  });
  const progress: OperationProgress[] = [];
  await session.write(target, backup, event => progress.push(event));
  expect(backup).toHaveBeenCalledOnce();
  expect(device.profile.differences(target)).toEqual([]);
  expect(device.profile.lights).toEqual(target.lights);
  expect(progress).toContainEqual({ phase: 'write', transfer: { completed: model.editableRecords + 1, total: model.editableRecords + 1, unit: 'packets' } });
  expect(device.sent.filter(packet => packet[1] === 0xf2)).toHaveLength(3);
  const before = device.sent.length;
  await expect(session.write(fixture(), backup)).rejects.toThrow(/型号/);
  await expect(session.write(microFixture(model === micro82 ? micro84 : micro82), backup)).rejects.toThrow(/型号/);
  expect(device.sent).toHaveLength(before);
});

test.each(microModels)('$name refuses to write after backup failure and detects corrupt readback', async model => {
  const device = new FakeDevice(microFixture(model));
  const session = new HIDSession(new FakeHID([device]), { retryMs: 60_000 });
  onTestFinished(() => session.stop());
  await session.start();
  const { profile } = await session.read();
  const target = profile.clone();
  target.setDefinition(model.keyCount - 1, { type: 0, keys: [44] });
  await expect(session.write(target, async () => { throw new Error('backup failed'); })).rejects.toThrow('backup failed');
  expect(device.sent.some(packet => packet[1] === 0xf1)).toBe(false);
  device.corruptReadback = true;
  await expect(session.write(target, async () => 'saved')).rejects.toThrow(/写后回读不一致/);
  expect(session.lastRead).toBeNull();
});
