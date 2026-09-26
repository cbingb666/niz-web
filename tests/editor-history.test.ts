import { expect, test } from 'vitest';
import { EditorState } from '../src/editor';
import { fixture } from './helpers';
import { modelFixture, test68 } from './model-fixtures';

test('one undo reverses a whole Fn assignment or removal and preserves opaque groups', () => {
  const editor = new EditorState();
  editor.load(fixture(9));
  const original = editor.profile!.toJSON();
  editor.applyDefinitions([{ index: 0, definition: { type: 0, keys: [156] } }]);
  expect(editor.changes).toEqual([0, 66, 132]);
  editor.undo();
  expect(editor.profile!.toJSON()).toEqual(original);
  editor.redo();
  editor.select(0, 2);
  editor.applyDefinitions([{ index: editor.index, definition: { type: 0, keys: [58] } }]);
  for (const index of [0, 66, 132]) expect(editor.profile!.definition(index).keys).toEqual([58]);
  editor.undo();
  for (const index of [0, 66, 132]) expect(editor.profile!.definition(index).keys).toEqual([156]);
  expect(editor.profile!.records.slice(198)).toEqual(fixture(9).records.slice(198));
});

test('restoring a newly assigned Fn recovers distinct original layer values and is undoable', () => {
  const editor = new EditorState();
  const original = fixture(9);
  original.setDefinition(66, { type: 0, keys: [44] });
  editor.load(original);
  editor.applyDefinitions([{ index: 0, definition: { type: 0, keys: [156] } }]);
  editor.resetKey();
  expect(editor.profile!.toJSON()).toEqual(original.toJSON());
  editor.undo();
  expect(editor.profile!.definition(66).keys).toEqual([156]);
});

test('the last Fn cannot be removed, but an atomic move to another physical key is allowed', () => {
  const editor = new EditorState();
  editor.load(modelFixture(test68, 4));
  const before = editor.profile!.toJSON();
  expect(() => editor.applyDefinitions([{ index: 135, definition: { type: 0, keys: [58] } }])).toThrow(/Fn/);
  expect(editor.profile!.toJSON()).toEqual(before);
  expect(editor.canUndo).toBe(false);
  editor.applyDefinitions([
    { index: 135, definition: { type: 0, keys: [58] } },
    { index: 0, definition: { type: 0, keys: [156] } },
  ]);
  expect(editor.profile!.definition(67).keys).toEqual([58]);
  expect(editor.profile!.definition(68).keys).toEqual([156]);
  expect(() => editor.profile!.validateForWriting()).not.toThrow();
  editor.undo();
  expect(editor.profile!.toJSON()).toEqual(before);
});

test('conflicting cross-layer Fn edits roll back the entire batch', () => {
  const editor = new EditorState();
  editor.load(fixture());
  const original = editor.profile!.toJSON();
  expect(() => editor.applyDefinitions([
    { index: 0, definition: { type: 0, keys: [156] } },
    { index: 66, definition: { type: 0, keys: [58] } },
  ])).toThrow(/冲突/);
  expect(editor.profile!.toJSON()).toEqual(original);
  expect(editor.canUndo).toBe(false);
});

test('history spans macro parameters and RGB without changing the loaded baseline', () => {
  const editor = new EditorState();
  editor.load(fixture(9, true));
  const baseline = editor.baseline!.toJSON();
  editor.applyDefinitions([{ index: 0, definition: { type: 2, keys: [43, 44], interval: 30, cycles: 2, customDelay: 1, delays: [75] } }]);
  const macro = editor.profile!.toJSON();
  editor.color('#123456', true);
  editor.undo();
  expect(editor.profile!.toJSON()).toEqual(macro);
  editor.undo();
  expect(editor.profile!.toJSON()).toEqual(baseline);
  editor.redo();
  expect(editor.profile!.toJSON()).toEqual(macro);
  editor.applyDefinitions([{ index: 1, definition: { type: 0, keys: [58] } }]);
  expect(editor.canRedo).toBe(false);
  expect(editor.baseline!.toJSON()).toEqual(baseline);
  editor.load(fixture());
  expect(editor.canUndo).toBe(false);
  expect(editor.canRedo).toBe(false);
});
