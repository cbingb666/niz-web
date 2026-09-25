import { useI18n } from '@/i18n/use-i18n';
import { KEY_NAMES, ENGLISH_KEY_NAMES } from '@/i18n/key-names';
import { layerMessage } from '@/i18n/core';
import { Plus } from 'lucide-react';
import { PHYSICAL_KEYS } from '@/protocol';
import { useAppStore } from '@/store/context';
import { isLocked } from '@/store/app-store';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';

const modes = [
  'editor.mode.single',
  'editor.mode.repeat',
  'editor.mode.macroCycles',
  'editor.mode.macroHold',
  'editor.mode.macroToggle',
] as const;
export function KeyEditor() {
  const { t, locale } = useI18n();
  const keyNames = locale === 'en' ? ENGLISH_KEY_NAMES : KEY_NAMES;
  const profile = useAppStore((state) => state.profile);
  const key = useAppStore((state) => state.key);
  const layer = useAppStore((state) => state.layer);
  const form = useAppStore((state) => state.form);
  const version = useAppStore((state) => state.session.version);
  const locked = useAppStore(isLocked);
  const actions = useAppStore((state) => state.actions);
  const disabled = !profile || locked;
  const type = Number(form.type),
    custom = type >= 2 && form.customDelay;
  const hint =
    type === 0
      ? t('editor.hint.single')
      : type === 1
        ? t('editor.hint.repeat')
        : custom
          ? t('editor.hint.custom')
          : t('editor.hint.uniform');
  return (
    <aside className="inspector" aria-label={t('editor.section')}>
      <div className="inspector-heading">
        <div>
          <p className="eyebrow">
            {t('editor.position', { position: String(key + 1).padStart(2, '0'), layer: layerMessage(layer) })}
          </p>
          <h2>{PHYSICAL_KEYS[key]}</h2>
        </div>
        <span className="keycap-preview">{PHYSICAL_KEYS[key]}</span>
      </div>
      {!profile && <p className="muted">{t('editor.empty')}</p>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          actions.saveForm(true);
        }}
      >
        <fieldset disabled={disabled} className="grid gap-3">
          <Label htmlFor="key-mode">{t('editor.type')}</Label>
          <Select
            value={form.type}
            onValueChange={(value) => actions.updateForm({ type: value })}
            disabled={disabled}
          >
            <SelectTrigger id="key-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modes.map((mode, index) => (
                <SelectItem key={mode} value={String(index)}>
                  {t(mode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label htmlFor="key-picker">{t('editor.addKey')}</Label>
          <div className="picker-row">
            <Input
              id="key-picker"
              list="key-options"
              placeholder={t('editor.search')}
              autoComplete="off"
              value={form.picker}
              onChange={(event) => actions.updateForm({ picker: event.target.value })}
            />
            <datalist id="key-options">
              {keyNames.map((name, code) =>
                code === 200 ? null : <option key={code} value={`${name} · #${code}`} />,
              )}
            </datalist>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t('editor.appendKey')}
              onClick={actions.addKey}
            >
              <Plus />
            </Button>
          </div>
          <Label htmlFor="key-sequence">
            {t('editor.sequence')} <span className="label-note">{t('editor.perLine')}</span>
          </Label>
          <Textarea
            id="key-sequence"
            rows={5}
            spellCheck={false}
            placeholder={'Command\nC'}
            value={form.sequence}
            onChange={(event) => actions.updateForm({ sequence: event.target.value })}
            aria-describedby="sequence-hint"
          />
          <p id="sequence-hint" className="field-hint">
            {hint}
          </p>
          {type > 0 && (
            <div className="form-row">
              <div className="grid gap-2">
                <Label htmlFor="interval">{t('editor.interval')}</Label>
                <Input
                  id="interval"
                  type="number"
                  min={0}
                  max={65535}
                  step={1}
                  disabled={disabled || custom}
                  value={form.interval}
                  onChange={(event) => actions.updateForm({ interval: event.target.value })}
                />
              </div>
              {type === 2 && (
                <div className="grid gap-2">
                  <Label htmlFor="cycles">{t('editor.cycles')}</Label>
                  <Input
                    id="cycles"
                    type="number"
                    min={1}
                    max={255}
                    step={1}
                    value={form.cycles}
                    onChange={(event) => actions.updateForm({ cycles: event.target.value })}
                  />
                </div>
              )}
            </div>
          )}
          {type >= 2 && (
            <Label className="check-label">
              <Checkbox
                checked={form.customDelay}
                disabled={disabled}
                onCheckedChange={(value) => actions.updateForm({ customDelay: value === true })}
              />
              {t('editor.customDelay')} <span className="label-note">{t('editor.delayHint')}</span>
            </Label>
          )}
          <div className="editor-actions">
            <Button type="submit" variant="secondary">
              {t('editor.save')}
            </Button>
            <Button type="button" variant="ghost" onClick={actions.resetKey}>
              {t('editor.reset')}
            </Button>
          </div>
        </fieldset>
      </form>
      <section className="lighting-section" aria-label={t('lighting.title')}>
        <h3>{t('lighting.title')}</h3>
        <p className="field-hint">
          {profile?.lights
            ? t('lighting.staged')
            : version && !version.includes('RGB')
              ? t('lighting.unsupported')
              : t('lighting.unavailable')}
        </p>
        <div className="lighting-controls">
          <Input
            type="color"
            aria-label={t('lighting.color')}
            disabled={!profile?.lights || locked}
            value={form.color}
            onChange={(event) => actions.updateForm({ color: event.target.value })}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!profile?.lights || locked}
            onClick={() => actions.applyColor()}
          >
            {t('lighting.key')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!profile?.lights || locked}
            onClick={() => actions.applyColor(true)}
          >
            {t('lighting.all')}
          </Button>
        </div>
      </section>
    </aside>
  );
}
