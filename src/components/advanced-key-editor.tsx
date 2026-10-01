import { useI18n } from '@/i18n/use-i18n';
import { KEY_NAMES, keyDescription, localizedKeyName } from '@/i18n/key-names';
import { keyAbbreviation } from '@/i18n/key-labels';
import { Plus } from 'lucide-react';
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
export function AdvancedKeyEditor({ formId }: { formId: string }) {
  const { t, locale } = useI18n();
  const profile = useAppStore((state) => state.profile);
  const form = useAppStore((state) => state.form);
  const locked = useAppStore(isLocked);
  const actions = useAppStore((state) => state.actions);
  const disabled = !profile || locked;
  const type = Number(form.type), custom = type >= 2 && form.customDelay;
  const hint = type === 0 ? t('editor.hint.single') : type === 1 ? t('editor.hint.repeat') : custom ? t('editor.hint.custom') : t('editor.hint.uniform');
  return (
      <form
        id={formId}
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
              {KEY_NAMES.map((_, code) => {
                const abbreviation = keyAbbreviation(code, locale);
                return code === 200 ? null : <option key={code} value={`${localizedKeyName(code, locale)} · #${code}`}
                  label={[abbreviation ? t('mapping.abbreviation', { name: abbreviation }) : '', keyDescription(code, locale)].filter(Boolean).join(' · ') || undefined} />;
              })}
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
            placeholder={'L Cmd\nC'}
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
        </fieldset>
      </form>
  );
}
