import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { Check, Keyboard, PencilLine, RotateCcw, X } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';
import { keyDescription, localizedKeyName } from '@/i18n/key-names';
import { keycapSummary, localizedSummary } from '@/i18n/profile';
import { parseKey, parseSequence } from '@/protocol';
import { useAppStore } from '@/store/context';
import { isLocked } from '@/store/app-store';
import { ActionPicker } from './action-picker';
import { AdvancedKeyEditor } from './advanced-key-editor';
import { KeycapSample } from './keycap-sample';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const modifiers = [67, 68, 69, 55, 74, 72, 71, 66];
function readChord(sequence: string) {
  try { return parseSequence(sequence, { type: 0 }).keys; } catch { return []; }
}
function ShortcutEditor({ disabled, onAdvanced }: { disabled: boolean; onAdvanced(): void }) {
  const { t, locale } = useI18n();
  const form = useAppStore(state => state.form);
  const dirty = useAppStore(state => state.formDirty);
  const actions = useAppStore(state => state.actions);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState(false);
  useEffect(() => {
    const stop = () => setRecording(false);
    window.addEventListener('blur', stop);
    return () => window.removeEventListener('blur', stop);
  }, []);
  const keys = form.type === '0' ? readChord(form.sequence) : [];
  const mainKeys = keys.filter(code => !modifiers.includes(code));
  function update(codes: number[]) {
    actions.updateForm({ type: '0', sequence: codes.map(code => localizedKeyName(code, locale)).join('\n'), customDelay: false });
  }
  function record(event: KeyboardEvent<HTMLButtonElement>) {
    if (!recording || disabled || event.nativeEvent.isComposing || event.repeat) return;
    event.preventDefault();
    if (event.key === 'Escape') { setRecording(false); return; }
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return;
    try {
      const aliases: Record<string, string> = { Space: 'Space', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };
      const code = parseKey(aliases[event.code] ?? (/^(Key[A-Z]|Digit\d)$/.test(event.code) ? event.code.replace(/^(Key|Digit)/, '') : event.key));
      update([...(event.ctrlKey ? [67] : []), ...(event.metaKey ? [68] : []), ...(event.altKey ? [69] : []), ...(event.shiftKey ? [55] : []), code]);
      setRecordError(false);
    } catch { setRecordError(true); }
    setRecording(false);
  }
  return <div className="shortcut-editor">
    <Label>{t('mapping.modifiers')}</Label>
    <div className="modifier-options">{modifiers.map(code => <Label key={code} className="modifier-option"><Checkbox disabled={disabled} checked={keys.includes(code)}
      onCheckedChange={checked => update(checked ? [...keys, code] : keys.filter(key => key !== code))} />{localizedKeyName(code, locale)}</Label>)}</div>
    <Label>{t('mapping.mainKey')}</Label>
    <ActionPicker disabled={disabled} value={mainKeys.length === 1 ? mainKeys[0] : undefined} onChoose={code => update([...new Set([...keys.filter(key => modifiers.includes(key)), code])])} />
    <div className="shortcut-preview" aria-label={t('mapping.chordPreview')}>{keys.map((code, index) => <Button key={`${code}-${index}`} variant="secondary" size="sm" disabled={disabled}
      aria-label={t('mapping.removeKey', { key: localizedKeyName(code, locale) })} onClick={() => update(keys.filter((_, position) => position !== index))}>{localizedKeyName(code, locale)}<X /></Button>)}</div>
    <Button variant="outline" disabled={disabled} onClick={() => { setRecording(value => !value); setRecordError(false); }} onKeyDown={record} onBlur={() => setRecording(false)}><Keyboard />{t(recording && !disabled ? 'mapping.recording' : 'mapping.record')}</Button>
    <p className="field-hint">{t('mapping.recordHint')}</p>
    {recordError && <p className="editor-error" role="alert">{t('mapping.recordUnsupported')}</p>}
    <div className="editor-actions"><Button disabled={disabled || !dirty || !keys.length} onClick={() => actions.saveForm(true)}>{t('mapping.useChord')}</Button>
      {dirty && <Button variant="ghost" disabled={disabled} onClick={actions.discardForm}>{t('mapping.discard')}</Button>}</div>
    <Button variant="link" size="sm" disabled={disabled} onClick={onAdvanced}>{t('mapping.moreChord')}</Button>
  </div>;
}
export function KeyEditor() {
  const { t, locale, text } = useI18n();
  const categoryId = useId();
  const profile = useAppStore(state => state.profile);
  const baseline = useAppStore(state => state.baseline);
  const model = useAppStore(state => state.model);
  const key = useAppStore(state => state.key);
  const layer = useAppStore(state => state.layer);
  const form = useAppStore(state => state.form);
  const dirty = useAppStore(state => state.formDirty);
  const formError = useAppStore(state => state.formError);
  const changes = useAppStore(state => state.changes);
  const version = useAppStore(state => state.session.version);
  const locked = useAppStore(isLocked);
  const actions = useAppStore(state => state.actions);
  const definition = profile?.definition(layer * model.keyCount + key);
  const [category, setCategory] = useState(() => {
    if (form.view) return form.view;
    if (form.type !== '0') return 'advanced';
    const codes = readChord(form.sequence);
    if (codes.length > 1) return 'chord';
    return codes[0] >= 108 && codes[0] !== 204 ? 'system' : 'key';
  });
  function selectCategory(value: string) {
    if (value !== 'key' && value !== 'chord' && value !== 'system' && value !== 'advanced') return;
    setCategory(value);
    actions.updateForm({ view: value });
  }
  const disabled = !profile || locked;
  const hasFn = [profile, baseline].some(value => value && model.layers.some((_, index) => {
    const def = value.definition(index * model.keyCount + key);
    return def.type === 0 && def.keys.length === 1 && model.fn.codes.includes(def.keys[0]);
  }));
  const target = profile ? localizedSummary(profile, layer * model.keyCount + key, locale) : '—';
  const position = t('keyboard.position', { position: key + 1 });
  const layerName = text(model.layers[layer]);
  const changed = changes.includes(layer * model.keyCount + key);
  const description = definition?.keys.length === 1 ? keyDescription(definition.keys[0], locale) : undefined;
  return <aside className="inspector" aria-label={t('editor.section')} tabIndex={0}>
    <div className="inspector-header" tabIndex={0} role="group" aria-label={t('mapping.previewTitle')}>
    <div className="key-editor-heading">
      <h2>{t('mapping.previewTitle')}</h2>
      <Button variant="ghost" size="sm" aria-label={t('editor.reset')} title={t('editor.reset')}
        disabled={disabled || (!dirty && !changes.some(index => hasFn ? index % model.keyCount === key : index === layer * model.keyCount + key))} onClick={actions.resetKey}><RotateCcw />{t('editor.reset')}</Button>
    </div>
    <figure className="mapping-preview" aria-label={t('mapping.previewTitle')}>
      <KeycapSample legends={model.layers.map((_, index) => profile ? keycapSummary(profile, index * model.keyCount + key) : '—')}
        position={key} measureKey={key} activeLayer={layer}
        changedLayers={model.layers.map((_, index) => index).filter(index => changes.includes(index * model.keyCount + key))} showNumber={false} />
      <figcaption aria-live="polite">
        <span className="mapping-location"><span>{position}</span>{' '}<span>{layerName}</span></span>{' '}
        <strong className="mapping-assignment">{target}</strong>
        {description && <span className="action-description block">{description}</span>}
      </figcaption>
    </figure>
    {profile && (dirty || changed) && <p className="editor-state" data-draft={dirty} aria-live="polite">
      {dirty ? <PencilLine aria-hidden="true" /> : <Check aria-hidden="true" />}{t(dirty ? 'mapping.draft' : 'mapping.staged')}
    </p>}
    </div>
    <div className="inspector-content" tabIndex={0} aria-label={t('mapping.categories')}>
    <div className="mapping-editor">
      <Label htmlFor={categoryId}>{t('mapping.categories')}</Label>
      <Select value={category} disabled={disabled} onValueChange={selectCategory}>
        <SelectTrigger id={categoryId} aria-label={t('mapping.categories')}><SelectValue /></SelectTrigger>
        <SelectContent>{(['key', 'chord', 'system', 'advanced'] as const).map(item => <SelectItem value={item} key={item}>{t(`mapping.${item}`)}</SelectItem>)}</SelectContent>
      </Select>
      <div className="mapping-editor-content">
        {(category === 'key' || category === 'system') && <>
          {hasFn && <p className="fn-scope">{t('mapping.fnScope', { count: model.layers.length })}</p>}
          <ActionPicker key={category} kind={category} showFnHint={!hasFn} disabled={disabled} value={definition?.type === 0 && definition.keys.length === 1 ? definition.keys[0] : undefined} onChoose={actions.assignKey} />
        </>}
        {category === 'chord' && <ShortcutEditor disabled={disabled} onAdvanced={() => selectCategory('advanced')} />}
        {category === 'advanced' && <><p className="field-hint">{t('mapping.advancedHint')}</p><AdvancedKeyEditor /></>}
      </div>
    </div>
    {hasFn && category !== 'key' && category !== 'system' && <p className="fn-scope">{t('mapping.fnScope', { count: model.layers.length })}</p>}
    {formError && <p className="editor-error" role="alert">{text(formError)}</p>}
    {dirty && category !== 'advanced' && category !== 'chord' && <Button variant="ghost" size="sm" disabled={disabled} onClick={actions.discardForm}>{t('mapping.discard')}</Button>}
    <details className="lighting-section"><summary>{t('lighting.title')}</summary>
      <p className="field-hint">{profile?.lights ? t('lighting.staged') : version && !model.capabilities(version).perKeyRGB ? t('lighting.unsupported') : t('lighting.unavailable')}</p>
      <div className="lighting-controls"><Input type="color" aria-label={t('lighting.color')} disabled={!profile?.lights || locked} value={form.color} onChange={event => actions.updateForm({ color: event.target.value })} />
        <Button variant="outline" size="sm" disabled={!profile?.lights || locked} onClick={() => actions.applyColor()}>{t('lighting.key')}</Button>
        <Button variant="outline" size="sm" disabled={!profile?.lights || locked} onClick={() => actions.applyColor(true)}>{t('lighting.all')}</Button></div>
    </details>
    </div>
  </aside>;
}
