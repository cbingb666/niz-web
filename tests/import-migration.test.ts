import { expect, test } from 'vitest';
import { mergeImported, prepareImported, demoProfile, Profile } from '../src/protocol';
import { supportedModels } from '../src/devices';
import { MAC_NATIVE_VERSION, MAC_STOCK_VERSION } from '../src/mac-keycodes';
import { fixture, macro } from './helpers';

test.each(['66EC(S);V1.4.5;V1.0;', '66EC(S);V2.0.0;V1.0;'])('old JSON mappings migrate onto %s without copying opaque groups', version => {
  const source = fixture(9), target = fixture(3);
  target.version = version;
  source.setDefinition(0, macro({ keys: Array(70).fill(43), customDelay: 1, delays: Array(69).fill(15) }));
  const migrated = mergeImported(source, target);
  expect(migrated.version).toBe(version);
  expect(migrated.records).toHaveLength(198);
  expect(migrated.definition(0)).toEqual(source.definition(0));
  expect(migrated.identity).toEqual(target.identity);
  expect(migrated.counters).toEqual(target.counters);
});

test('migration preserves every target extension byte and reencodes editable packets', () => {
  const source = fixture(9), target = fixture(9);
  target.version = '66EC(S);V1.4.5;V1.0;';
  source.records[0][0][63] = 0xab;
  source.records[250][0][63] ^= 1;
  const migrated = mergeImported(source, target);
  expect(migrated.records[0][0][63]).toBe(0);
  expect(migrated.records.slice(198)).toEqual(target.records.slice(198));
  expect(source.records[0][0][63]).toBe(0xab);
});

test.each(supportedModels)('$name accepts mappings across firmware versions and rejects other models', model => {
  const source = demoProfile(model), target = source.clone();
  source.version = 'old firmware';
  target.version = 'new firmware';
  source.setDefinition(0, { type: 1, keys: [43, 44], interval: 40 });
  const result = prepareImported(Profile.fromJSON(source.toJSON()), target);
  expect(result.profile.definition(0)).toEqual(source.definition(0));
  expect(result.skipped).toEqual([]);
  const otherModel = supportedModels.find(candidate => candidate.id !== model.id)!;
  expect(() => prepareImported(source, demoProfile(otherModel))).toThrow(/型号/);
});

test.each([MAC_STOCK_VERSION, '66EC(RGB)BLe;V2.0;V1.0;'])('unsupported Mac actions on %s keep current values and identify every skipped layer', version => {
  const source = fixture(), target = fixture();
  source.version = MAC_NATIVE_VERSION;
  target.version = version;
  source.setDefinition(0, { type: 0, keys: [222] });
  source.setDefinition(66, macro({ keys: [43, 230] }));
  source.setDefinition(1, { type: 0, keys: [44] });
  const result = prepareImported(source, target);
  expect(result.skipped.map(skipped => skipped.index)).toEqual([0, 66]);
  expect(result.profile.definition(0)).toEqual(target.definition(0));
  expect(result.profile.definition(66)).toEqual(target.definition(66));
  expect(result.profile.definition(1)).toEqual(source.definition(1));
});

test('old reserved Mac codes are not reinterpreted as new actions on an upgrade', () => {
  const source = fixture(), target = fixture();
  source.version = MAC_STOCK_VERSION;
  target.version = MAC_NATIVE_VERSION;
  source.setDefinition(0, { type: 0, keys: [222] });
  expect(prepareImported(source, target).skipped.map(skipped => skipped.index)).toEqual([0]);
});

test('stock RGB mappings and its supported Mac codes migrate to F.1 on the correct target', () => {
  const source = fixture(3, true), target = fixture(9, true);
  source.version = MAC_STOCK_VERSION;
  target.version = MAC_NATIVE_VERSION;
  target.identity = { VendorID: 0x0483, ProductID: 0x542a };
  source.setDefinition(0, { type: 0, keys: [207] });
  source.setDefinition(1, { type: 0, keys: [43] });
  const result = prepareImported(source, target);
  expect(result.skipped).toEqual([]);
  expect(result.profile.definition(0).keys).toEqual([207]);
  expect(result.profile.definition(1).keys).toEqual([43]);
  expect(result.profile.version).toBe(MAC_NATIVE_VERSION);
  expect(result.profile.lights).toEqual(source.lights);
  target.identity.ProductID = 0x522a;
  expect(prepareImported(source, target).skipped.map(skipped => skipped.index)).toEqual([0]);
});

test('a skipped mapping at a current Fn position preserves all its layers', () => {
  const source = fixture(), target = fixture();
  source.version = MAC_NATIVE_VERSION;
  target.version = MAC_STOCK_VERSION;
  source.setDefinition(54, { type: 0, keys: [222] });
  source.setDefinition(120, { type: 0, keys: [43] });
  source.setDefinition(186, { type: 0, keys: [44] });
  const result = prepareImported(source, target);
  expect(result.skipped.map(skipped => skipped.index)).toEqual([54, 120, 186]);
  for (const index of [54, 120, 186]) expect(result.profile.records[index]).toEqual(target.records[index]);
  expect(() => result.profile.validateForWriting()).not.toThrow();
});

test('lighting migrates only between RGB configurations; current metadata stays with the device', () => {
  const source = fixture(3, true), target = fixture(9, true);
  target.version = '66EC(RGB);V2;V1;';
  target.identity = { Product: 'Current device' };
  target.counters.fill(99);
  source.lights!.fill(20);
  source.legacyXML = '<old-firmware-settings />';
  let result = prepareImported(source, target);
  expect(result.profile.lights).toEqual(source.lights);
  expect(result.profile.lights).not.toBe(source.lights);
  expect(result.profile.legacyXML).toBe(target.legacyXML);
  expect(result.profile.identity).toEqual(target.identity);
  expect(result.profile.counters).toEqual(target.counters);
  target.version = '66EC(S);V2;V1;';
  target.lights = null;
  result = prepareImported(source, target);
  expect(result.lightsSkipped).toBe(true);
  expect(result.profile.lights).toBeNull();
});

test('offline imports retain source version and unencodable mappings keep current values', () => {
  const source = fixture(), target = fixture();
  expect(prepareImported(source, null).migrated).toBe(false);
  expect(prepareImported(source, null).profile.toJSON()).toEqual(source.toJSON());
  source.setDefinition(0, macro());
  source.records[0][0][5] = 0;
  target.version = '66EC(S);V2;V1;';
  const result = prepareImported(source, target);
  expect(result.skipped.map(skipped => skipped.index)).toEqual([0]);
  expect(result.profile.definition(0)).toEqual(target.definition(0));
});

test('unrecognized action codes are reported instead of copied across firmware versions', () => {
  const source = fixture(), target = fixture();
  source.setDefinition(0, { type: 0, keys: [255] });
  target.version = '66EC(S);V2;V1;';
  const result = prepareImported(source, target);
  expect(result.skipped).toMatchObject([{ index: 0, reason: { key: 'importMigration.unknownAction' } }]);
  expect(result.profile.definition(0)).toEqual(target.definition(0));
});
