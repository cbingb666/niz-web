import { sequenceText, type Profile } from '../protocol';
import { countMessage, renderMessage, translate, type Locale } from './core';
import { localizedKeyName } from './key-names';
import { keycapName } from './key-labels';
import { macSystemKeyOrder } from '../mac-keycodes';

/** Only single actions use a glyph; chords and macros retain their text summaries. */
export function keycapIconCode(profile: Profile, index: number): number | undefined {
  const definition = profile.definition(index);
  const code = definition.keys[0];
  return definition.type === 0 && definition.keys.length === 1 && macSystemKeyOrder.includes(code) ? code : undefined;
}

/** English legends only; accessible labels and editing keep the full localized name. */
export function keycapSummary(profile: Profile, index: number): string {
  const definition = profile.definition(index);
  if (!definition.keys.length) return '—';
  if (definition.type >= 2) return `M·${definition.keys.length}`;
  const names = definition.keys.map(keycapName);
  if (definition.keys.length > 2) return `${names[0]}+${definition.keys.length - 1}`;
  return (definition.type === 1 ? '↻' : '') + names.join('+');
}

export function localizedSummary(profile: Profile, index: number, locale: Locale): string {
  const definition = profile.definition(index);
  if (!definition.keys.length)
    return translate(locale, 'keyboard.unassigned');
  if (definition.type >= 2)
    return renderMessage(
      countMessage(definition.keys.length, 'keyboard.macro.one', 'keyboard.macro.other'),
      locale,
    );
  return definition.keys.map((code) => localizedKeyName(code, locale)).join(' + ');
}

export function localizedDetail(profile: Profile, index: number, locale: Locale): string {
  const definition = profile.definition(index);
  const summary = localizedSummary(profile, index, locale);
  if (definition.type === 0) return summary;
  const mode = ['editor.mode.single', 'editor.mode.repeat', 'editor.mode.macroCycles', 'editor.mode.macroHold', 'editor.mode.macroToggle'] as const;
  const timing = definition.customDelay ? '' : translate(locale, 'mapping.intervalDetail', { ms: definition.interval });
  const cycles = definition.type === 2 ? translate(locale, 'mapping.cyclesDetail', { count: definition.cycles }) : '';
  return [translate(locale, mode[definition.type]), definition.type >= 2 ? sequenceText(definition, code => localizedKeyName(code, locale)) : summary, timing, cycles].filter(Boolean).join('\n');
}
