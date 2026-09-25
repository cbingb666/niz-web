import { msg } from '../../i18n/core.ts';
import { defineModel } from '../model.ts';

const labels =
  "Esc|1|2|3|4|5|6|7|8|9|0|-|=|\\|`|Tab|Q|W|E|R|T|Y|U|I|O|P|[|]|⌫|Caps|A|S|D|F|G|H|J|K|L|;|'|Return|Shift|Z|X|C|V|B|N|M|,|.|/|Shift / ↑|R Fn|Ctrl|Win|Alt|L Fn|Space|Alt|Menu|Ctrl|←|↓|→".split('|');
const widths: number[][] = [
  Array(15).fill(1),
  [1.5, ...Array(12).fill(1), 1.5],
  [1.75, ...Array(11).fill(1), 2.25],
  [2.25, ...Array(10).fill(1), 1.75, 1],
  [1.25, 1.25, 1.25, 1.25, 4, 1, 1, 1, 1, 1, 1],
];
let position = 0;
export const atom66 = defineModel({
  id: 'atom66',
  name: 'ATOM66',
  protocol: 'niz-ec',
  filters: [0x502a, 0x512a, 0x522a].map((productId) => ({
    vendorId: 0x0483, productId, usagePage: 0x8c, usage: 1,
  })),
  matchesFirmware: (version) => version.startsWith('66EC'),
  capabilities: (version) => ({ counters: true, perKeyRGB: version.includes('RGB') }),
  rows: widths.map((row) => row.map((width) => ({ label: labels[position++], width }))),
  layers: [msg('layer.normal'), msg('layer.rightFn'), msg('layer.leftFn')],
  groupCounts: [3, 9],
  fn: { codes: [156, 166], required: true },
  demoColor: [66, 221, 180],
  demoKeys: [
    [
      1, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 41, 14, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
      40, 27, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65,
      66, 156, 67, 68, 69, 166, 70, 71, 73, 74, 88, 89, 90,
    ],
    [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  ],
});
