import { renderMessage } from '../src/i18n/core';
import { expect, test, vi } from 'vitest';
import { FakeDevice, FakeHID, fixture } from './helpers';
import { application, memoryBackups, profileFile, ready } from './store-helpers';
import type { ModelTool } from '../src/model-tools';

function writes(device: FakeDevice) {
  return device.sent.filter((packet) => [0xf1, 0xf0, 0xf6, 0xe1, 0xe0, 0xe6].includes(packet[1]));
}

test('startup reads all nine groups once, backs up, and never requests permission or writes', async () => {
  const device = new FakeDevice(fixture(9)),
    hid = new FakeHID([device]);
  const { store, actions, backups } = application(hid);
  await actions.start();
  await ready(store);
  expect(hid.requestCount).toBe(0);
  expect(store.getState().profile?.records).toHaveLength(594);
  expect(device.sent.map((packet) => packet[1])).toEqual([0xf9, 0xf2, 0xe3]);
  expect(backups.save).toHaveBeenCalledOnce();
  await actions.start();
  hid.connect(device);
  await ready(store);
  expect(device.openCount).toBe(1);
  expect(writes(device)).toHaveLength(0);
  expect(store.getState().canWrite).toBe(false);
});
test('first authorization preserves user activation then automatically reads', async () => {
  const device = new FakeDevice(),
    hid = new FakeHID();
  hid.selection = [device];
  const { store, actions } = application(hid);
  await actions.start();
  const pending = actions.connect();
  expect(hid.requestCount).toBe(1);
  await pending;
  await ready(store);
  expect(store.getState().profile?.records).toHaveLength(198);
  expect(writes(device)).toHaveLength(0);
});
test('reconnection refreshes clean state and preserves unsaved form inputs', async () => {
  const device = new FakeDevice(),
    hid = new FakeHID([device]);
  const { store, actions } = application(hid);
  await actions.start();
  await ready(store);
  hid.disconnect(device);
  device.profile.setDefinition(0, { type: 0, keys: [43] });
  hid.connect(device);
  await ready(store);
  expect(store.getState().form.sequence).toBe('A');
  actions.updateForm({ sequence: 'Command\nC' });
  hid.disconnect(device);
  device.profile.setDefinition(0, { type: 0, keys: [44] });
  hid.connect(device);
  await ready(store);
  expect(store.getState().form.sequence).toBe('Command\nC');
  expect(renderMessage(store.getState().status)).toMatch(/编辑内容已保留/);
  expect(store.getState().canWrite).toBe(false);
  expect(writes(device)).toHaveLength(0);
});
test('an offline import survives automatic read but cannot be written until rebound by import', async () => {
  const device = new FakeDevice(fixture(9)),
    hid = new FakeHID();
  const { store, actions } = application(hid);
  await actions.start();
  const imported = fixture();
  imported.setDefinition(0, { type: 0, keys: [43] });
  await actions.importFile(profileFile(imported));
  hid.selection = [device];
  await actions.connect();
  await ready(store);
  expect(store.getState().profile?.summary(0)).toBe('A');
  expect(store.getState().canWrite).toBe(false);
  await actions.importFile(profileFile(imported));
  expect(store.getState().canWrite).toBe(true);
  expect(store.getState().profile?.records.slice(198)).toEqual(device.profile.records.slice(198));
});
test('automatic parse failure stays connected and does not loop; manual read retries', async () => {
  const device = new FakeDevice();
  device.readOverride = device.profile.reports.slice(0, 10);
  const { store, actions } = application(new FakeHID([device]));
  await actions.start();
  await ready(store);
  expect(store.getState().session.connected).toBe(true);
  expect(store.getState().session.hasCapture).toBe(true);
  expect(device.sent.filter((packet) => packet[1] === 0xf2)).toHaveLength(1);
  actions.closeDialog();
  delete device.readOverride;
  await actions.read();
  await ready(store);
  expect(store.getState().profile?.records).toHaveLength(198);
  expect(writes(device)).toHaveLength(0);
});
test('corrupt imports and invalid form edits preserve the last valid configuration', async () => {
  const { store, actions } = application();
  await actions.demo();
  const before = store.getState().profile?.toJSON();
  await actions.importFile({ name: 'bad.json', size: 2, text: async () => '{}' });
  expect(store.getState().profile?.toJSON()).toEqual(before);
  actions.closeDialog();
  actions.updateForm({ sequence: 'unknown key' });
  expect(actions.selectKey(1)).toBe(false);
  expect(store.getState().key).toBe(0);
  expect(store.getState().form.sequence).toBe('unknown key');
  expect(store.getState().profile?.toJSON()).toEqual(before);
});
test('discard confirmation can cancel or replace edited state without touching hardware', async () => {
  const { store, actions } = application();
  await actions.demo();
  actions.updateForm({ sequence: 'A' });
  const cancelled = actions.demo();
  expect(store.getState().dialog?.kind).toBe('confirm');
  actions.confirm(false);
  await cancelled;
  expect(store.getState().form.sequence).toBe('A');
  const replaced = actions.demo();
  actions.confirm(true);
  await replaced;
  expect(store.getState().form.sequence).toBe('Esc');
});
test('write requires confirmation; cancellation sends no hardware write', async () => {
  const device = new FakeDevice();
  const { store, actions } = application(new FakeHID([device]));
  await actions.start();
  await ready(store);
  actions.updateForm({ sequence: 'A' });
  const pending = actions.write();
  expect(store.getState().dialog?.kind).toBe('confirm');
  expect(writes(device)).toHaveLength(0);
  actions.confirm(false);
  await pending;
  expect(writes(device)).toHaveLength(0);
  expect(store.getState().canWrite).toBe(true);
});
test('confirmed write backs up, writes, verifies and clears dirty state', async () => {
  const device = new FakeDevice();
  const { store, actions, backups } = application(new FakeHID([device]));
  await actions.start();
  await ready(store);
  actions.updateForm({ sequence: 'A' });
  const pending = actions.write();
  actions.confirm(true);
  await pending;
  expect(backups.save).toHaveBeenCalledTimes(2);
  expect(device.profile.summary(0)).toBe('A');
  expect(store.getState().canWrite).toBe(false);
  expect(store.getState().changes).toEqual([]);
  expect(renderMessage(store.getState().status)).toMatch(/回读一致/);
});
test('connection change during confirmation invalidates the pending write', async () => {
  const device = new FakeDevice(),
    hid = new FakeHID([device]);
  const { store, actions } = application(hid);
  await actions.start();
  await ready(store);
  actions.updateForm({ sequence: 'A' });
  const pending = actions.write();
  hid.disconnect(device);
  actions.confirm(true);
  await pending;
  expect(writes(device)).toHaveLength(0);
  expect(renderMessage(store.getState().status)).toMatch(/连接已变化/);
});
test('backup rejection after confirmation never sends a write command', async () => {
  const device = new FakeDevice(),
    backups = memoryBackups();
  const { store, actions } = application(new FakeHID([device]), backups);
  await actions.start();
  await ready(store);
  actions.updateForm({ sequence: 'A' });
  vi.mocked(backups.save).mockRejectedValue(new Error('quota exceeded'));
  const pending = actions.write();
  actions.confirm(true);
  await pending;
  expect(writes(device)).toHaveLength(0);
  expect(renderMessage(store.getState().status)).toMatch(/quota/);
});
test('optional tools share Zustand editor state and are blocked by a modal', async () => {
  const { store, actions } = application();
  const tools: ModelTool[] = [];
  const signals: AbortSignal[] = [];
  await actions.start({
    registerTool(tool, options) {
      tools.push(tool);
      signals.push(options.signal);
    },
  });
  await actions.demo();
  const stage = tools.find((tool) => tool.name === 'atom66_stage_key_edits');
  expect(stage).toBeDefined();
  stage!.execute({ edits: [{ layer: 0, key: 0, type: 0, sequence: 'A' }] });
  expect(store.getState().profile?.summary(0)).toBe('A');
  actions.showHelp();
  expect(() => stage!.execute({ edits: [{ layer: 0, key: 0, type: 0, sequence: 'B' }] })).toThrow();
  await actions.stop();
  expect(signals.every((signal) => signal.aborted)).toBe(true);
});
