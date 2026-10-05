import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, Keyboard, PencilLine, RotateCcw, X } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';
import { keyDescription, localizedKeyName } from '@/i18n/key-names';
import { keycapSummary, localizedSummary, keycapIconCode } from '@/i18n/profile';
import { parseKey, parseSequence } from '@/protocol';
import { useAppStore } from '@/store/context';
import { isLocked } from '@/store/app-store';
import type { MappingView } from '@/store/mapping-browser';
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
function canEditChord(type: string, sequence: string) {
  if (type !== '0') return false;
  try { parseSequence(sequence, { type: 0 }); return true; } catch { return false; }
}
function ShortcutEditor({ disabled, onAdvanced }: { disabled: boolean; onAdvanced(): void }) {
  const { t, locale } = useI18n();
  const form = useAppStore(state => state.form);
  const actions = useAppStore(state => state.actions);
  const previewId = useId();
  const recordHintId = useId();
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
    if (event.key === 'Tab') { setRecording(false); return; }
    event.preventDefault();
    event.stopPropagation();
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
    <div className="shortcut-summary" role="group" aria-labelledby={previewId}>
      <p id={previewId} className="field-hint">{t('mapping.chordPreview')}</p>
      <div className="shortcut-preview" aria-live="polite">{keys.map((code, index) => <Button key={`${code}-${index}`} variant="secondary" size="sm" disabled={disabled}
        aria-label={t('mapping.removeKey', { key: localizedKeyName(code, locale) })} onClick={() => update(keys.filter((_, position) => position !== index))}>{localizedKeyName(code, locale)}<X aria-hidden="true" /></Button>)}
        {!keys.length && <p className="field-hint">{t('mapping.chordEmpty')}</p>}
      </div>
    </div>
    <div className="shortcut-record">
      <Button variant="outline" disabled={disabled} aria-pressed={recording && !disabled} aria-describedby={recordHintId}
        data-editor-escape={recording && !disabled ? true : undefined}
        onClick={() => { setRecording(value => !value); setRecordError(false); }} onKeyDown={record} onBlur={() => setRecording(false)}><Keyboard />{t(recording && !disabled ? 'mapping.recording' : 'mapping.record')}</Button>
      <p id={recordHintId} className="field-hint">{t(recording ? 'mapping.recordHint' : 'mapping.recordIdleHint')}</p>
      {recordError && <p className="editor-error" role="alert">{t('mapping.recordUnsupported')}</p>}
    </div>
    <fieldset className="modifier-fieldset">
    <legend>{t('mapping.modifiers')}</legend>
    <div className="modifier-options">{modifiers.map(code => <Label key={code} className="modifier-option"><Checkbox disabled={disabled} checked={keys.includes(code)}
      onCheckedChange={checked => update(checked ? [...keys, code] : keys.filter(key => key !== code))} />{localizedKeyName(code, locale)}</Label>)}</div>
    </fieldset>
    <ActionPicker scope="chord" label={t('mapping.mainKey')} disabled={disabled} value={mainKeys.length === 1 ? mainKeys[0] : undefined} onChoose={code => update([...new Set([...keys.filter(key => modifiers.includes(key)), code])])} />
    <Button variant="link" size="sm" disabled={disabled} onClick={onAdvanced}>{t('mapping.moreChord')}</Button>
  </div>;
}
export function KeyEditor() {
  const { t, locale, text } = useI18n();
  const categoryId = useId();
  const formId = useId();
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
  const browserView = useAppStore(state => state.mappingBrowser.view);
  const definition = profile?.definition(layer * model.keyCount + key);
  const [category, setCategory] = useState<MappingView>(() => {
    if (!dirty) return browserView;
    if (form.view) return form.view;
    if (form.type !== '0') return 'advanced';
    const codes = readChord(form.sequence);
    if (codes.length > 1) return 'chord';
    return 'key';
  });
  const content = useRef<HTMLDivElement>(null);
  const inspector = useRef<HTMLElement>(null);
  const contentScroll = useAppStore(state => state.mappingBrowser.contentScroll[category]);
  const contentAnchor = useAppStore(state => state.mappingBrowser.contentAnchors[category]);
  const recentActions = useAppStore(state => state.mappingBrowser.recentActions);
  useLayoutEffect(() => {
    const container = content.current;
    if (!container) return;
    container.scrollTop = contentScroll;
    const anchor = contentAnchor && container.querySelector<HTMLElement>(`[data-action-code="${contentAnchor.code}"]`);
    if (anchor && inspector.current)
      container.scrollTop += anchor.getBoundingClientRect().top - inspector.current.getBoundingClientRect().top - contentAnchor.offset;
  }, [category, contentScroll, contentAnchor, recentActions, profile, dirty, formError]);
  function rememberScroll() {
    const container = content.current;
    if (!container || !inspector.current) return;
    const bounds = container.getBoundingClientRect();
    const visible = container.scrollTop > 0 && Array.from(container.querySelectorAll<HTMLElement>('[data-action-code]')).find(option => {
      const rect = option.getBoundingClientRect();
      return rect.bottom > bounds.top && rect.top < bounds.bottom;
    });
    actions.setMappingScroll(category, container.scrollTop, visible ? {
      code: Number(visible.dataset.actionCode),
      offset: visible.getBoundingClientRect().top - inspector.current.getBoundingClientRect().top,
    } : undefined);
  }
  function selectCategory(value: string) {
    if (value !== 'key' && value !== 'chord' && value !== 'advanced') return;
    setCategory(value);
    actions.setMappingView(value);
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
  const quickChoice = category === 'key';
  const guardedDraft = dirty && (quickChoice || (category === 'chord' && !canEditChord(form.type, form.sequence)));
  return <aside className="inspector" ref={inspector} aria-label={t('editor.section')} tabIndex={0}>
    <div className="inspector-header" tabIndex={0} role="group" aria-label={t('mapping.previewTitle')}>
    <div className="key-editor-heading">
      <h2>{t('mapping.previewTitle')}</h2>
      <Button variant="ghost" size="sm" aria-label={t('editor.reset')} title={t('editor.reset')}
        disabled={disabled || (!dirty && !changes.some(index => hasFn ? index % model.keyCount === key : index === layer * model.keyCount + key))} onClick={actions.resetKey}><RotateCcw />{t('editor.reset')}</Button>
    </div>
    <figure className="mapping-preview" aria-label={t('mapping.previewTitle')}>
      <KeycapSample legends={model.layers.map((_, index) => profile ? keycapSummary(profile, index * model.keyCount + key) : '—')}
        iconCodes={model.layers.map((_, index) => profile ? keycapIconCode(profile, index * model.keyCount + key) : undefined)}
        position={key} measureKey={key} activeLayer={layer}
        changedLayers={model.layers.map((_, index) => index).filter(index => changes.includes(index * model.keyCount + key))} showNumber={false} />
      <figcaption aria-live="polite">
        <span className="mapping-location"><span>{position}</span>{' '}<span className="mapping-layer">{layerName}</span></span>{' '}
        <strong className="mapping-assignment">{target}</strong>
        {description && <span className="action-description block">{description}</span>}
      </figcaption>
    </figure>
    {profile && (dirty || changed) && <p className="editor-state" data-draft={dirty} aria-live="polite">
      {dirty ? <PencilLine aria-hidden="true" /> : <Check aria-hidden="true" />}{t(dirty ? 'mapping.draft' : 'mapping.staged')}
    </p>}
    </div>
    <div className="inspector-content" ref={content} tabIndex={0} aria-label={t('mapping.categories')}
      onScroll={rememberScroll}>
    <div className="mapping-editor">
      <Label htmlFor={categoryId}>{t('mapping.categories')}</Label>
      <Select value={category} disabled={disabled} onValueChange={selectCategory}>
        <SelectTrigger id={categoryId} aria-label={t('mapping.categories')}><SelectValue /></SelectTrigger>
        <SelectContent>{(['key', 'chord', 'advanced'] as const).map(item => <SelectItem value={item} key={item}>{t(`mapping.${item}`)}</SelectItem>)}</SelectContent>
      </Select>
      <div className="mapping-editor-content">
        {category === 'key' && <>
          {guardedDraft && <p className="draft-guard">{t('mapping.finishCurrentDraft')}</p>}
          {hasFn && <p className="fn-scope">{t('mapping.fnScope', { count: model.layers.length })}</p>}
          <ActionPicker showFnHint={!hasFn} disabled={disabled} selectionDisabled={dirty} value={definition?.type === 0 && definition.keys.length === 1 ? definition.keys[0] : undefined}
            onChoose={code => { rememberScroll(); actions.assignKey(code); }} />
        </>}
        {category === 'chord' && <>
          {guardedDraft && <p className="draft-guard">{t('mapping.finishCurrentDraft')}</p>}
          <ShortcutEditor disabled={disabled || guardedDraft} onAdvanced={() => selectCategory('advanced')} />
        </>}
        {category === 'advanced' && <AdvancedKeyEditor formId={formId} />}
      </div>
    </div>
    {hasFn && category !== 'key' && <p className="fn-scope">{t('mapping.fnScope', { count: model.layers.length })}</p>}
    <details className="lighting-section"><summary>{t('lighting.title')}</summary>
      <p className="field-hint">{profile?.lights ? t('lighting.staged') : version && !model.capabilities(version).perKeyRGB ? t('lighting.unsupported') : t('lighting.unavailable')}</p>
      {profile?.lights && <div className="lighting-controls"><Input type="color" aria-label={t('lighting.color')} disabled={locked} value={form.color} onChange={event => actions.updateForm({ color: event.target.value })} />
        <Button variant="outline" size="sm" disabled={locked} onClick={() => actions.applyColor()}>{t('lighting.key')}</Button>
        <Button variant="outline" size="sm" disabled={locked} onClick={() => actions.applyColor(true)}>{t('lighting.all')}</Button></div>}
    </details>
    </div>
    {(!quickChoice || dirty || formError) && <div className="inspector-footer">
      {formError && <p className="editor-error" role="alert">{text(formError)}</p>}
      <div className="editor-actions">
        {quickChoice || guardedDraft ? dirty && <Button disabled={disabled} onClick={() => selectCategory(quickChoice && canEditChord(form.type, form.sequence) ? 'chord' : 'advanced')}>{t('mapping.resumeDraft')}</Button>
          : <Button type={category === 'advanced' ? 'submit' : 'button'} form={category === 'advanced' ? formId : undefined}
            disabled={disabled || !dirty || (category === 'chord' && !readChord(form.sequence).length)}
            onClick={category === 'chord' ? () => actions.saveForm(true) : undefined}>{t(category === 'chord' ? 'mapping.useChord' : 'editor.save')}</Button>}
        {dirty && <Button variant="ghost" disabled={disabled} onClick={() => {
          actions.discardForm();
          document.getElementById(categoryId)?.focus({ preventScroll: true });
        }}>{t('mapping.discard')}</Button>}
      </div>
    </div>}
  </aside>;
}
