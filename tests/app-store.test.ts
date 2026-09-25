import { renderMessage } from '../src/i18n/core';
import { expect, test, vi } from 'vitest';
import { FakeDevice, FakeHID, fixture } from './helpers';
import { application, memoryBackups, profileFile, ready, acceptRead } from './store-helpers';
import type { ModelTool } from '../src/model-tools';

function writes(device: FakeDevice) {
  return device.sent.filter((packet) => [0xf1, 0xf0, 0xf6, 0xe1, 0xe0, 0xe6].includes(packet[1]));
}

test('startup asks before reading all nine groups once, backing up, and never writes', async () => {
  const device = new FakeDevice(fixture(9)),
    hid = new FakeHID([device]);
  const { store, actions, backups } = application(hid);
  await actions.start();
  const dialog = store.getState().dialog;
  expect(dialog?.kind).toBe('confirm');
  if (dialog?.kind !== 'confirm') throw new Error('Expected a read confirmation');
  expect(renderMessage(dialog.title)).toContain('已自动连接');
  expect(renderMessage(dialog.body)).toContain('ATOM66 fixture');
  expect(renderMessage(dialog.body)).toContain('键盘按键将被锁定');
  expect(device.sent.map((packet) => packet[1])).toEqual([0xf9]);
  expect(store.getState().profile).toBeNull();
  expect(backups.save).not.toHaveBeenCalled();
  await acceptRead(store);
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
test('first authorization preserves user activation then waits for confirmation to read', async () => {
  const device = new FakeDevice(),
    hid = new FakeHID();
  hid.selection = [device];
  const { store, actions } = application(hid);
  await actions.start();
  const pending = actions.connect();
  expect(hid.requestCount).toBe(1);
  await pending;
  const dialog = store.getState().dialog;
  if (dialog?.kind !== 'confirm') throw new Error('Expected a read confirmation');
  expect(renderMessage(dialog.title)).toBe('键盘已连接，即将读取配置');
  expect(device.sent.map((packet) => packet[1])).toEqual([0xf9]);
  await acceptRead(store);
  expect(store.getState().profile?.records).toHaveLength(198);
  expect(writes(device)).toHaveLength(0);
});
test('reconnection refreshes clean state and preserves unsaved form inputs', async () => {
  const device = new FakeDevice(),
    hid = new FakeHID([device]);
  const { store, actions } = application(hid);
  await actions.start();
  await acceptRead(store);
  hid.disconnect(device);
  device.profile.setDefinition(0, { type: 0, keys: [43] });
  hid.connect(device);
  await acceptRead(store);
  expect(store.getState().form.sequence).toBe('A');
  actions.updateForm({ sequence: 'Command\nC' });
  hid.disconnect(device);
  device.profile.setDefinition(0, { type: 0, keys: [44] });
  hid.connect(device);
  await acceptRead(store);
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
  await acceptRead(store);
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
  await acceptRead(store);
  expect(store.getState().session.connected).toBe(true);
  expect(store.getState().session.hasCapture).toBe(true);
  expect(device.sent.filter((packet) => packet[1] === 0xf2)).toHaveLength(1);
  actions.closeDialog();
  delete device.readOverride;
  const pending = actions.read();
  await acceptRead(store);
  await pending;
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
  await acceptRead(store);
  const before = device.sent.slice();
  actions.updateForm({ sequence: 'A' });
  const pending = actions.write();
  const dialog = store.getState().dialog;
  if (dialog?.kind !== 'confirm') throw new Error('Expected a write confirmation');
  expect(renderMessage(dialog.body)).toContain('键盘按键将被锁定');
  expect(device.sent).toEqual(before);
  expect(writes(device)).toHaveLength(0);
  actions.confirm(false);
  await pending;
  expect(device.sent).toEqual(before);
  expect(writes(device)).toHaveLength(0);
  expect(store.getState().canWrite).toBe(true);
});

test('cancelling a connection read sends no configuration commands and does not repeat the prompt', async () => {
  const device = new FakeDevice(), hid = new FakeHID([device]);
  const { store, session, actions, backups } = application(hid);
  await actions.start();
  const confirmation = store.getState().dialog;
  await actions.read();
  await actions.write();
  actions.showHelp();
  expect(store.getState().dialog).toBe(confirmation);
  actions.closeDialog();
  await Promise.resolve();
  session.notify();
  hid.connect(device);
  await ready(store);
  expect(store.getState().dialog).toBeNull();
  expect(store.getState().hardwareOperation).toBeNull();
  expect(device.sent.map((packet) => packet[1])).toEqual([0xf9]);
  expect(backups.save).not.toHaveBeenCalled();
  const read = actions.read();
  const retry = store.getState().dialog;
  if (retry?.kind !== 'confirm') throw new Error('Expected a manual read confirmation');
  expect(renderMessage(retry.title)).toBe('确认读取键盘配置');
  await acceptRead(store);
  await read;
  expect(store.getState().profile).not.toBeNull();
});

test('manual read combines the lock warning with edit replacement consent and cancellation preserves input', async () => {
  const device = new FakeDevice();
  const { store, actions } = application(new FakeHID([device]));
  await actions.start();
  await acceptRead(store);
  actions.updateForm({ sequence: 'Command\nC' });
  const before = device.sent.slice(), profile = store.getState().profile?.toJSON();
  const cancelled = actions.read();
  const dialog = store.getState().dialog;
  if (dialog?.kind !== 'confirm') throw new Error('Expected a read confirmation');
  expect(renderMessage(dialog.body)).toContain('键盘按键将被锁定');
  expect(renderMessage(dialog.body)).toContain('未写入的修改');
  expect(store.getState().hardwareOperation).toBeNull();
  actions.confirm(false);
  await cancelled;
  expect(store.getState().form.sequence).toBe('Command\nC');
  expect(store.getState().profile?.toJSON()).toEqual(profile);
  expect(device.sent).toEqual(before);
  const accepted = actions.read();
  await acceptRead(store);
  await accepted;
  expect(store.getState().form.sequence).toBe('Esc');
  expect(store.getState().dialog).toBeNull();
});

test('read consent cannot carry over to a reconnected device', async () => {
  const first = new FakeDevice(), next = new FakeDevice();
  next.profile.setDefinition(0, { type: 0, keys: [44] });
  const hid = new FakeHID([first]);
  const { store, actions } = application(hid);
  await actions.start();
  hid.disconnect(first);
  hid.connect(next);
  await ready(store);
  actions.confirm(true);
  await vi.waitFor(() => expect(store.getState().dialog?.kind).toBe('message'));
  expect(renderMessage(store.getState().status)).toContain('重新确认读取');
  expect(first.sent.map((packet) => packet[1])).toEqual([0xf9]);
  expect(next.sent.map((packet) => packet[1])).toEqual([0xf9]);
  actions.closeDialog();
  await acceptRead(store);
  expect(store.getState().profile?.summary(0)).toBe('S');
});

test('a connection prompt waits for an existing dialog to close and stopping cancels it', async () => {
  const device = new FakeDevice();
  const { store, actions } = application(new FakeHID([device]));
  actions.showHelp();
  await actions.start();
  expect(store.getState().dialog?.kind).toBe('help');
  expect(device.sent.map((packet) => packet[1])).toEqual([0xf9]);
  actions.closeDialog();
  expect(store.getState().dialog?.kind).toBe('confirm');
  await actions.stop();
  expect(store.getState().dialog).toBeNull();
  expect(store.getState().hardwareOperation).toBeNull();
  expect(device.sent.map((packet) => packet[1])).toEqual([0xf9]);
});
test('confirmed write backs up, writes, verifies and clears dirty state', async () => {
  const device = new FakeDevice();
  const { store, actions, backups } = application(new FakeHID([device]));
  await actions.start();
  await acceptRead(store);
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
  await acceptRead(store);
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
  await acceptRead(store);
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
