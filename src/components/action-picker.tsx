import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, Search, X } from 'lucide-react';
import { KEY_NAMES, ENGLISH_KEY_NAMES, KEY_ALIASES, KEY_DESCRIPTIONS, keyDescription, localizedKeyName } from '@/i18n/key-names';
import { keyAbbreviation, keycapName } from '@/i18n/key-labels';
import { useI18n } from '@/i18n/use-i18n';
import { useAppStore } from '@/store/context';
import { isMacCode, macCodeAvailable } from '@/mac-keycodes';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const common = [0, 1, 67, 42, 27, 54, 70, 84, 28, 58, 59];
const groups = ['all', 'common', 'letters', 'navigation', 'function', 'mac', 'media', 'mouse', 'lighting', 'device', 'reserved'] as const;
type Group = (typeof groups)[number];
const normalizeSearch = (value: string) => value.toLowerCase().replaceAll('−', '-');
function groupFor(code: number): Group {
  if (isMacCode(code)) return 'mac';
  if (code >= 178 && code !== 199 && code !== 204) return 'reserved';
  if (code >= 2 && code <= 13) return 'function';
  if (code >= 108 && code <= 125) return 'media';
  if ((code >= 126 && code <= 134) || code === 199) return 'mouse';
  if (code >= 135 && code <= 148) return 'lighting';
  if (code >= 149 && code <= 177) return 'device';
  if ((code >= 15 && code <= 24) || (code >= 29 && code <= 38) || (code >= 43 && code <= 51) || (code >= 56 && code <= 62)) return 'letters';
  return 'navigation';
}
export function ActionPicker({ value, disabled, selectionDisabled = false, showFnHint = true, label, onChoose }: {
  value?: number; disabled: boolean; selectionDisabled?: boolean; showFnHint?: boolean; label?: string; onChoose(code: number): void;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const model = useAppStore(state => state.model);
  const version = useAppStore(state => state.profile?.version ?? '');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<Group>('all');
  const [highlight, setHighlight] = useState(0);
  const options = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const search = normalizeSearch(query.trim());
  const matches = KEY_NAMES.map((_, code) => code).filter((code) => {
    if (code === 200) return false;
    if (/^#\d+$/.test(search)) return code === Number(search.slice(1));
    if (search) return normalizeSearch(`${localizedKeyName(code, locale)} ${keycapName(code)} ${KEY_NAMES[code]} ${ENGLISH_KEY_NAMES[code]} ${(KEY_ALIASES[code] ?? []).join(' ')} ${Object.values(KEY_DESCRIPTIONS[code] ?? {}).join(' ')} ${code === 70 ? '空格' : ''} ${code === 67 || code === 74 ? 'ctrl' : ''}`).includes(search);
    return group === 'common' ? common.includes(code) : group === 'all' || groupFor(code) === group ||
      (group === 'mac' && [108, 109, 111, 112, 113, 114].includes(code));
  });
  if (!search && group === 'common') matches.sort((a, b) => common.indexOf(a) - common.indexOf(b));
  if (search) {
    const exact = (code: number) => [localizedKeyName(code, locale), keycapName(code), KEY_NAMES[code], ENGLISH_KEY_NAMES[code], ...(KEY_ALIASES[code] ?? [])].some(name => normalizeSearch(name) === search);
    matches.sort((a, b) => Number(exact(b)) - Number(exact(a)));
  }
  const activeIndex = Math.min(highlight, Math.max(0, matches.length - 1));
  function focusOption(index: number, direction: number) {
    let next = Math.max(0, Math.min(matches.length - 1, index));
    const buttons = options.current?.querySelectorAll<HTMLButtonElement>('button');
    while (buttons?.[next]?.disabled) next += direction;
    if (next < 0 || next >= matches.length) return;
    setHighlight(next);
    const option = buttons?.[next];
    option?.focus();
    option?.scrollIntoView?.({ block: 'nearest' });
  }
  function clearSearch() {
    setQuery('');
    setHighlight(0);
    searchInput.current?.focus();
  }
  function navigate(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !selectionDisabled && matches.length) {
      event.preventDefault();
      focusOption(event.key === 'ArrowDown' ? 0 : matches.length - 1, event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (!disabled && !selectionDisabled && matches[activeIndex] !== undefined &&
        macCodeAvailable(matches[activeIndex], model.id, version)) onChoose(matches[activeIndex]);
    } else if (event.key === 'Escape' && query) {
      event.preventDefault(); event.stopPropagation(); clearSearch();
    }
  }
  function navigateOptions(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.nativeEvent.isComposing) return;
    const offset = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (offset || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusOption(event.key === 'Home' ? 0 : event.key === 'End' ? matches.length - 1 : index + offset,
        event.key === 'Home' ? 1 : event.key === 'End' ? -1 : offset);
    } else if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); searchInput.current?.focus();
    }
  }
  return <div className="action-picker">
    <Label htmlFor={id}>{label ?? t('mapping.choose')}</Label>
    <div className="action-search">
      <Search aria-hidden="true" />
      <Input ref={searchInput} id={id} type="search" value={query} disabled={disabled} autoComplete="off"
        data-editor-escape={query ? true : undefined}
        placeholder={t('mapping.search')} onKeyDown={navigate} aria-controls={`${id}-options`} aria-describedby={`${id}-hint`}
        onChange={(event) => { setQuery(event.target.value); setHighlight(0); }} />
      {query && <Button variant="ghost" size="icon" disabled={disabled} aria-label={t('mapping.clearSearch')} onClick={clearSearch}><X /></Button>}
    </div>
    {search ? <p className="field-hint" id={`${id}-hint`}>{t('mapping.searchAll')}</p> : <div className="action-filter">
      <Label htmlFor={`${id}-group`}>{t('mapping.group')}</Label>
      <Select value={group} disabled={disabled} onValueChange={(value) => { setGroup(value as Group); setHighlight(0); }}>
      <SelectTrigger id={`${id}-group`}><SelectValue /></SelectTrigger>
      <SelectContent>{groups.map((item) => <SelectItem key={item} value={item}>{t(`mapping.${item}`)}</SelectItem>)}</SelectContent>
      </Select>
      <span className="sr-only" id={`${id}-hint`}>{t('mapping.searchKeys')}</span>
    </div>}
    <div className="action-result-count" role="status">{t('mapping.results', { count: matches.length })}</div>
    {showFnHint && matches.some(code => model.fn.codes.includes(code)) && <p className="fn-scope">{t('mapping.fnScope', { count: model.layers.length })}</p>}
    <div id={`${id}-options`} className="action-options" ref={options} role="group" aria-label={label ?? t('mapping.choose')}>
      {matches.map((code, index) => {
        const abbreviation = keyAbbreviation(code, locale);
        const description = keyDescription(code, locale);
        return <Button key={code} type="button" variant="outline" className="action-option"
          data-editor-escape="true"
          disabled={disabled || selectionDisabled || !macCodeAvailable(code, model.id, version)} tabIndex={index === activeIndex ? 0 : -1} aria-pressed={code === value}
          onFocus={() => setHighlight(index)} onKeyDown={event => navigateOptions(event, index)} onClick={() => onChoose(code)}>
          <span className="action-option-name">{localizedKeyName(code, locale)}{code === value && <Check aria-hidden="true" />}</span>
          {(abbreviation || search) && <span className="action-option-meta">
            {abbreviation && <span className="key-abbreviation" aria-hidden="true" title={t('mapping.abbreviation', { name: abbreviation })}>{abbreviation}</span>}
            {search && <span className="action-category">{t(`mapping.${groupFor(code)}`)}</span>}
          </span>}
          {description && <span className="action-description">{description}</span>}
        </Button>;
      })}
      {!matches.length && <p className="field-hint">{t('mapping.noResults')}</p>}
    </div>
  </div>;
}
