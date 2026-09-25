import { test } from 'vitest';
import assert from 'node:assert/strict';
import { EditorState } from '../src/editor.ts';
import { modelTools, registerModelTools } from '../src/model-tools.ts';
import { fixture } from './helpers.ts';

function setup() {
  const editor = new EditorState();
  editor.load(fixture());
  let renders = 0;
  const dependencies = {
    editor,
    session: { state: 'waiting', version: '' },
    canStage: () => true,
    onStaged: () => renders++,
  };
  const tools = Object.fromEntries(modelTools(dependencies).map((tool) => [tool.name, tool]));
  return { editor, dependencies, tools, renderCount: () => renders };
}
test('optional tool registration is feature detected, annotated and cleaned up', () => {
  const { dependencies } = setup(),
    seen = [];
  let removed = 0;
  registerModelTools(null, dependencies)();
  const cleanup = registerModelTools(
    {
      registerTool(tool, { signal }) {
        seen.push(tool);
        signal.addEventListener('abort', () => removed++);
      },
    },
    dependencies,
  );
  assert.deepEqual(
    seen.map((tool) => tool.name),
    ['atom66_read_status', 'atom66_read_keys', 'atom66_stage_key_edits'],
  );
  assert.deepEqual(
    seen.map((tool) => tool.annotations.readOnlyHint),
    [true, true, false],
  );
  assert.equal(
    seen.every((tool) => tool.inputSchema.additionalProperties === false),
    true,
  );
  cleanup();
  assert.equal(removed, 3);
});
test('tool read-back and staged edits share the exact editor state, without hardware access', () => {
  const { tools, editor, renderCount } = setup();
  assert.equal(tools.atom66_read_status.execute({}).connection, 'waiting');
  const result = tools.atom66_stage_key_edits.execute({
    edits: [
      { layer: 0, key: 0, type: 0, sequence: 'Command\nC' },
      { layer: 1, key: 20, type: 2, sequence: 'A @50\nB', customDelay: true },
    ],
  });
  assert.equal(result.hardwareWritten, false);
  assert.equal(result.staged, 2);
  assert.equal(renderCount(), 1);
  assert.deepEqual(tools.atom66_read_keys.execute({ layer: 0, keys: [0] }).keys[0].definition.keys, [68, 58]);
  assert.equal(tools.atom66_read_status.execute({}).changedKeys, 2);
  assert.equal(editor.profile.definition(86).delays[0], 50);
});
test('invalid staged batch, read arguments and busy state fail without corruption', () => {
  const { tools, editor, dependencies } = setup(),
    original = editor.profile.toJSON();
  for (const invalid of [
    null,
    {},
    { edits: [] },
    {
      edits: [
        { layer: 0, key: 0, type: 0, sequence: 'A' },
        { layer: 9, key: 1, type: 0, sequence: 'B' },
      ],
    },
    { edits: [{ layer: 0, key: 0, type: 0, sequence: 'A', customDelay: 1 }] },
    { edits: [{ layer: 0, key: 0, type: 0, sequence: 'A' }], write: true },
  ])
    assert.throws(() => tools.atom66_stage_key_edits.execute(invalid));
  assert.deepEqual(editor.profile.toJSON(), original);
  for (const invalid of [
    { layer: 3, keys: [0] },
    { layer: 0, keys: [] },
    { layer: 0, keys: [66] },
    { layer: 0, keys: [0], extra: 1 },
  ])
    assert.throws(() => tools.atom66_read_keys.execute(invalid));
  assert.throws(() => tools.atom66_read_status.execute({ extra: true }));
  dependencies.canStage = () => false;
  const blocked = modelTools(dependencies)[2];
  assert.throws(() => blocked.execute({ edits: [{ layer: 0, key: 0, type: 0, sequence: 'A' }] }));
  assert.deepEqual(editor.profile.toJSON(), original);
});
test('registration failures do not break the application', async () => {
  const { dependencies } = setup();
  let failures = 0;
  registerModelTools(
    {
      registerTool() {
        throw new Error('not enabled');
      },
    },
    dependencies,
    () => failures++,
  );
  assert.equal(failures, 3);
  registerModelTools(
    {
      registerTool() {
        return Promise.reject(new Error('not enabled'));
      },
    },
    dependencies,
    () => failures++,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(failures, 6);
});
