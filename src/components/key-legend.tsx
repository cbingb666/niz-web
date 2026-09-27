import { useLayoutEffect, useRef, useState } from 'react';
import { fitKeycapText } from '@/lib/keycap-text';

/** Both physical keys and previews use the same measured text layout. */
export function KeyLegend({ text }: { text: string }) {
  const container = useRef<HTMLSpanElement>(null);
  const [fitted, setFitted] = useState<{
    source: string; fontSize: number; lineHeight: number; content: string;
  } | null>(null);
  useLayoutEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width <= 1 || height <= 1) return;
      const style = getComputedStyle(element);
      const result = fitKeycapText(text, {
        width, height, locale: 'en', fontFamily: style.fontFamily,
        fontWeight: style.fontWeight, maxFontSize: parseFloat(style.fontSize),
      });
      if (!result) return;
      const content = result.lines.join('\n');
      setFitted(previous => previous?.source === text &&
        previous.fontSize === result.fontSize && previous.content === content ? previous
        : { source: text, fontSize: result.fontSize, lineHeight: result.lineHeight, content });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);
  const current = fitted?.source === text ? fitted : null;
  return <span ref={container} className="key-legend" lang="en">
    <span className="assignment" style={current ? { fontSize: current.fontSize, lineHeight: `${current.lineHeight}px`, whiteSpace: 'pre' } : undefined}>
      {current?.content ?? text}
    </span>
  </span>;
}
