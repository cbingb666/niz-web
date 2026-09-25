import { expect, test, vi } from 'vitest';
import { application, profileFile, acceptRead } from './store-helpers';
import { FakeDevice, FakeHID, fixture } from './helpers';
import { renderMessage } from '../src/i18n/core';
import type { ModelTool } from '../src/model-tools';

test('switching language preserves configuration and translates only a clean form', async () => {
  const { store, actions, download } = application();
  const profile = fixture(9);
  profile.setDefinition(0, { type: 0, keys: [68, 58] });
  await actions.importFile(profileFile(profile));
  const before = store.getState().profile?.toJSON();
  actions.updateForm({ picker: '音量 +', color: '#123456' });
  actions.setLocale('en');
  expect(store.getState().form.sequence).toBe('Left Command\nC');
  expect(store.getState().form.picker).toBe('音量 +');
  expect(store.getState().form.color).toBe('#123456');
  expect(store.getState().profile?.toJSON()).toEqual(before);
  expect(store.getState().formDirty).toBe(false);
  expect(store.getState().canWrite).toBe(false);
  actions.exportProfile();
  expect(download).toHaveBeenCalledWith('Configuration', before);
  actions.setLocale('zh-CN');
  expect(store.getState().form.sequence).toBe('左 Command\nC');
});
test('switching language preserves unsaved and invalid input, selection and dirty state', async () => {
  const { store, actions } = application();
  await actions.demo();
  actions.selectKey(8, 2);
  actions.updateForm({
    sequence: 'not-a-valid-key @30',
    type: '2',
    customDelay: true,
    interval: '40',
    cycles: '7',
  });
  const form = store.getState().form,
    profile = store.getState().profile?.toJSON();
  actions.setLocale('en');
  expect(store.getState().form).toEqual(form);
  expect(store.getState().profile?.toJSON()).toEqual(profile);
  expect(store.getState()).toMatchObject({ key: 8, layer: 2, formDirty: true });
  expect(actions.saveForm()).toBe(false);
  const dialog = store.getState().dialog;
  expect(dialog?.kind).toBe('message');
  if (dialog?.kind !== 'message') throw new Error('Expected an error dialog');
  expect(renderMessage(dialog.body, 'en')).toContain('Unknown key');
  expect(store.getState().profile?.toJSON()).toEqual(profile);
});
test('existing status and activity entries translate without adding new entries', async () => {
  const { store, actions } = application();
  await actions.start();
  await actions.demo();
  const before = store.getState().logs;
  actions.setLocale('en');
  expect(store.getState().logs).toBe(before);
  expect(renderMessage(store.getState().status, 'en')).toContain('offline example');
  expect(renderMessage(store.getState().session.message, 'en')).toContain('WebHID is unavailable');
  expect(renderMessage(store.getState().logs[0].message, 'en')).toContain('offline example');
});
test('a language change leaves pending confirmation and the HID session intact', async () => {
  const device = new FakeDevice(),
    hid = new FakeHID([device]);
  const { store, actions, session } = application(hid);
  await actions.start();
  await acceptRead(store);
  actions.updateForm({ sequence: 'A' });
  const pending = actions.write();
  const dialog = store.getState().dialog,
    epoch = session.epoch,
    reports = device.sent.slice();
  actions.setLocale('en');
  expect(store.getState().dialog).toBe(dialog);
  expect(dialog?.kind).toBe('confirm');
  if (dialog?.kind !== 'confirm') throw new Error('Expected a confirmation');
  expect(renderMessage(dialog.title, 'en')).toBe('Confirm keyboard write');
  expect(renderMessage(dialog.body, 'en')).toContain('1 key record');
  expect(renderMessage(dialog.body, 'en')).toContain('keyboard keys will be locked');
  expect(session.epoch).toBe(epoch);
  expect(device.openCount).toBe(1);
  expect(device.sent).toEqual(reports);
  actions.confirm(false);
  await pending;
  expect(device.sent).toEqual(reports);
  expect(store.getState().canWrite).toBe(true);
});
test('optional page tools change their labels and errors without duplicating registrations', async () => {
  const { actions } = application();
  const tools: ModelTool[] = [],
    signals: AbortSignal[] = [];
  const registerTool = vi.fn((tool: ModelTool, options: { signal: AbortSignal }) => {
    tools.push(tool);
    signals.push(options.signal);
  });
  await actions.start({ registerTool });
  actions.setLocale('en');
  expect(signals.slice(0, 3).every((signal) => signal.aborted)).toBe(true);
  expect(signals.slice(3).every((signal) => !signal.aborted)).toBe(true);
  expect(tools[3].title).toBe('Read keyboard status');
  expect(() => tools[4].execute({ layer: 0, keys: [0] })).toThrow(/Read or import/);
  await actions.stop();
  expect(signals.every((signal) => signal.aborted)).toBe(true);
});
