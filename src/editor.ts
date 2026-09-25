import { msg } from './i18n/core.ts';
import type { KeyDefinition } from './protocol';
import type { HIDSession } from './hid';
import { defaultModel } from './devices/index';
export type EditorSource = '' | 'read' | 'import' | 'demo';
import { Profile, assert, integer, equalBytes } from './protocol';

// Editing is local. A profile is writable only after it is bound to a live read.
export class EditorState {
  profile: Profile | null = null;
  baseline: Profile | null = null;
  boundEpoch: number | null = null;
  source: EditorSource = '';
  layer = 0;
  key = 0;
  constructor() {
    this.profile = null;
    this.baseline = null;
    this.boundEpoch = null;
    this.source = '';
    this.layer = 0;
    this.key = 0;
  }
  get index() {
    return this.layer * this.model.keyCount + this.key;
  }
  get model() {
    return this.profile?.model ?? defaultModel;
  }
  load(
    profile: Profile,
    {
      baseline = profile,
      epoch = null,
      source = 'import',
    }: { baseline?: Profile; epoch?: number | null; source?: EditorSource } = {},
  ) {
    const next = profile.clone(),
      original = baseline.clone();
    next.differences(original);
    this.profile = next;
    this.baseline = original;
    this.boundEpoch = epoch;
    this.source = source;
    this.key = Math.min(this.key, next.model.keyCount - 1);
    this.layer = Math.min(this.layer, next.model.layers.length - 1);
  }
  get changes() {
    return this.profile ? this.profile.differences(this.baseline ?? this.profile) : [];
  }
  get lightsChanged() {
    return !!this.profile && !equalBytes(this.profile.lights, this.baseline?.lights);
  }
  get dirty() {
    return this.changes.length > 0 || this.lightsChanged;
  }
  canWrite(session: Pick<HIDSession, 'epoch' | 'hasLiveBaseline'>) {
    return (
      this.source !== 'demo' && this.boundEpoch === session.epoch && session.hasLiveBaseline && this.dirty
    );
  }
  select(key: number, layer = this.layer) {
    const nextKey = integer(key, this.model.keyCount - 1, msg('field.physical'));
    const nextLayer = integer(layer, this.model.layers.length - 1, msg('field.layer'));
    this.key = nextKey;
    this.layer = nextLayer;
  }
  applyDefinitions(edits: { index: number; definition: KeyDefinition }[]) {
    assert(this.profile, msg('error.editorProfile'));
    assert(Array.isArray(edits) && edits.length > 0 && edits.length <= this.model.editableRecords, msg('error.editCount'));
    const next = this.profile.clone(),
      seen = new Set();
    for (const { index, definition } of edits) {
      integer(index, this.model.editableRecords - 1, msg('field.editableKey'));
      assert(!seen.has(index), msg('error.duplicateEdit'));
      seen.add(index);
      next.setDefinition(index, definition);
    }
    // Validate all records before committing the in-memory transaction.
    Profile.fromReports(next.reports, next.model);
    this.profile = next;
  }
  resetKey() {
    assert(this.baseline, msg('error.noBaseline'));
    this.applyDefinitions([{ index: this.index, definition: this.baseline.definition(this.index) }]);
  }
  color(value: string, all = false) {
    assert(this.profile?.lights, msg('error.noLights'));
    assert(/^#[0-9a-f]{6}$/i.test(value), msg('error.color'));
    const color = [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
    for (let key = 0; key < this.model.keyCount; key++) if (all || key === this.key) this.profile.lights.set(color, key * 3);
  }
}
