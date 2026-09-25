import { describe, expect, test, vi } from 'vitest';
import {
  dictionaries,
  msg,
  renderMessage,
  translate,
  backupReason,
  countMessage,
  type MessageKey,
} from '../src/i18n/core';
import { detectLocale, preferredLocale, persistLocale, localeStorageKey } from '../src/i18n/preferences';
import { KEY_NAMES, ENGLISH_KEY_NAMES, localizedKeyName } from '../src/i18n/key-names';
import { localizedSummary } from '../src/i18n/profile';
import {
  encodeDefinition,
  decodeDefinition,
  parseSequence,
  parseKey,
  ProtocolError,
  sequenceText,
} from '../src/protocol';
import { fixture } from './helpers';

function placeholders(value: string) {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

test('both catalogs contain the same messages and interpolation parameters', () => {
  expect(Object.keys(dictionaries.en).sort()).toEqual(Object.keys(dictionaries['zh-CN']).sort());
  for (const key of Object.keys(dictionaries['zh-CN']) as MessageKey[]) {
    expect(dictionaries.en[key].trim(), key).not.toBe('');
    expect(placeholders(dictionaries.en[key]), key).toEqual(placeholders(dictionaries['zh-CN'][key]));
    expect(dictionaries.en[key], key).not.toMatch(/\p{Script=Han}/u);
  }
});
test('nested error parameters translate without interpreting user text as template syntax', () => {
  const error = new ProtocolError(msg('error.integer', { label: msg('field.interval'), min: 0, max: 65535 }));
  expect(error.message).toBe('间隔必须为 0–65535 的整数。');
  expect(renderMessage(error.description, 'en')).toBe('Interval must be an integer between 0 and 65535.');
  const input = '{count} $& <script>alert(1)</script>';
  expect(translate('en', 'error.keyName', { value: input })).toContain(input);
  error.append(msg('error.partialWrite'));
  expect(renderMessage(error.description, 'en')).toContain('partially written');
});
test('English quantities use singular and plural forms', () => {
  expect(renderMessage(countMessage(1, 'keyboard.macro.one', 'keyboard.macro.other'), 'en')).toBe(
    'Macro · 1 step',
  );
  expect(renderMessage(countMessage(2, 'keyboard.macro.one', 'keyboard.macro.other'), 'en')).toBe(
    'Macro · 2 steps',
  );
  expect(renderMessage(countMessage(1, 'changes.records.one', 'changes.records.other'), 'zh-CN')).toBe(
    '1 条按键记录',
  );
});

describe('language preferences', () => {
  test('matches browser languages in order and falls back to Simplified Chinese', () => {
    expect(detectLocale(['en-GB', 'zh-CN'])).toBe('en');
    expect(detectLocale(['zh-TW', 'en-US'])).toBe('zh-CN');
    expect(detectLocale(['zh_CN'])).toBe('zh-CN');
    expect(detectLocale(['ja-JP', 'en-US'])).toBe('en');
    expect(detectLocale(['fr-FR'])).toBe('zh-CN');
    expect(detectLocale([])).toBe('zh-CN');
  });
  test('saved selections override the browser; invalid preferences are ignored', () => {
    const storage = { getItem: vi.fn(() => 'zh-CN'), setItem: vi.fn() };
    expect(preferredLocale(['en-US'], storage)).toBe('zh-CN');
    expect(storage.getItem).toHaveBeenCalledWith(localeStorageKey);
    storage.getItem.mockReturnValue('unsupported');
    expect(preferredLocale(['en-GB'], storage)).toBe('en');
    persistLocale('en', storage);
    expect(storage.setItem).toHaveBeenCalledWith(localeStorageKey, 'en');
  });
  test('denied local storage does not break detection or switching', () => {
    const storage = {
      getItem() {
        throw new Error('storage denied');
      },
      setItem() {
        throw new Error('storage denied');
      },
    };
    expect(preferredLocale(['en-US'], storage)).toBe('en');
    expect(() => persistLocale('en', storage)).not.toThrow();
  });
});

test('every English and Chinese key name maps back to the same wire code', () => {
  expect(ENGLISH_KEY_NAMES).toHaveLength(256);
  for (let code = 0; code < 256; code++) {
    expect(parseKey(KEY_NAMES[code])).toBe(code);
    expect(parseKey(ENGLISH_KEY_NAMES[code])).toBe(code);
    expect(ENGLISH_KEY_NAMES[code]).not.toMatch(/\p{Script=Han}/u);
  }
  expect(parseKey('Left Command')).toBe(68);
  expect(parseKey('Mouse left button')).toBe(130);
  expect(parseKey('Right Fn')).toBe(156);
  expect(parseKey('Key scan period')).toBe(177);
});
test('localized macro text and mixed-language input preserve the encoded reports', () => {
  const definition = {
    type: 2,
    keys: [68, 58, 166],
    interval: 0,
    cycles: 2,
    customDelay: 1,
    delays: [30, 70],
  };
  const expected = encodeDefinition(definition, 0);
  const english = sequenceText(decodeDefinition(expected), (code) => localizedKeyName(code, 'en'));
  expect(english).toBe('Left Command @30\nC @70\nLeft Fn');
  expect(
    encodeDefinition(parseSequence(english, { type: 2, interval: 0, cycles: 2, customDelay: true }), 0),
  ).toEqual(expected);
  expect(parseSequence('左 Command\nC\nRight Fn', { type: 0 }).keys).toEqual([68, 58, 156]);
});
test('localized summaries and historic backup labels do not mutate stored data', () => {
  const profile = fixture(9);
  profile.setDefinition(0, { type: 0, keys: [68, 58] });
  const before = profile.toJSON();
  expect(localizedSummary(profile, 0, 'en')).toBe('Left Command + C');
  expect(localizedSummary(profile, 0, 'zh-CN')).toBe('左 Command + C');
  expect(profile.toJSON()).toEqual(before);
  expect(renderMessage(backupReason('写入前'), 'en')).toBe('Before writing');
  expect(renderMessage(backupReason('自动读取备份'), 'en')).toBe('Automatic read backup');
  expect(renderMessage(backupReason('Personal note'), 'en')).toBe('Personal note');
});
