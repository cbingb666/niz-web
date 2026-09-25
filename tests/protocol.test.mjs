import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  Profile,
  PHYSICAL_KEYS,
  ROW_WIDTHS,
  parseKey,
  encodeDefinition,
  decodeDefinition,
  hex,
  unhex,
  parseSequence,
  sequenceText,
  mergeImported,
  equalBytes,
} from '../src/protocol.ts';
import { EditorState } from '../src/editor.ts';
import { fixture, macro } from './helpers.ts';

test('physical layout has exactly 66 keys in five rows', () => {
  assert.equal(PHYSICAL_KEYS.length, 66);
  assert.deepEqual(
    ROW_WIDTHS.map((row) => row.length),
    [15, 14, 13, 13, 11],
  );
});
test('key names are distinct from explicit numeric wire codes', () => {
  for (const [text, value] of [
    ['1', 15],
    ['#1', 1],
    ['0x44', 68],
    ['Command', 68],
    ['C', 58],
    ['右 Fn', 156],
    ['左 Fn · #166', 166],
    ['ISO \\ / |', 204],
  ])
    assert.equal(parseKey(text), value);
  for (const invalid of ['#256', 'unknown', '-1', '0x100']) assert.throws(() => parseKey(invalid));
});
test('single, chord and repeat packets match native golden vectors', () => {
  assert.equal(hex(encodeDefinition({ type: 0, keys: [68, 58] }, 0)[0].slice(0, 10)), '00f001010002443a0000');
  assert.equal(
    hex(encodeDefinition({ type: 1, keys: [43, 44], interval: 0x1234 }, 67)[0].slice(0, 12)),
    '00f00202011234022b2c0000',
  );
  assert.equal(hex(encodeDefinition({ type: 0, keys: [] }, 593)[0].slice(0, 8)), '00f0094200000000');
});
test('macro header uses big-endian sizes and exact mode values', () => {
  assert.equal(hex(encodeDefinition(macro(), 132)[0].slice(0, 16)), '00f00301020300001e00032b2c2d0000');
  for (const type of [2, 3, 4]) {
    const def = macro({ type, cycles: type === 2 ? 3 : 0 });
    assert.deepEqual(decodeDefinition(encodeDefinition(def, 1)), def);
  }
});
test('custom delay markers match native wire format and have no trailing delay', () => {
  const def = macro({ keys: [68, 58], customDelay: 1, delays: [500], interval: 0 });
  assert.equal(hex(encodeDefinition(def, 0)[0].slice(9, 16)), '000544c801f43a');
  assert.deepEqual(decodeDefinition(encodeDefinition(def, 0)), def);
  assert.throws(() => encodeDefinition({ ...def, delays: [500, 2] }, 0));
});
for (const length of [1, 52, 53, 54, 106, 107, 2048])
  test(`macro round trip at ${length} keys including packet boundaries`, () => {
    const def = macro({ keys: Array.from({ length }, (_, i) => 20 + (i % 90)) });
    const reports = encodeDefinition(def, 0);
    assert.equal(reports.length, Math.ceil(length / 53));
    assert.deepEqual(decodeDefinition(reports), def);
  });
for (const length of [1, 14, 15, 28, 2048])
  test(`custom macro round trip at ${length} keys`, () => {
    const def = macro({
      keys: Array(length).fill(43),
      customDelay: 1,
      delays: Array(Math.max(0, length - 1)).fill(65535),
    });
    assert.deepEqual(decodeDefinition(encodeDefinition(def, 0)), def);
  });
test('invalid sizes and numbers cannot enter an encoded configuration', () => {
  for (const def of [
    { type: 0, keys: Array(59).fill(1) },
    { type: 1, keys: Array(57).fill(1), interval: 30 },
    { type: 1, keys: [1], interval: -1 },
    macro({ cycles: 0 }),
    macro({ keys: Array(2049).fill(1) }),
    macro({ keys: [256] }),
    macro({ interval: NaN }),
  ])
    assert.throws(() => encodeDefinition(def, 0));
  assert.throws(() => encodeDefinition({ type: 0, keys: [1] }, 594));
});
test('complete three and nine groups parse, clone and round-trip JSON without raw-byte loss', () => {
  for (const count of [3, 9]) {
    const p = fixture(count, true);
    p.setDefinition(20, macro({ keys: Array(66).fill(43) }));
    p.legacyXML = '<original/>';
    const clone = Profile.fromJSON(JSON.stringify(p.toJSON()));
    assert.equal(clone.groupCount, count);
    assert.deepEqual(clone.toJSON(), p.toJSON());
    assert.deepEqual(p.differences(clone), []);
    p.validateForWriting();
  }
});
test('parse rejects partial, duplicate, unsupported and malformed records', () => {
  const reports = fixture(9).reports;
  assert.throws(() => Profile.fromReports(reports.slice(0, -1)));
  assert.throws(() => Profile.fromReports(reports.slice(0, 264)));
  const duplicate = reports.slice();
  duplicate[20] = duplicate[19];
  assert.throws(() => Profile.fromReports(duplicate));
  for (const [offset, value] of [
    [0, 1],
    [1, 0xe0],
    [2, 10],
    [3, 0],
    [4, 5],
    [5, 59],
  ]) {
    const invalid = reports.map((b) => b.slice());
    invalid[0][offset] = value;
    assert.throws(() => Profile.fromReports(invalid));
  }
  const invalid = reports.slice();
  invalid[0] = new Uint8Array(65);
  assert.throws(() => Profile.fromReports(invalid));
});
test('multi-packet record headers and truncation are validated', () => {
  const p = fixture();
  p.setDefinition(0, macro({ keys: Array(54).fill(43) }));
  const r = p.reports;
  const invalid = r.map((b) => b.slice());
  invalid[1][3] = 2;
  assert.throws(() => Profile.fromReports(invalid));
  assert.throws(() => Profile.fromReports(r.slice(1)));
  const custom = fixture();
  custom.setDefinition(0, macro({ customDelay: 1, delays: [10, 20] }));
  const bad = custom.reports;
  bad[0][12] = 201;
  assert.throws(() => Profile.fromReports(bad));
});
test('Fn assignments synchronize all editable layers and writing requires an Fn', () => {
  const p = fixture();
  p.setDefinition(16, { type: 0, keys: [156] });
  for (const layer of [0, 1, 2]) assert.deepEqual(p.definition(layer * 66 + 16).keys, [156]);
  p.setDefinition(66 + 16, { type: 0, keys: [43] });
  assert.throws(() => p.validateForWriting());
  const q = fixture();
  q.setDefinition(54, { type: 0, keys: [43] });
  q.setDefinition(58, { type: 0, keys: [43] });
  assert.throws(() => q.validateForWriting());
});
test('three-group import preserves every extension byte from the live nine-group baseline', () => {
  const baseline = fixture(9),
    imported = fixture(3);
  imported.setDefinition(0, { type: 0, keys: [43] });
  const merged = mergeImported(imported, baseline);
  assert.equal(merged.groupCount, 9);
  assert.deepEqual(merged.reports.slice(198), baseline.reports.slice(198));
  assert.deepEqual(merged.differences(baseline), [0]);
  imported.version = 'other';
  assert.throws(() => mergeImported(imported, baseline));
  assert.throws(() => mergeImported(fixture(9), fixture(3)));
});
test('non-RGB device imports preserve device lighting state', () => {
  const baseline = fixture(9),
    imported = fixture(3);
  imported.lights = new Uint8Array(198);
  assert.equal(mergeImported(imported, baseline).lights, null);
  assert.equal(equalBytes(null, null), true);
  assert.equal(equalBytes(null, new Uint8Array()), false);
});
test('opaque extension changes are detected even outside decoded key fields', () => {
  const baseline = fixture(9),
    changed = baseline.clone();
  changed.records[250][0][63] ^= 1;
  assert.deepEqual(changed.differences(baseline), [250]);
});
test('JSON and hex validation rejects diagnostics, corruption and invalid metadata', () => {
  for (const text of ['a', 'ag', 'xx', '001x']) assert.throws(() => unhex(text));
  assert.deepEqual(unhex('00F0'), new Uint8Array([0, 240]));
  const data = fixture().toJSON();
  for (const patch of [
    { format: 'atom66-read-capture' },
    { schema: 2 },
    { version: null },
    { identity: [] },
    { counters: [1] },
    { counters: Array(66).fill(-1) },
    { lights: '0000' },
    { legacyXML: 2 },
  ])
    assert.throws(() => Profile.fromJSON({ ...data, ...patch }));
});
test('text macro and delay parser is strict and round-trips', () => {
  const def = parseSequence('Command @500\nC', { type: 2, interval: 0, cycles: 2, customDelay: true });
  assert.deepEqual(def.keys, [68, 58]);
  assert.deepEqual(def.delays, [500]);
  assert.equal(sequenceText(def), '左 Command @500\nC');
  for (const text of ['A\nB', 'A @-1\nB', 'A @2\nB @3', 'A @1 @2\nB'])
    assert.throws(() => parseSequence(text, { type: 2, customDelay: true }));
  assert.throws(() => parseSequence('A @10', { type: 0 }));
});
test('editor batches are atomic and edits cannot reach extension groups', () => {
  const editor = new EditorState();
  editor.load(fixture(9));
  const original = editor.profile.toJSON();
  assert.throws(() =>
    editor.applyDefinitions([
      { index: 0, definition: { type: 0, keys: [43] } },
      { index: 198, definition: { type: 0, keys: [44] } },
    ]),
  );
  assert.deepEqual(editor.profile.toJSON(), original);
  assert.throws(() =>
    editor.applyDefinitions([
      { index: 0, definition: { type: 0, keys: [43] } },
      { index: 0, definition: { type: 0, keys: [44] } },
    ]),
  );
  assert.deepEqual(editor.profile.toJSON(), original);
  editor.applyDefinitions([{ index: 0, definition: { type: 0, keys: [43] } }]);
  assert.deepEqual(editor.changes, [0]);
  editor.resetKey();
  assert.equal(editor.dirty, false);
});
test('offline and old-connection profiles cannot become writable on connection alone', () => {
  const editor = new EditorState();
  const session = { epoch: 2, hasLiveBaseline: true };
  editor.load(fixture());
  editor.applyDefinitions([{ index: 0, definition: { type: 0, keys: [43] } }]);
  assert.equal(editor.canWrite(session), false);
  editor.load(editor.profile, { baseline: fixture(), epoch: 2, source: 'read' });
  assert.equal(editor.canWrite(session), true);
  session.epoch++;
  assert.equal(editor.canWrite(session), false);
  editor.load(editor.profile, { baseline: fixture(), epoch: 3, source: 'demo' });
  assert.equal(editor.canWrite(session), false);
});
test('RGB editor changes only the chosen key or explicit all-key action', () => {
  const editor = new EditorState();
  editor.load(fixture(9, true));
  editor.select(10);
  editor.color('#123456');
  assert.deepEqual(Array.from(editor.profile.lights.slice(30, 33)), [18, 52, 86]);
  assert.equal(editor.lightsChanged, true);
  assert.throws(() => editor.color('#zzzzzz'));
  editor.color('#ffffff', true);
  assert.equal(
    editor.profile.lights.every((x) => x === 255),
    true,
  );
});
