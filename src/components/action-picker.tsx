import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { KEY_NAMES, ENGLISH_KEY_NAMES, KEY_DESCRIPTIONS, keyDescription, localizedKeyName } from '@/i18n/key-names';
import { keyAbbreviation, keycapName } from '@/i18n/key-labels';
import { useI18n } from '@/i18n/use-i18n';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const common = [0, 1, 67, 42, 27, 54, 70, 84, 28, 58, 59];
const groups = ['common', 'all', 'letters', 'navigation', 'function', 'media', 'mouse', 'lighting', 'device', 'reserved'] as const;
type Group = (typeof groups)[number];
const normalizeSearch = (value: string) => value.toLowerCase().replaceAll('−', '-');
function groupFor(code: number): Group {
  if (code >= 178 && code !== 199 && code !== 204) return 'reserved';
  if (code >= 2 && code <= 13) return 'function';
  if (code >= 108 && code <= 125) return 'media';
  if ((code >= 126 && code <= 134) || code === 199) return 'mouse';
  if (code >= 135 && code <= 148) return 'lighting';
  if (code >= 149 && code <= 177) return 'device';
  if ((code >= 15 && code <= 24) || (code >= 29 && code <= 38) || (code >= 43 && code <= 51) || (code >= 56 && code <= 62)) return 'letters';
  return 'navigation';
}
export function ActionPicker({ kind = 'key', value, disabled, onChoose }: {
  kind?: 'key' | 'system'; value?: number; disabled: boolean; onChoose(code: number): void;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const model = useAppStore(state => state.model);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<Group>(kind === 'system' ? 'media' : 'common');
  const [highlight, setHighlight] = useState(0);
  const options = useRef<HTMLDivElement>(null);
  const search = normalizeSearch(query.trim());
  const matches = KEY_NAMES.map((_, code) => code).filter((code) => {
    if (code === 200) return false;
    if (/^#\d+$/.test(search)) return code === Number(search.slice(1));
    if (search) return normalizeSearch(`${localizedKeyName(code, locale)} ${keycapName(code)} ${KEY_NAMES[code]} ${ENGLISH_KEY_NAMES[code]} ${Object.values(KEY_DESCRIPTIONS[code] ?? {}).join(' ')} ${code === 70 ? '空格' : ''} ${code === 67 || code === 74 ? 'ctrl' : ''}`).includes(search);
    return group === 'common' ? common.includes(code) : group === 'all' || groupFor(code) === group;
  });
  if (!search && group === 'common') matches.sort((a, b) => common.indexOf(a) - common.indexOf(b));
  if (search) {
    const exact = (code: number) => [localizedKeyName(code, locale), keycapName(code), KEY_NAMES[code], ENGLISH_KEY_NAMES[code]].some(name => normalizeSearch(name) === search);
    matches.sort((a, b) => Number(exact(b)) - Number(exact(a)));
  }
  function navigate(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.max(0, Math.min(matches.length - 1, highlight + (event.key === 'ArrowDown' ? 1 : -1)));
      setHighlight(next);
      options.current?.children[next]?.scrollIntoView?.({ block: 'nearest' });
    } else if (event.key === 'Enter' && matches[highlight] !== undefined) {
      event.preventDefault(); onChoose(matches[highlight]);
    } else if (event.key === 'Escape') { setQuery(''); setHighlight(0); }
  }
  return <div className="action-picker">
    <Label htmlFor={id}>{t('mapping.choose')}</Label>
    <Input id={id} type="search" value={query} disabled={disabled} autoComplete="off"
      placeholder={t('mapping.search')} onKeyDown={navigate} aria-describedby={`${id}-result`}
      onChange={(event) => { setQuery(event.target.value); setHighlight(0); }} />
    <Select value={group} disabled={disabled} onValueChange={(value) => { setGroup(value as Group); setHighlight(0); }}>
      <SelectTrigger aria-label={t('mapping.group')}><SelectValue /></SelectTrigger>
      <SelectContent>{groups.map((item) => <SelectItem key={item} value={item}>{t(`mapping.${item}`)}</SelectItem>)}</SelectContent>
    </Select>
    <div id={`${id}-result`} className="sr-only" aria-live="polite">{search && matches[highlight] !== undefined ? localizedKeyName(matches[highlight], locale) : ''}</div>
    {matches.some(code => model.fn.codes.includes(code)) && <p className="fn-scope">{t('mapping.fnScope', { count: model.layers.length })}</p>}
    <div className="action-options" ref={options}>
      {matches.map((code, index) => {
        const abbreviation = keyAbbreviation(code, locale);
        const description = keyDescription(code, locale);
        return <Button key={code} type="button" variant="outline" className={`action-option ${search && index === highlight ? 'search-highlight' : ''}`}
          disabled={disabled} aria-pressed={code === value} onClick={() => onChoose(code)}>
          <span>{localizedKeyName(code, locale)}</span>
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
