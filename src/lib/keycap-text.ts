import { layoutWithLines, measureLineStats, prepareWithSegments, setLocale, type PreparedTextWithSegments } from '@chenglou/pretext';
import type { Locale } from '@/i18n/core';

interface TextBox {
  width: number;
  height: number;
  fontFamily: string;
  fontWeight: string;
  maxFontSize: number;
  locale: Locale;
}
const preparedTexts = new Map<string, PreparedTextWithSegments>();
let measurementLocale: Locale | undefined;

/** Measure candidate sizes without changing the DOM or remeasuring cached text. */
export function fitKeycapText(text: string, box: TextBox) {
  if (box.width <= 1 || box.height <= 1 || !Number.isFinite(box.maxFontSize)) return null;
  if (measurementLocale !== box.locale) {
    measurementLocale = box.locale;
    setLocale(box.locale);
    preparedTexts.clear();
  }
  const width = box.width - 1;
  const height = box.height;
  const lineHeight = (size: number) => size * 1.1;
  function prepare(size: number) {
    const font = `${box.fontWeight} ${size}px ${box.fontFamily}`;
    const key = JSON.stringify([text, font]);
    let prepared = preparedTexts.get(key);
    if (!prepared) {
      prepared = prepareWithSegments(text, font);
      if (preparedTexts.size >= 1024) preparedTexts.delete(preparedTexts.keys().next().value!);
      preparedTexts.set(key, prepared);
    }
    return prepared;
  }
  function largestSize(maxLines: number) {
    // Whole pixel sizes avoid fractional canvas/DOM rounding differences.
    let low = 5;
    let high = Math.max(low, Math.floor(box.maxFontSize));
    let best: number | null = null;
    while (low <= high) {
      const candidate = Math.floor((low + high) / 2);
      const measured = measureLineStats(prepare(candidate), width);
      if (measured.lineCount <= maxLines && measured.maxLineWidth <= width && measured.lineCount * lineHeight(candidate) <= height) {
        best = candidate;
        low = candidate + 1;
      } else high = candidate - 1;
    }
    return best;
  }
  // Keep the label on one line before considering a larger, wrapped layout.
  const fontSize = largestSize(1) ?? largestSize(Infinity) ?? 5;
  const result = layoutWithLines(prepare(fontSize), width, lineHeight(fontSize));
  return { fontSize, lineHeight: lineHeight(fontSize), lines: result.lines.map(line => line.text) };
}
