import { useI18n } from '@/i18n/use-i18n';
import { localizedSummary, keycapSummary } from '@/i18n/profile';
import { renderMessage } from '@/i18n/core';
import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { PanelLeftOpen, RotateCw } from 'lucide-react';
import { isLocked } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { KeycapSample } from './keycap-sample';
import { KeyLegend } from './key-legend';

function Keyboard({ onEdit }: { onEdit?: () => void }) {
  const { t, text, locale } = useI18n();
  const model = useAppStore((state) => state.model);
  const profile = useAppStore((state) => state.profile);
  const layer = useAppStore((state) => state.layer);
  const selected = useAppStore((state) => state.key);
  const changes = useAppStore((state) => state.changes);
  const drafts = useAppStore((state) => state.draftIndices);
  const showNumbers = useAppStore((state) => state.showKeyNumbers);
  const counts = useAppStore((state) =>
    state.showCounts && state.model.capabilities(state.profile?.version ?? '').counters,
  );
  const locked = useAppStore(isLocked);
  const actions = useAppStore((state) => state.actions);
  const keys = useRef<(HTMLButtonElement | null)[]>([]);
  const visibleLayers = model.layers.map((_, index) => index).filter(index => !counts || index !== 1);
  const maxCount = Math.max(0, ...(profile?.counters ?? []));
  let position = 0;
  const rows = model.rows.map((row) => {
    let left = 0;
    const total = row.reduce((sum, key) => sum + key.width, 0);
    return row.map(({ width }) => {
      const center = (left + width / 2) / total;
      left += width;
      return { weight: width, key: position++, center };
    });
  });
  function navigate(event: KeyboardEvent<HTMLButtonElement>, key: number, keyLayer: number) {
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      const next = Math.max(0, Math.min(visibleLayers.length - 1, visibleLayers.indexOf(keyLayer) + (event.key === 'ArrowUp' ? -1 : 1)));
      const nextLayer = visibleLayers[next];
      if (actions.selectKey(key, nextLayer)) keys.current[nextLayer * model.keyCount + key]?.focus();
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    let next = key;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      next = Math.max(0, Math.min(model.keyCount - 1, key + (event.key === 'ArrowLeft' ? -1 : 1)));
    } else {
      const row = rows.findIndex((row) => row.some((item) => item.key === key));
      const center = rows[row].find((item) => item.key === key)!.center;
      const adjacent = rows[row + (event.key === 'ArrowUp' ? -1 : 1)];
      if (adjacent)
        next = adjacent.reduce((nearest, item) =>
          Math.abs(item.center - center) < Math.abs(nearest.center - center) ? item : nearest,
        ).key;
    }
    if (actions.selectKey(next, keyLayer)) keys.current[keyLayer * model.keyCount + next]?.focus();
  }
  return (
    <div className="keyboard-scroll">
      <div className="keyboard" data-layer-count={model.layers.length} data-counts={counts} aria-label={t('keyboard.physical', { model: model.name })}>
        {rows.map((row, rowIndex) => (
          <div className="key-row" key={rowIndex} style={{
            '--row-units': row.reduce((sum, item) => sum + item.weight, 0),
            '--row-gaps': row.length - 1,
          } as CSSProperties}>
            {row.map(({ key, weight }) => {
              const keyCount = profile?.counters[key];
              const heat = maxCount > 0 && keyCount !== undefined ? Math.sqrt(keyCount / maxCount) : 0;
              const fullCount = keyCount?.toLocaleString('en') ?? '—';
              const countLabel = keyCount === undefined ? '—' : keyCount < 1_000_000 ? fullCount
                : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(keyCount);
              const layerButtons = model.layers.map((label, keyLayer) => {
                if (counts && keyLayer === 1) return null;
                const index = keyLayer * model.keyCount + key;
                const summary = profile ? localizedSummary(profile, index, locale) : '—';
                const legend = profile ? keycapSummary(profile, index) : '—';
                const changed = changes.includes(index);
                const pending = drafts.includes(index);
                return <button
                  key={keyLayer}
                  ref={element => { keys.current[index] = element; }}
                  type="button"
                  className={`key-layer ${changed ? 'changed' : ''} ${pending ? 'has-draft' : ''}`}
                  data-layer={keyLayer}
                  data-empty={!profile || profile.definition(index).keys.length === 0}
                  data-long-label={legend.length > 3}
                  disabled={locked}
                  aria-pressed={key === selected && keyLayer === layer}
                  tabIndex={key === selected ? 0 : -1}
                  title={[...(showNumbers ? [t('keyboard.position', { position: key + 1 })] : []), text(label), summary].join(' · ')}
                  aria-label={t('keyboard.keyLabel', {
                    layer: label,
                    position: key + 1,
                    assignment: summary,
                    changed: (changed ? t('keyboard.changedSuffix') : '') + (pending ? t('mapping.pendingSuffix') : ''),
                  })}
                  onClick={() => { if (actions.selectKey(key, keyLayer)) onEdit?.(); }}
                  onKeyDown={event => navigate(event, key, keyLayer)}
                >
                  <KeyLegend text={legend} changed={changed} changeLabel={t('keyboard.changedKeys')} />
                  {pending && <span className="key-layer-state" aria-hidden="true">…</span>}
                </button>;
              });
              return <div
                key={key}
                className="key"
                role="group"
                aria-label={t('keyboard.position', { position: key + 1 })}
                data-selected={key === selected}
                data-unit-key={weight === 1}
                style={{ '--weight': weight, ...(counts ? {
                  '--count-face': `rgb(${44 + heat * 68} ${44 + heat * 68} ${44 + heat * 68})`,
                  '--count-body': `rgb(${34 + heat * 53} ${34 + heat * 53} ${34 + heat * 53})`,
                } : {}) } as CSSProperties}
              >
                {showNumbers && <div className="key-side key-number">
                  <span>#{String(key + 1).padStart(2, '0')}</span>
                </div>}
                <div className="key-face">
                  {layerButtons[0]}
                  {layerButtons.slice(2)}
                </div>
                <div className="key-front">
                  {counts ? <span className="key-counter" title={t('keyboard.count', { count: fullCount })}
                    aria-label={t('keyboard.count', { count: fullCount })}>{countLabel}</span> : layerButtons[1]}
                </div>
              </div>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function KeycapGuide({ counts, showNumbers }: { counts: boolean; showNumbers: boolean }) {
  const { t } = useI18n();
  const model = useAppStore(state => state.model);
  const legends = model.layers.map((label, index) => counts && index === 1 ? 'Count'
    : renderMessage(label, 'en').replace(/^Left /, 'L ').replace(/^Right /, 'R '));
  return <figure className="keycap-guide" aria-label={t('mapping.keycapGuide')}>
    <KeycapSample legends={legends} showNumber={showNumbers} />
  </figure>;
}

export function KeyboardPanel({ onEdit, onShowChanges, changesExpanded = false }: { onEdit?: () => void; onShowChanges?: () => void; changesExpanded?: boolean }) {
  const { t } = useI18n();
  const profile = useAppStore((state) => state.profile);
  const model = useAppStore((state) => state.model);
  const source = useAppStore((state) => state.source);
  const stale = useAppStore((state) => state.stale);
  const showNumbers = useAppStore((state) => state.showKeyNumbers);
  const counts = useAppStore((state) =>
    state.showCounts && state.model.capabilities(state.profile?.version ?? '').counters,
  );
  const session = useAppStore((state) => state.session);
  const reading = useAppStore((state) => state.reading);
  const locked = useAppStore(isLocked);
  const actions = useAppStore((state) => state.actions);
  const pendingCount = useAppStore(state => state.changes.length + (state.lightsChanged ? 1 : 0));
  const draftCount = useAppStore(state => state.draftIndices.length);
  return (
    <div className="keyboard-panel" role="region" aria-label={t('keyboard.layout')} tabIndex={0}>
      <div className="panel-toolbar">
        <div className="keyboard-panel-heading">
          <div>
            <h2>{t('keyboard.chooseKey')}</h2>
            <p>
              {profile
                ? `${t(source === 'demo' ? 'keyboard.demo' : source === 'read' ? 'keyboard.deviceProfile' : 'keyboard.imported')}${stale ? ' · ' + t('keyboard.stale') : ''}`
                : t('keyboard.notLoaded')}
            </p>
          </div>
        </div>
        <div className="workspace-actions">
          {onShowChanges && <Button id="changes-trigger" variant="outline" aria-label={t('mapping.expandChanges')}
            title={[t('mapping.changeItems', { count: pendingCount }), ...(draftCount ? [t('mapping.drafts', { count: draftCount })] : [])].join(' · ')}
            aria-controls="pending-changes" aria-expanded={changesExpanded} onClick={onShowChanges}>
            <PanelLeftOpen />{t('mapping.reviewTitle')}
            <span className="pending-count" aria-label={t('mapping.changeItems', { count: pendingCount })} aria-live="polite">{pendingCount}</span>
            {draftCount > 0 && <span className="pending-draft-label">{t('mapping.unappliedCount', { count: draftCount })}</span>}
          </Button>}
          <Button variant="outline" disabled={!session.connected || locked} onClick={actions.read}>
          <RotateCw />
          {reading ? t('keyboard.reading') : t('keyboard.read')}
          </Button>
        </div>
      </div>
      <div className="layout-controls">
        <KeycapGuide counts={counts} showNumbers={showNumbers} />
        <div className="count-controls">
          <Label className="check-label">
            <Checkbox checked={showNumbers} disabled={locked}
              onCheckedChange={value => actions.setShowKeyNumbers(value === true)} />
            {t('keyboard.showNumbers')}
          </Label>
          <Label className="check-label">
            <Checkbox checked={counts} disabled={locked || !model.capabilities(profile?.version ?? '').counters}
              onCheckedChange={value => actions.setShowCounts(value === true)} />
            {t('keyboard.showCounts')}
          </Label>
        </div>
      </div>
      <Keyboard onEdit={onEdit} />
      <div className="keyboard-caption">
        {counts && <span className="count-scale"><span>{t('keyboard.fewerCounts')}</span><i aria-hidden="true" /><span>{t('keyboard.moreCounts')}</span></span>}
        <span>
          {profile && profile.groupCount > model.layers.length
            ? t('keyboard.extendedGroups', { groups: profile.groupCount, layers: model.layers.length })
            : t('keyboard.dimensions', { keys: model.keyCount, layers: model.layers.length })}
        </span>
      </div>
    </div>
  );
}
