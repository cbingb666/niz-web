import type { Locale } from './core';
import { KEY_NAMES, localizedKeyName } from './key-names';

const sharedLabels: Readonly<Record<number, string>> = {
  0: '—', 27: '⌫', 28: 'Tab', 42: 'Caps', 54: 'Enter', 70: 'Space', 73: 'Menu',
  75: 'Wake', 76: 'Sleep', 77: 'Power', 78: 'PrtSc', 79: 'ScrLk', 80: 'Pause',
  81: 'Ins', 82: 'Home', 83: 'PgUp', 84: 'Del', 85: 'End', 86: 'PgDn', 91: 'Num',
  108: '⏭', 109: '⏮', 110: 'Stop', 111: '⏯', 112: 'Mute', 113: 'Vol+', 114: 'Vol−',
  126: 'Ms←', 127: 'Ms→', 128: 'Ms↑', 129: 'Ms↓', 130: 'Ms1', 131: 'Ms2', 132: 'Ms3',
  133: 'Wh↑', 134: 'Wh↓', 144: 'Brt−', 145: 'Brt+',
  151: 'Sft/↑', 152: 'Caps/Ctrl', 155: 'Win/Mac',
  168: 'BT1', 169: 'BT2', 170: 'BT3', 171: 'Game', 172: 'ECO', 199: 'Ms×2', 204: 'ISO\\',
};
const functionLabels: Readonly<Record<number, string>> = {
  115: 'Media', 116: 'Mail', 117: 'Calc', 118: 'PC', 119: 'Find', 120: 'Web',
  121: 'Back', 122: 'Fwd', 123: 'Web×', 124: 'Ref', 125: 'Fav',
  135: 'Light', 136: 'L.Mcr', 137: 'L.Demo', 138: 'Stars', 139: 'Ripple',
  140: 'Demo×', 141: 'Breath', 142: 'BSeq−', 143: 'BSeq+',
  146: 'D/A', 147: 'RGBBr', 148: 'BG clr', 149: 'Travel', 150: 'KLock',
  153: 'WinLk', 154: 'MsLk', 157: 'Ms px', 158: 'Ms int', 159: 'Prog',
  167: 'Wire/WL', 173: 'Ms dly', 174: 'Repeat', 175: 'Resp', 176: 'USB Hz',
  177: 'Scan', 200: 'Delay',
  207: 'Mac Fn', 208: 'Scr−', 209: 'Scr+',
  222: 'Mission', 223: 'Launch', 224: 'Spotlight', 225: 'Dictate', 226: 'DND',
  227: 'SysBL−', 228: 'SysBL+', 229: '⏪', 230: '⏩',
};

/** English legends stay the same in every UI language. */
export function keycapName(code: number): string {
  if (sharedLabels[code]) return sharedLabels[code];
  if (functionLabels[code]) return functionLabels[code];
  if (code >= 92 && code <= 107)
    return 'N' + localizedKeyName(code, 'en').replace('Keypad ', '').replace('Enter', '↵');
  if (code >= 160 && code <= 165) return `LED${code - 159}`;
  if (KEY_NAMES[code]?.startsWith('保留代码 ')) return `Rsv${code}`;
  return localizedKeyName(code, 'en');
}

export function keyAbbreviation(code: number, locale: Locale): string | undefined {
  const label = keycapName(code);
  return label === localizedKeyName(code, locale) ? undefined : label;
}
