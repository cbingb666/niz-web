import { msg } from './i18n/core.ts';
import type { KeyDefinition } from './protocol';
import type { HIDSession } from './hid';
import { defaultModel } from './devices/index';
export type EditorSource = '' | 'read' | 'import' | 'demo';
import { Profile, assert, integer, equalBytes, encodeDefinition } from './protocol';

// Editing is local. A profile is writable only after it is bound to a live read.
export class EditorState {
  profile: Profile | null = null;
  baseline: Profile | null = null;
  boundEpoch: number | null = null;
  source: EditorSource = '';
  layer = 0;
  key = 0;
  private past: Profile[] = [];
  private future: Profile[] = [];
  generation = 0;
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
    this.past = [];
    this.future = [];
    this.generation++;
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
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  private commit(next: Profile) {
    const previous = this.profile;
    if (!previous || (!next.differences(previous).length && equalBytes(next.lights, previous.lights))) return;
    this.past = [...this.past.slice(-49), previous.clone()];
    this.future = [];
    this.profile = next;
  }
  undo() {
    const previous = this.past.pop();
    if (!previous || !this.profile) return;
    this.future.push(this.profile.clone());
    this.profile = previous;
  }
  redo() {
    const next = this.future.pop();
    if (!next || !this.profile) return;
    this.past.push(this.profile.clone());
    this.profile = next;
  }
  isFn(definition: KeyDefinition) {
    return definition.type === 0 && definition.keys.length === 1 && this.model.fn.codes.includes(definition.keys[0]);
  }
  hasFnAt(key: number, profile = this.profile) {
    return !!profile && this.model.layers.some((_, layer) => this.isFn(profile.definition(layer * this.model.keyCount + key)));
  }
  private validateEdit(next: Profile) {
    Profile.fromReports(next.reports, next.model);
    // An imported configuration may already lack Fn. Allow repairing it, but
    // never turn a configuration with Fn into one with no way to reach its layers.
    const hasFn = (profile: Profile) => profile.model.keys.some((_, key) => this.isFn(profile.definition(key)));
    if (this.model.fn.required && this.profile && hasFn(this.profile))
      assert(hasFn(next), msg('mapping.fnRequired'));
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
    const next = this.profile.clone(), seen = new Set<number>();
    const planned = new Map<number, KeyDefinition>();
    for (const { index, definition } of edits) {
      integer(index, this.model.editableRecords - 1, msg('field.editableKey'));
      assert(!seen.has(index), msg('error.duplicateEdit'));
      seen.add(index);
      const key = index % this.model.keyCount;
      const indices = this.isFn(definition) || this.hasFnAt(key)
        ? this.model.layers.map((_, layer) => layer * this.model.keyCount + key)
        : [index];
      for (const target of indices) {
        const existing = planned.get(target);
        if (existing) {
          const a = encodeDefinition(existing, target, this.model), b = encodeDefinition(definition, target, this.model);
          assert(a.length === b.length && a.every((report, i) => equalBytes(report, b[i])), msg('mapping.fnConflict'));
        }
        planned.set(target, definition);
      }
    }
    for (const [index, definition] of planned) next.setDefinition(index, definition, { syncFn: false });
    this.validateEdit(next);
    this.commit(next);
  }
  resetKey() {
    assert(this.baseline, msg('error.noBaseline'));
    assert(this.profile, msg('error.editorProfile'));
    const next = this.profile.clone();
    const indices = this.hasFnAt(this.key) || this.hasFnAt(this.key, this.baseline)
      ? this.model.layers.map((_, layer) => layer * this.model.keyCount + this.key)
      : [this.index];
    for (const index of indices) next.setDefinition(index, this.baseline.definition(index), { syncFn: false });
    this.validateEdit(next);
    this.commit(next);
  }
  color(value: string, all = false) {
    assert(this.profile?.lights, msg('error.noLights'));
    assert(/^#[0-9a-f]{6}$/i.test(value), msg('error.color'));
    const color = [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
    const next = this.profile.clone();
    for (let key = 0; key < this.model.keyCount; key++) if (all || key === this.key) next.lights!.set(color, key * 3);
    this.commit(next);
  }
}
