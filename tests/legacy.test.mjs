import { test } from 'vitest';
import assert from 'node:assert/strict';
import { importWindowsProfile } from '../src/legacy.ts';
import { Profile } from '../src/protocol.ts';

// Semantic XML fixture, not a replacement browser XML parser. Production uses
// DOMParser; these tests isolate legacy conversion after XML has been parsed.
function node(tagName, attributes = {}, children = []) {
  return {
    tagName,
    children,
    getAttribute(name) {
      return Object.hasOwn(attributes, name) ? String(attributes[name]) : null;
    },
    attributes,
  };
}
function fixture() {
  const nodes = Array.from({ length: 198 }, (_, index) =>
    node('KEY', { ID: (index % 66) + 1, Level: Math.floor(index / 66), Mode: 0 }),
  );
  const root = node('ATOM66', {}, [node('CurrentSettings', {}, nodes)]);
  return {
    nodes,
    root,
    text: '<66EC(S)><CurrentSettings/></66EC(S)>',
    parser: class {
      parseFromString(text, type) {
        assert.equal(type, 'application/xml');
        assert.match(text, /<ATOM66>/);
        return { documentElement: root, querySelector: () => null };
      }
    },
  };
}
function combo(node, mode, entries, attributes = {}) {
  node.attributes.Mode = mode;
  node.children = [
    globalNode('ComboKey', {}, [
      globalNode(
        'List',
        attributes,
        entries.map((t1, ID) => globalNode('x', { ID, t1 })),
      ),
    ]),
  ];
}
const globalNode = node;
function parse(f) {
  return importWindowsProfile(f.text, '66EC(S);test;', {}, f.parser);
}
test('legacy roots are normalized before standard XML parsing', () => {
  for (const name of ['66EC(XRGB)Ble', '66EC(XRGB)BLe', '66EC(S)Ble', '66EC(S)BLe', '66EC(S)']) {
    const f = fixture();
    f.text = `<${name}></${name}>`;
    assert.equal(parse(f).records.length, 198);
  }
});
test('legacy normal, combo, repeat, double-click and extended modes match native conversion', () => {
  const f = fixture();
  Object.assign(f.nodes[0].attributes, { Mode: 1, HWCode: 68 });
  combo(f.nodes[1], 2, ['L-CTRL', 'C']);
  combo(f.nodes[2], 4, ['A', 'B'], { Delay: 300 });
  Object.assign(f.nodes[3].attributes, { Mode: 1, HWCode: 199 });
  Object.assign(f.nodes[4].attributes, { Mode: 10, HWCode: 149 });
  const p = parse(f);
  assert.deepEqual(p.definition(0).keys, [68]);
  assert.deepEqual(p.definition(1).keys, [67, 58]);
  assert.equal(p.definition(2).type, 1);
  assert.equal(p.definition(2).interval, 300);
  assert.deepEqual(p.definition(3).keys, [130, 130]);
  assert.deepEqual(p.definition(4).keys, [149]);
});
test('legacy per-step and automatic macros retain mode, delay and play cycles', () => {
  const f = fixture();
  combo(f.nodes[0], 3, ['A Down', '<50 ms>', 'A UP'], {
    Cycles: 2,
    IsAutoInterval: 0,
    Delay: 30,
    PlayMode: 0,
  });
  combo(f.nodes[1], 3, ['Media Play/Pause', 'Backlight Switch'], {
    IsAutoInterval: 1,
    Delay: 45,
    PlayMode: 1,
  });
  combo(f.nodes[2], 3, ['C'], { IsAutoInterval: 1, PlayMode: 2 });
  const p = parse(f);
  assert.deepEqual(p.definition(0), {
    type: 2,
    keys: [43, 43],
    interval: 0,
    cycles: 2,
    customDelay: 1,
    delays: [50],
  });
  assert.deepEqual(p.definition(1), {
    type: 3,
    keys: [111, 135],
    interval: 45,
    cycles: 0,
    customDelay: 0,
    delays: [],
  });
  assert.equal(p.definition(2).type, 4);
});
test('legacy RGB one-based positions and original XML survive JSON round trip', () => {
  const f = fixture();
  f.root.children.push(
    node(
      'BackgroundLightSettings',
      {},
      Array.from({ length: 66 }, (_, i) => node('AREA', { ID: i + 1, Red: i, Green: 20, Blue: 30 })),
    ),
  );
  const p = parse(f);
  assert.equal(p.lights.length, 198);
  assert.deepEqual(Array.from(p.lights.slice(-3)), [65, 20, 30]);
  assert.equal(Profile.fromJSON(p.toJSON()).legacyXML, f.text);
});
test('unknown actions, missing data, duplicate indices and nested macros are rejected', () => {
  let f = fixture();
  combo(f.nodes[0], 2, ['unknown action']);
  assert.throws(() => parse(f));
  f = fixture();
  f.nodes.pop();
  assert.throws(() => parse(f));
  f = fixture();
  f.nodes[1].attributes.ID = 1;
  assert.throws(() => parse(f));
  f = fixture();
  f.nodes[0].attributes.ID = 0;
  assert.throws(() => parse(f));
  f = fixture();
  combo(f.nodes[0], 2, ['A', 'B']);
  f.nodes[0].children[0].children[0].children[1].attributes.ID = 0;
  assert.throws(() => parse(f));
  f = fixture();
  combo(f.nodes[0], 2, ['A']);
  f.nodes[0].children[0].children[0].children[0].children.push(
    node('List', {}, [node('x', { ID: 0, t1: 'B' })]),
  );
  assert.throws(() => parse(f));
});
test('legacy security and malformed XML failures occur before changing editor state', () => {
  for (const input of [
    '<!DOCTYPE a><66EC(S)></66EC(S)>',
    '<!ENTITY a SYSTEM "file:///etc/passwd"><66EC(S)></66EC(S)>',
    '<Other/>',
    'x'.repeat(4 * 1024 * 1024 + 1),
  ])
    assert.throws(() => importWindowsProfile(input));
  const f = fixture();
  class BrokenParser {
    parseFromString() {
      return { documentElement: f.root, querySelector: () => ({}) };
    }
  }
  assert.throws(() => importWindowsProfile(f.text, 'test', {}, BrokenParser));
  combo(f.nodes[0], 3, ['A', '<x ms>', 'B'], { IsAutoInterval: 0 });
  assert.throws(() => parse(f));
});
