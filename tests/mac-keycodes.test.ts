import { expect, test } from 'vitest';
import { MAC_NATIVE_VERSION, MAC_STOCK_VERSION, macCodeAvailable, macNativeCodes } from '../src/mac-keycodes';
import { parseKey, encodeDefinition, decodeDefinition } from '../src/protocol';
import { localizedKeyName } from '../src/i18n/key-names';

test('Mac action codes require the exact model and firmware; shared media codes stay available', () => {
  for (const code of macNativeCodes) {
    expect(macCodeAvailable(code, 'atom66', MAC_NATIVE_VERSION)).toBe(true);
    expect(macCodeAvailable(code, 'atom66', MAC_STOCK_VERSION)).toBe(false);
    expect(macCodeAvailable(code, 'atom66', '66EC(RGB)BLe;M1.5.1;V1.0;')).toBe(false);
    expect(macCodeAvailable(code, 'micro84', MAC_NATIVE_VERSION)).toBe(false);
  }
  for (const code of [207, 208, 209]) expect(macCodeAvailable(code, 'atom66', MAC_STOCK_VERSION)).toBe(true);
  expect(macCodeAvailable(208, 'atom66', '66EC(S);V1.4.4;V1.0;')).toBe(false);
  expect(macCodeAvailable(111, 'micro82', '')).toBe(true);
});

test('native names, old reserved labels and numeric input encode one internal byte without a shortcut', () => {
  for (const code of [207, 208, 209, ...macNativeCodes]) {
    for (const text of [localizedKeyName(code, 'en'), localizedKeyName(code, 'zh-CN'), `#${code}`,
      `保留代码 ${code}`, `Reserved code ${code}`]) expect(parseKey(text)).toBe(code);
    const packets = encodeDefinition({ type: 0, keys: [code] }, 0);
    expect(packets).toHaveLength(1);
    expect(decodeDefinition(packets).keys).toEqual([code]);
    expect(packets[0][5]).toBe(1);
    expect(packets[0][6]).toBe(code);
  }
});

test('previous experimental names remain accepted after simplifying the labels', () => {
  for (const [code, names] of [
    [207, ['Mac Fn（实验）', 'Mac Fn (experimental)']],
    [227, ['系统键盘背光 −（实验）', 'System keyboard backlight down (experimental)']],
    [228, ['系统键盘背光 +（实验）', 'System keyboard backlight up (experimental)']],
  ] as const) for (const name of names) expect(parseKey(name)).toBe(code);
});
