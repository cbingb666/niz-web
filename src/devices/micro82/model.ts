import { msg } from '../../i18n/core.ts';
import { defineModel } from '../model.ts';

// Wire order follows the official 82EC client. See docs/micro-research.md.
const labels =
  "Esc|F1|F2|F3|F4|F5|F6|F7|F8|F9|F10|F11|F12|Del|`|1|2|3|4|5|6|7|8|9|0|-|=|⌫|Home|Tab|Q|W|E|R|T|Y|U|I|O|P|[|]|\\|PgUp|Caps|A|S|D|F|G|H|J|K|L|;|'|Return|PgDn|Shift|Z|X|C|V|B|N|M|,|.|/|Shift|↑|End|Ctrl|Win|Alt|Space|Alt|Fn|Ctrl|←|↓|→".split('|');
const widths: number[][] = [
  Array(14).fill(1),
  [...Array(13).fill(1), 2, 1],
  [1.5, ...Array(12).fill(1), 1.5, 1],
  [1.75, ...Array(11).fill(1), 2.25, 1],
  [2.25, ...Array(10).fill(1), 1.75, 1, 1],
  [1.25, 1.25, 1.25, 6.25, 1, 1, 1, 1, 1, 1],
];
let position = 0;
export const micro82 = defineModel({
  id: 'micro82',
  name: 'MICRO82',
  hardwareValidation: 'unverified',
  protocol: 'niz-ec',
  // mi_01 is vendor evidence; usage 8c/1 is an EC-family inference, also
  // guarded by the session's actual 64-byte ID-0 report descriptor check.
  filters: [0x502f, 0x512f, 0x522f, 0x532f].map((productId) => ({
    vendorId: 0x0483, productId, usagePage: 0x8c, usage: 1,
  })),
  matchesFirmware: (version) => /^82EC\((?:S|XRGB)\)(?:B[Ll]e)?;/.test(version),
  capabilities: (version) => ({ counters: true, perKeyRGB: version.includes('XRGB') }),
  legacyRoots: ['82EC(S)', '82EC(S)Ble', '82EC(XRGB)', '82EC(XRGB)Ble'],
  legacyGroupCount: 3,
  rows: widths.map((row, rowIndex) => row.map((width, key) => ({
    label: labels[position++], width,
    ...(rowIndex === 0 && [1, 5, 9, 13].includes(key) ? { gapBefore: 0.5 } : {}),
  }))),
  layers: [msg('layer.normal'), msg('layer.rightFn'), msg('layer.leftFn')],
  groupCounts: [3],
  fn: { codes: [156, 166], required: true },
  demoColor: [66, 221, 180],
  // Illustrative mappings, not a factory configuration or a hardware capture.
  demoKeys: [
    [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 84,
      14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 82,
      28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 83,
      42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 86,
      55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 87, 85,
      67, 68, 69, 70, 71, 156, 74, 88, 89, 90,
    ],
    [],
    [],
  ],
});
