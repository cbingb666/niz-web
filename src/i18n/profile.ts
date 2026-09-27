import { sequenceText, type Profile } from '../protocol';
import { countMessage, renderMessage, translate, type Locale } from './core';
import { localizedKeyName, SIDED_KEY_NAMES } from './key-names';

const keycapNames: Record<number, string> = {
  ...SIDED_KEY_NAMES,
  0: '∅', 27: '⌫', 28: 'Tab', 42: 'Caps', 54: 'Enter', 70: 'Space', 73: 'Menu',
  75: 'Wake', 76: 'Sleep', 77: 'Power', 78: 'PrtSc', 79: 'ScrLk', 80: 'Pause',
  81: 'Ins', 82: 'Home', 83: 'PgUp', 84: 'Del', 85: 'End', 86: 'PgDn', 91: 'Num',
  108: '⏭', 109: '⏮', 110: 'Stop', 111: '⏯', 112: 'Mute', 113: 'Vol+', 114: 'Vol−',
  126: 'Ms←', 127: 'Ms→', 128: 'Ms↑', 129: 'Ms↓', 130: 'Ms1', 131: 'Ms2', 132: 'Ms3',
  133: 'Wh↑', 134: 'Wh↓', 144: 'Brt−', 145: 'Brt+',
  168: 'BT1', 169: 'BT2', 170: 'BT3', 171: 'Game', 172: 'ECO', 199: 'Ms×2', 204: 'ISO\\',
};

/** Display legends only; accessible labels and editing keep the full localized name. */
export function keycapSummary(profile: Profile, index: number, locale: Locale): string {
  const definition = profile.definition(index);
  if (!definition.keys.length) return index >= profile.model.keyCount ? '—' : '∅';
  if (definition.type >= 2) return `M·${definition.keys.length}`;
  const names = definition.keys.map(code => {
    if (keycapNames[code]) return keycapNames[code];
    if (code >= 92 && code <= 107)
      return 'N' + localizedKeyName(code, 'en').replace('Keypad ', '').replace('Enter', '↵');
    const name = localizedKeyName(code, locale);
    const short = locale === 'zh-CN'
      ? name.replace('鼠标', '鼠').replace('亮度', '亮').replace('播放/暂停', '⏯').replace('音量', '音').replace('触发行程', '行程').replace('键盘锁', '锁键').replace('编程模式切换', '编程').replace('按键响应延迟', '响应').replace('按键重复速度', '重复').replace('按键扫描周期', '扫描').replace('USB 报告率', 'USB率')
      : name;
    return short.length <= (locale === 'zh-CN' ? 4 : 6) ? short : `#${code}`;
  });
  if (definition.keys.length > 2) return `${names[0]}+${definition.keys.length - 1}`;
  return (definition.type === 1 ? '↻' : '') + names.join('+');
}

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

export function localizedDetail(profile: Profile, index: number, locale: Locale): string {
  const definition = profile.definition(index);
  const summary = localizedSummary(profile, index, locale);
  if (definition.type === 0) return summary;
  const mode = ['editor.mode.single', 'editor.mode.repeat', 'editor.mode.macroCycles', 'editor.mode.macroHold', 'editor.mode.macroToggle'] as const;
  const timing = definition.customDelay ? '' : translate(locale, 'mapping.intervalDetail', { ms: definition.interval });
  const cycles = definition.type === 2 ? translate(locale, 'mapping.cyclesDetail', { count: definition.cycles }) : '';
  return [translate(locale, mode[definition.type]), definition.type >= 2 ? sequenceText(definition, code => localizedKeyName(code, locale)) : summary, timing, cycles].filter(Boolean).join('\n');
}
