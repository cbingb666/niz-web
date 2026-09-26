import { useLayoutEffect, useRef } from 'react';
import { useAppStore } from '@/store/context';

/** A non-interactive keycap, sized from the physical layout. */
export function KeycapSample({ legends, position = 0, activeLayer, changed = false, measureKey, showNumber = false }: {
  legends: string[];
  position?: number;
  activeLayer?: number;
  changed?: boolean;
  measureKey?: number;
  showNumber?: boolean;
}) {
  const model = useAppStore(state => state.model);
  const sample = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const example = sample.current;
    const layout = example?.closest('.workspace')?.querySelector('.keyboard');
    const key = measureKey === undefined ? layout?.querySelector<HTMLElement>('.key[data-unit-key="true"]')
      : layout?.querySelectorAll<HTMLElement>('.key').item(measureKey);
    if (!example || !key) return;
    const matchSize = () => {
      const { width, height } = key.getBoundingClientRect();
      if (width > 0 && height > 0) {
        example.style.setProperty('--sample-width', `${width}px`);
        example.style.setProperty('--sample-height', `${height}px`);
      }
    };
    matchSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(matchSize);
    observer.observe(key);
    return () => observer.disconnect();
  }, [model, measureKey]);
  const layers = legends.map((legend, layer) => <span key={layer} className="key-layer" data-layer={layer}
    data-preview-active={layer === activeLayer} data-long-label={legend.length > 3}>
    <span className="assignment">{legend}</span>
  </span>);
  return <div ref={sample} className="keycap-sample" data-preview-selected={activeLayer !== undefined} aria-hidden="true">
    {showNumber && <div className="key-side key-number"><span>#{String(position + 1).padStart(2, '0')}</span></div>}
    {changed && <span className="key-change-dot" />}
    <div className="key-face">{layers[0]}{layers.slice(2)}</div>
    <div className="key-front">{layers[1]}</div>
  </div>;
}
