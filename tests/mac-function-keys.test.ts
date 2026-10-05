import { expect, test } from 'vitest';
import { EditorState } from '../src/editor';
import { planMacFunctionKeys } from '../src/mac-function-keys';
import { MAC_NATIVE_VERSION, MAC_STOCK_VERSION } from '../src/mac-keycodes';
import { demoProfile } from '../src/protocol';
import { supportedModels } from '../src/devices';
import { renderMessage } from '../src/i18n/core';
import { FakeDevice, FakeHID, fixture } from './helpers';
import { acceptRead, application, profileFile } from './store-helpers';

function nativeProfile(groups = 3) {
  const profile = fixture(groups, true);
  profile.version = MAC_NATIVE_VERSION;
  return profile;
}

test('one conversion covers both compact Fn rows and one undo restores the entire batch', () => {
  const editor = new EditorState();
  const original = nativeProfile(9);
  original.legacyXML = '<original />';
  editor.load(original);
  const before = editor.profile!.toJSON();
  const plan = planMacFunctionKeys(editor.profile!);
  expect(plan.edits).toHaveLength(24);
  editor.applyDefinitions(plan.edits);
  for (const layer of [1, 2]) {
    expect(Array.from({ length: 12 }, (_, key) => editor.profile!.definition(layer * 66 + key + 1).keys[0]))
      .toEqual([208, 209, 222, 224, 225, 226, 109, 111, 108, 112, 114, 113]);
  }
  expect(editor.profile!.records.slice(0, 66)).toEqual(original.records.slice(0, 66));
  expect(editor.profile!.records.slice(198)).toEqual(original.records.slice(198));
  expect(editor.profile!.lights).toEqual(original.lights);
  expect(editor.profile!.counters).toEqual(original.counters);
  expect(editor.profile!.legacyXML).toBe(original.legacyXML);
  expect(editor.baseline!.toJSON()).toEqual(before);
  const converted = editor.profile!.toJSON();
  editor.undo();
  expect(editor.profile!.toJSON()).toEqual(before);
  expect(editor.canUndo).toBe(false);
  editor.redo();
  expect(editor.profile!.toJSON()).toEqual(converted);
});

test('relocated and duplicate single F keys convert while shortcuts, repeats and macros keep their bytes', () => {
  const profile = nativeProfile();
  profile.setDefinition(0, { type: 0, keys: [13] });
  profile.setDefinition(14, { type: 0, keys: [2] });
  profile.setDefinition(15, { type: 0, keys: [67, 2] });
  profile.setDefinition(16, { type: 1, keys: [3], interval: 90 });
  profile.setDefinition(17, { type: 2, keys: [4, 5], interval: 30, customDelay: 1, delays: [45], cycles: 3 });
  profile.setDefinition(18, { type: 0, keys: [224] });
  const editor = new EditorState();
  editor.load(profile);
  editor.applyDefinitions(planMacFunctionKeys(profile).edits);
  expect(editor.profile!.definition(0).keys).toEqual([113]);
  expect(editor.profile!.definition(14).keys).toEqual([208]);
  for (const index of [15, 16, 17, 18]) expect(editor.profile!.records[index]).toEqual(profile.records[index]);
});

test('inconsistent imported Fn positions are preserved instead of synchronizing over another layer', () => {
  const profile = nativeProfile();
  profile.setDefinition(1, { type: 0, keys: [156] }, { syncFn: false });
  const plan = planMacFunctionKeys(profile);
  expect(plan.protectedIndices).toEqual([67, 133]);
  expect(plan.edits).toHaveLength(22);
  const editor = new EditorState();
  editor.load(profile);
  editor.applyDefinitions(plan.edits);
  for (const index of [1, 67, 133]) expect(editor.profile!.records[index]).toEqual(profile.records[index]);
});

test.each(supportedModels)('$name cannot use the complete Mac preset with an unsupported firmware', model => {
  const profile = demoProfile(model);
  profile.version = model.id === 'atom66' ? MAC_STOCK_VERSION : MAC_NATIVE_VERSION;
  expect(planMacFunctionKeys(profile)).toEqual({ supported: false, edits: [], protectedIndices: [] });
});

test('a draft at any conversion target blocks the whole operation without losing edits or history', async () => {
  const { store, actions } = application();
  await actions.importFile(profileFile(nativeProfile()));
  actions.selectKey(0);
  actions.assignKey(44);
  actions.selectKey(3, 2);
  actions.updateForm({ sequence: 'unfinished input' });
  actions.selectKey(0);
  const before = store.getState().profile!.toJSON();
  const drafts = store.getState().drafts;
  actions.convertMacFunctionKeys();
  expect(store.getState().profile!.toJSON()).toEqual(before);
  expect(store.getState().drafts).toEqual(drafts);
  expect(renderMessage(store.getState().formError)).toContain('未应用输入');
  actions.undo();
  expect(store.getState().profile!.definition(0).keys).toEqual([1]);
  expect(store.getState().drafts).toEqual(drafts);
});

test('unrelated drafts, selection and browsing survive conversion; repeated clicks do not add history', async () => {
  const { store, actions } = application();
  await actions.importFile(profileFile(nativeProfile()));
  actions.selectKey(0);
  actions.assignKey(44);
  actions.updateForm({ sequence: 'my unfinished shortcut', view: 'advanced' });
  actions.setMappingView('advanced');
  actions.updateActionPicker('key', { group: 'mac', query: 'brightness', highlight: 1, scrollTop: 75 });
  const before = store.getState().profile!.toJSON(), form = store.getState().form;
  const browser = store.getState().mappingBrowser;
  actions.convertMacFunctionKeys();
  const converted = store.getState().profile!.toJSON();
  expect(converted).not.toEqual(before);
  expect(store.getState().form).toEqual(form);
  expect(store.getState().formDirty).toBe(true);
  expect(store.getState().mappingBrowser).toEqual(browser);
  expect(store.getState()).toMatchObject({ key: 0, layer: 0 });
  actions.convertMacFunctionKeys();
  actions.undo();
  expect(store.getState().profile!.toJSON()).toEqual(before);
  expect(store.getState().form).toEqual(form);
  actions.redo();
  expect(store.getState().profile!.toJSON()).toEqual(converted);
});

test('unsupported preset and open dialogs never stage partial conversions', async () => {
  const { store, actions } = application();
  const profile = nativeProfile();
  profile.version = MAC_STOCK_VERSION;
  await actions.importFile(profileFile(profile));
  const original = store.getState().profile!.toJSON();
  actions.convertMacFunctionKeys();
  expect(store.getState().profile!.toJSON()).toEqual(original);
  expect(store.getState().canUndo).toBe(false);
  expect(renderMessage(store.getState().formError)).toContain('V1.5.1-F.1');
  await actions.importFile(profileFile(nativeProfile()));
  const before = store.getState().profile!.toJSON();
  actions.showHelp();
  actions.convertMacFunctionKeys();
  expect(store.getState().profile!.toJSON()).toEqual(before);
  actions.closeDialog();
  store.setState({ busy: 'read in progress' });
  actions.convertMacFunctionKeys();
  expect(store.getState().profile!.toJSON()).toEqual(before);
  store.setState({ busy: '' });
  await actions.stop();
  actions.convertMacFunctionKeys();
  expect(store.getState().profile!.toJSON()).toEqual(before);
});

test('conversion is confined to the active editor and sends no hardware traffic', async () => {
  const first = new FakeDevice(nativeProfile()), second = new FakeDevice(nativeProfile());
  const hid = new FakeHID([first]);
  const { store, actions, session } = application(hid);
  await actions.start();
  await acceptRead(store);
  const firstId = session.activeDeviceId!;
  hid.selection = [second];
  const secondId = (await actions.connect())!;
  const configuring = actions.configureDevice(secondId);
  await acceptRead(store);
  await configuring;
  const firstPackets = first.sent.length, secondPackets = second.sent.length;
  actions.updateForm({ sequence: 'second device draft' });
  actions.resumeEditor(firstId);
  actions.convertMacFunctionKeys();
  expect(store.getState().changes).toHaveLength(24);
  actions.resumeEditor(secondId);
  expect(store.getState().changes).toEqual([]);
  expect(store.getState().form.sequence).toBe('second device draft');
  expect(first.sent).toHaveLength(firstPackets);
  expect(second.sent).toHaveLength(secondPackets);
});
