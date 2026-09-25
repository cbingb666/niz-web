import type { Profile } from '../protocol';
import { countMessage, renderMessage, translate, type Locale } from './core';
import { localizedKeyName } from './key-names';

export function localizedSummary(profile: Profile, index: number, locale: Locale): string {
  const definition = profile.definition(index);
  if (!definition.keys.length)
    return translate(locale, index >= profile.model.keyCount ? 'keyboard.unassigned' : 'keyboard.noAction');
  if (definition.type >= 2)
    return renderMessage(
      countMessage(definition.keys.length, 'keyboard.macro.one', 'keyboard.macro.other'),
      locale,
    );
  return definition.keys.map((code) => localizedKeyName(code, locale)).join(' + ');
}
