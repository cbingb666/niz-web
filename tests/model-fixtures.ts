import { atom66 } from '../src/devices/atom66/model';
import { defineModel, type KeyboardModel } from '../src/devices/model';
import { demoProfile, encodeDefinition } from '../src/protocol';

// Deliberately fictional: exercises another geometry on the existing protocol
// without claiming support for any untested physical keyboard.
export const test68 = defineModel({
  id: 'test-68',
  name: 'Fixture68',
  protocol: 'niz-ec',
  filters: atom66.filters,
  matchesFirmware: (version) => version.startsWith('TEST68;'),
  capabilities: (version) => ({ counters: true, perKeyRGB: version.includes('COLOR') }),
  rows: [35, 33].map((count, row) => Array.from({ length: count }, (_, column) => ({
    label: `K${(row ? 35 : 0) + column + 1}`, width: 1,
  }))),
  layers: ['Primary', 'Function'],
  groupCounts: [2, 4],
  fn: { codes: [156], required: true },
  demoKeys: [Array.from({ length: 68 }, (_, key) => key === 67 ? 156 : 43)],
});

export function modelFixture(model: KeyboardModel = test68, groups = model.layers.length) {
  const profile = demoProfile(model);
  profile.version = 'TEST68;COLOR;1';
  for (let index = model.editableRecords; index < groups * model.keyCount; index++) {
    const records = encodeDefinition({ type: 0, keys: [] }, index, model);
    records[0][63] = 0xa7;
    profile.records.push(records);
  }
  if (model.capabilities(profile.version).counters)
    profile.counters = Array.from({ length: model.keyCount }, (_, key) => key * 100);
  if (model.capabilities(profile.version).perKeyRGB)
    profile.lights = Uint8Array.from({ length: model.keyCount * 3 }, (_, index) => index % 256);
  return profile;
}
