import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { measureLineStats, prepareWithSegments } from '@chenglou/pretext';
import { fitKeycapText } from '../src/lib/keycap-text';
import { localizedKeyName } from '../src/i18n/key-names';
import { keycapName } from '../src/i18n/key-labels';

// Exercise Pretext's real segmentation/layout with deterministic canvas metrics.
// Font rasterization belongs to the browser; these tests check our fitting contract.
const measureText = vi.fn(function (this: { font: string }, text: string) {
  const size = Number(this.font.match(/(\d+)px/)?.[1] ?? 12);
  const width = Array.from(text).reduce((sum, char) => sum + (/\s/u.test(char) ? .28 : /\p{Script=Han}/u.test(char) ? 1 : .55) * size, 0);
  return { width };
});
beforeAll(() => vi.stubGlobal('OffscreenCanvas', class {
  getContext() { return { font: '12px Arial', measureText }; }
}));
afterAll(() => vi.unstubAllGlobals());

const base = { fontFamily: 'Arial', fontWeight: '400', maxFontSize: 12, locale: 'zh-CN' as const };

test.each(['zh-CN', 'en'] as const)('measured %s function labels fit narrow Fn faces without losing text', locale => {
  for (const code of [142, 143, 151, 152, 155, 167]) {
    const text = localizedKeyName(code, locale);
    for (const width of [26, 44, 70]) {
      const box = { ...base, locale, width, height: 17 };
      const fitted = fitKeycapText(text, box)!;
      expect(fitted.lines.join('').replace(/\s/g, '')).toBe(text.replace(/\s/g, ''));
      const prepared = prepareWithSegments(text, `${base.fontWeight} ${fitted.fontSize}px ${base.fontFamily}`);
      const stats = measureLineStats(prepared, width - 1);
      expect(stats.maxLineWidth).toBeLessThanOrEqual(width - 1);
      expect(stats.lineCount * fitted.lineHeight).toBeLessThanOrEqual(box.height);
      expect(fitted.fontSize).toBeLessThanOrEqual(box.maxFontSize);
    }
  }
});

test('single-line text wins even when a larger two-line layout would fit', () => {
  const text = 'Win / Mac 切换';
  const wrapped = measureLineStats(prepareWithSegments(text, '400 10px Arial'), 43);
  expect(wrapped.lineCount).toBe(2);
  expect(wrapped.lineCount * 11).toBeLessThanOrEqual(23);
  const fitted = fitKeycapText(text, { ...base, width: 44, height: 23 })!;
  expect(fitted.lines).toEqual([text]);
  expect(fitted.fontSize).toBeLessThan(10);
});

test('the reported Chinese function labels fit a preview on one line', () => {
  for (const code of [142, 143, 151, 152, 155, 167]) {
    const text = localizedKeyName(code, 'zh-CN');
    const fitted = fitKeycapText(text, { ...base, width: 44, height: 17 })!;
    expect(fitted.lines).toEqual([text]);
  }
});

test('function abbreviations stay on one line at a larger font size', () => {
  for (const code of [142, 143, 151, 152, 155, 167]) {
    const text = keycapName(code);
    const fitted = fitKeycapText(text, { ...base, width: 44, height: 17 })!;
    expect(fitted.lines).toEqual([text]);
    expect(fitted.fontSize).toBeGreaterThanOrEqual(8);
  }
});

test('narrowing shrinks text, widening restores its normal size, and unchanged text reuses measurements', () => {
  const text = 'Caps / Ctrl 切换';
  const narrow = fitKeycapText(text, { ...base, width: 26, height: 23 })!;
  const wide = fitKeycapText(text, { ...base, width: 140, height: 30 })!;
  expect(narrow.fontSize).toBeLessThan(wide.fontSize);
  expect(wide.fontSize).toBe(base.maxFontSize);
  const calls = measureText.mock.calls.length;
  expect(fitKeycapText(text, { ...base, width: 140, height: 30 })).toEqual(wide);
  expect(measureText.mock.calls).toHaveLength(calls);
});

test('hidden or unmeasurable keycaps defer fitting', () => {
  expect(fitKeycapText('Win / Mac 切换', { ...base, width: 0, height: 23 })).toBeNull();
  expect(fitKeycapText('Win / Mac 切换', { ...base, width: 44, height: 0 })).toBeNull();
});
