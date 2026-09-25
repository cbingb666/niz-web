import { expect, test, vi } from 'vitest';
import { defaultModel, supportedModels, deviceFilters, identifyModel } from '../src/devices';
import { defineModel } from '../src/devices/model';
import { EditorState } from '../src/editor';
import { HIDSession, isConfigDevice } from '../src/hid';
import { modelTools } from '../src/model-tools';
import { Profile, demoProfile, encodeDefinition, mergeImported } from '../src/protocol';
import { FakeDevice, FakeHID, fixture } from './helpers';
import { modelFixture, test68 } from './model-fixtures';

test('only Atom66 is registered; existing files and backups retain their exact format', () => {
  expect(supportedModels.map((model) => model.id)).toEqual(['atom66']);
  const original = fixture(9, true).toJSON();
  expect(original.format).toBe('atom66-macos');
  expect(original).not.toHaveProperty('model');
  const restored = Profile.fromJSON(JSON.stringify(original));
  expect(restored.model).toBe(defaultModel);
  expect(restored.toJSON()).toEqual(original);
  expect(() => Profile.fromJSON({ ...original, model: 'test-68' })).toThrow(/型号/);
});

test('shared USB IDs require an unambiguous firmware match; unknown devices remain excluded', () => {
  const models = [defaultModel, test68];
  const device = new FakeDevice(modelFixture());
  expect(deviceFilters(models)).toHaveLength(defaultModel.filters.length);
  expect(identifyModel(device, device.profile.version, models)).toBe(test68);
  expect(identifyModel(device, fixture().version, models)).toBe(defaultModel);
  expect(identifyModel(device, 'UNKNOWN;', models)).toBeNull();
  expect(identifyModel(device, device.profile.version, [test68, { ...test68, id: 'ambiguous' }])).toBeNull();
  device.collections[0].usagePage = 1;
  expect(isConfigDevice(device, models)).toBe(false);
  expect(identifyModel(device, device.profile.version, models)).toBeNull();
});

test('model definitions reject geometries outside the EC packet address range', () => {
  expect(() => defineModel({ ...test68, rows: [Array(256).fill({ label: 'X', width: 1 })] })).toThrow();
  expect(() => defineModel({ ...test68, groupCounts: [1] })).toThrow();
});

test('another geometry round-trips all groups, validates addresses and synchronizes its Fn layers', () => {
  const profile = modelFixture(test68, 4);
  profile.setDefinition(66, { type: 0, keys: [156] });
  expect(profile.definition(134).keys).toEqual([156]);
  expect(profile.definition(66).keys).toEqual([156]);
  expect(profile.records[134][0].slice(2, 4)).toEqual(new Uint8Array([2, 67]));
  profile.validateForWriting();
  const restored = Profile.fromReports(profile.reports, test68);
  expect(restored.groupCount).toBe(4);
  expect(restored.reports).toEqual(profile.reports);
  expect(() => Profile.fromReports(profile.reports.slice(0, -1), test68)).toThrow();
  const badKey = profile.reports;
  badKey[0][3] = 69;
  expect(() => Profile.fromReports(badKey, test68)).toThrow();
  expect(() => encodeDefinition({ type: 0, keys: [] }, 272, test68)).toThrow();
  profile.setDefinition(134, { type: 0, keys: [43] });
  expect(() => profile.validateForWriting()).toThrow(/Fn/);
});

test('new profiles require a registered model and validate its counter and RGB lengths', () => {
  const data = modelFixture().toJSON();
  expect(data).toMatchObject({ format: 'niz-web', schema: 1, model: test68.id });
  expect(() => Profile.fromJSON(data)).toThrow(/型号/);
  for (const patch of [{ model: undefined }, { model: 'unknown' }, { counters: Array(66).fill(0) }, { lights: '00'.repeat(198) }])
    expect(() => Profile.fromJSON({ ...data, ...patch }, [test68])).toThrow();
  expect(Profile.fromJSON(JSON.stringify(data), [test68]).toJSON()).toEqual(data);
  expect(modelFixture().clone().model).toBe(test68);
});

test('imports preserve opaque groups and reject a different model even with identical firmware and geometry', () => {
  const baseline = modelFixture(test68, 4), imported = modelFixture();
  imported.setDefinition(66, { type: 0, keys: [44] });
  const merged = mergeImported(imported, baseline);
  expect(merged.groupCount).toBe(4);
  expect(merged.differences(baseline)).toEqual([66]);
  expect(merged.records.slice(136)).toEqual(baseline.records.slice(136));
  const other = modelFixture(defineModel({ ...test68, id: 'other' }), 4);
  expect(other.version).toBe(baseline.version);
  expect(() => mergeImported(other, baseline)).toThrow(/型号/);
  expect(() => baseline.differences(other)).toThrow(/型号/);
  const rawChanged = baseline.clone();
  rawChanged.records[200][0][63] ^= 1;
  expect(rawChanged.differences(baseline)).toEqual([200]);
});

test('editor indices, atomic batch limits, colors and selection follow the loaded model', () => {
  const editor = new EditorState();
  editor.load(modelFixture(test68, 4));
  editor.select(67, 1);
  expect(editor.index).toBe(135);
  editor.color('#123456', true);
  expect(editor.profile?.lights?.slice(-3)).toEqual(new Uint8Array([18, 52, 86]));
  const before = editor.profile?.toJSON();
  expect(() => editor.applyDefinitions([
    { index: 66, definition: { type: 0, keys: [45] } },
    { index: 136, definition: { type: 0, keys: [44] } },
  ])).toThrow();
  expect(editor.profile?.toJSON()).toEqual(before);
  expect(() => editor.select(68)).toThrow();
  expect(() => editor.select(0, 2)).toThrow();
  expect(editor.index).toBe(135);
  const small = defineModel({ ...test68, id: 'small', rows: [test68.rows[0].slice(0, 4)], layers: ['Only'], groupCounts: [1], fn: { codes: [], required: false }, demoKeys: [[43, 44, 45, 46]] });
  editor.load(demoProfile(small));
  expect([editor.key, editor.layer]).toEqual([3, 0]);
  expect(() => editor.profile?.validateForWriting()).not.toThrow();
});

test('page tools expose the loaded model and use its geometry for schemas and edits', () => {
  const editor = new EditorState();
  editor.load(modelFixture());
  const tools = modelTools({ editor, session: { state: 'waiting', version: '' }, canStage: () => true, onStaged: vi.fn() }, 'en');
  expect(tools[0].execute({})).toMatchObject({ model: 'test-68', keyCount: 68, layers: ['Primary', 'Function'] });
  expect(tools[1].inputSchema).toMatchObject({ properties: { layer: { maximum: 1 }, keys: { maxItems: 68, items: { maximum: 67 } } } });
  expect(tools[2].inputSchema).toMatchObject({ properties: { edits: { maxItems: 136, items: { properties: { cycles: { maximum: 255 }, interval: { maximum: 65535 } } } } } });
  tools[2].execute({ edits: [{ layer: 1, key: 66, type: 0, sequence: 'C' }] });
  expect(editor.profile?.definition(134).keys).toEqual([58]);
  expect(() => tools[1].execute({ layer: 2, keys: [0] })).toThrow();
});

test('session reads and writes another geometry with its capabilities and preserves extension bytes', async (t) => {
  const device = new FakeDevice(modelFixture(test68, 4)), hid = new FakeHID([device]);
  const session = new HIDSession(hid, { models: [defaultModel, test68], retryMs: 60_000 });
  t.onTestFinished(() => session.stop());
  await session.start();
  expect(session.model).toBe(test68);
  const { profile } = await session.read();
  expect(profile.counters).toHaveLength(68);
  expect(profile.lights).toHaveLength(204);
  expect(session.lastCapture).toMatchObject({ format: 'niz-read-capture', model: test68.id });
  const target = profile.clone();
  target.setDefinition(66, { type: 0, keys: [44] });
  target.lights!.set([1, 2, 3], 67 * 3);
  const backup = vi.fn(async () => 'saved');
  await session.write(target, backup);
  expect(backup).toHaveBeenCalledOnce();
  expect(device.profile.differences(target)).toEqual([]);
  expect(device.profile.lights).toEqual(target.lights);
  expect(device.profile.records.slice(136)).toEqual(profile.records.slice(136));
  const other = modelFixture(defineModel({ ...test68, id: 'other' }), 4);
  const commands = device.sent.length;
  await expect(session.write(other, backup)).rejects.toThrow(/型号/);
  expect(device.sent).toHaveLength(commands);
});

test('capability flags suppress unsupported reads, regardless of firmware text', async (t) => {
  const model = defineModel({ ...test68, capabilities: () => ({ counters: false, perKeyRGB: false }) });
  const device = new FakeDevice(modelFixture(model));
  device.profile.version += ';RGB';
  const session = new HIDSession(new FakeHID([device]), { models: [model], retryMs: 60_000 });
  t.onTestFinished(() => session.stop());
  await session.start();
  const { profile } = await session.read();
  expect(device.sent.map((packet) => packet[1])).toEqual([0xf9, 0xf2]);
  expect(profile.counters).toEqual([]);
  expect(profile.lights).toBeNull();
});

test('a matching USB device with unknown firmware never reaches configuration commands', async (t) => {
  const device = new FakeDevice(modelFixture());
  const session = new HIDSession(new FakeHID([device]), { retryMs: 60_000 });
  t.onTestFinished(() => session.stop());
  await session.start();
  expect(session.state).toBe('error');
  expect(session.model).toBeNull();
  expect(device.sent.map((packet) => packet[1])).toEqual([0xf9]);
  expect(device.opened).toBe(false);
});
