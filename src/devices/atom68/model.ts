import { msg } from '../../i18n/core.ts';
import { defineModel } from '../model.ts';

// Wire IDs and captions follow the official 68EC client, not ATOM66 or a
// product photo's replaceable legends. See docs/atom68-research.md.
const labels =
  "Esc|1|2|3|4|5|6|7|8|9|0|-|=|⌫|`|Tab|Q|W|E|R|T|Y|U|I|O|P|[|]|\\|PgUp|Caps|A|S|D|F|G|H|J|K|L|;|'|Return|PgDn|Shift|Z|X|C|V|B|N|M|,|.|/|Shift|↑|End|Ctrl|Win|Alt|Space|Alt|Fn|Ctrl|←|↓|→".split('|');
const widths: number[][] = [
  [...Array(13).fill(1), 2, 1],
  [1.5, ...Array(12).fill(1), 1.5, 1],
  [1.75, ...Array(11).fill(1), 2.25, 1],
  [2.25, ...Array(10).fill(1), 1.75, 1, 1],
  [1.25, 1.25, 1.25, 6.25, 1, 1, 1, 1, 1, 1],
];
let position = 0;
export const atom68 = defineModel({
  id: 'atom68',
  name: 'ATOM68',
  hardwareValidation: 'unverified',
  protocol: 'niz-ec',
  // The client identifies these PIDs on mi_01. Usage 8c/1 remains a
  // cross-family candidate; the session also requires 64-byte ID-0 reports.
  filters: [0x5032, 0x5132, 0x5232, 0x5332].map((productId) => ({
    vendorId: 0x0483, productId, usagePage: 0x8c, usage: 1,
  })),
  matchesFirmware: (version) => /^68EC\((?:S|XRGB)\)(?:B[Ll]e)?;/.test(version),
  capabilities: (version) => ({ counters: true, perKeyRGB: version.includes('XRGB') }),
  legacyRoots: ['68EC(S)', '68EC(S)Ble', '68EC(XRGB)', '68EC(XRGB)Ble'],
  legacyGroupCount: 6,
  rows: widths.map((row) => row.map((width) => ({ label: labels[position++], width }))),
  layers: [msg('layer.normal'), msg('layer.rightFn'), msg('layer.leftFn')],
  groupCounts: [3, 6],
  fn: { codes: [156, 166], required: true },
  demoColor: [66, 221, 180],
  // Illustrative mappings only; the hardware configuration is read explicitly.
  demoKeys: [
    [
      1, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 14,
      28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 83,
      42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 86,
      55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 87, 85,
      67, 68, 69, 70, 71, 156, 74, 88, 89, 90,
    ],
    [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  ],
});
