import { useI18n } from '@/i18n/use-i18n';
import { layerMessage } from '@/i18n/core';
import { localizedSummary } from '@/i18n/profile';
import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { Download, FolderOpen, RotateCw, Upload } from 'lucide-react';
import { PHYSICAL_KEYS, ROW_WIDTHS } from '@/protocol';
import { isLocked } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

const rows = ROW_WIDTHS.map((weights, row) =>
  weights.map((weight: number, column: number) => ({
    weight,
    key: ROW_WIDTHS.slice(0, row).reduce((count, widths) => count + widths.length, 0) + column,
  })),
);

function Keyboard() {
  const { t, locale } = useI18n();
  const profile = useAppStore((state) => state.profile);
  const layer = useAppStore((state) => state.layer);
  const selected = useAppStore((state) => state.key);
  const changes = useAppStore((state) => state.changes);
  const counts = useAppStore((state) => state.showCounts);
  const locked = useAppStore(isLocked);
  const actions = useAppStore((state) => state.actions);
  const keys = useRef<(HTMLButtonElement | null)[]>([]);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, key: number) {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -14, ArrowDown: 14 };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(65, key + offsets[event.key]));
    if (actions.selectKey(next)) keys.current[next]?.focus();
  }
  return (
    <div className="keyboard-scroll">
      <div className="keyboard" aria-label={t('keyboard.physical')}>
        {rows.map((row, rowIndex) => (
          <div className="key-row" key={rowIndex}>
            {row.map(({ key, weight }) => {
              const summary = profile ? localizedSummary(profile, layer * 66 + key, locale) : '—';
              const changed = changes.includes(layer * 66 + key);
              return (
                <button
                  key={key}
                  ref={(element) => {
                    keys.current[key] = element;
                  }}
                  type="button"
                  className={`key ${changed ? 'changed' : ''}`}
                  style={{ '--weight': weight } as CSSProperties}
                  disabled={locked}
                  aria-pressed={key === selected}
                  tabIndex={key === selected ? 0 : -1}
                  title={`${PHYSICAL_KEYS[key]} · ${summary}`}
                  aria-label={t('keyboard.keyLabel', {
                    layer: layerMessage(layer),
                    position: key + 1,
                    key: PHYSICAL_KEYS[key],
                    assignment: summary,
                    changed: changed ? t('keyboard.changedSuffix') : '',
                  })}
                  onClick={() => actions.selectKey(key)}
                  onKeyDown={(event) => navigate(event, key)}
                >
                  <span className="legend">{PHYSICAL_KEYS[key]}</span>
                  <span className="assignment">
                    {counts ? (profile?.counters[key]?.toLocaleString(locale) ?? '—') : summary}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityLog() {
  const { t, text, locale } = useI18n();
  const logs = useAppStore((state) => state.logs);
  const hasCapture = useAppStore((state) => state.session.hasCapture);
  const actions = useAppStore((state) => state.actions);
  const locked = useAppStore(isLocked);
  return (
    <section className="activity-panel" aria-label={t('activity.title')}>
      <div className="section-heading">
        <h3>{t('activity.title')}</h3>
        {hasCapture && (
          <Button variant="link" size="sm" disabled={locked} onClick={actions.exportDiagnostic}>
            {t('activity.export')}
          </Button>
        )}
      </div>
      <ol className="activity">
        {logs.length ? (
          logs.map((entry) => (
            <li key={entry.id} className={entry.error ? 'error' : undefined}>
              <time dateTime={entry.time}>
                {new Date(entry.time).toLocaleTimeString(locale, { hour12: false })}
              </time>
              <span>{text(entry.message)}</span>
            </li>
          ))
        ) : (
          <li className="empty-log">{t('activity.empty')}</li>
        )}
      </ol>
    </section>
  );
}

export function KeyboardPanel() {
  const { t, text, count } = useI18n();
  const profile = useAppStore((state) => state.profile);
  const source = useAppStore((state) => state.source);
  const stale = useAppStore((state) => state.stale);
  const layer = useAppStore((state) => state.layer);
  const key = useAppStore((state) => state.key);
  const counts = useAppStore((state) => state.showCounts);
  const session = useAppStore((state) => state.session);
  const reading = useAppStore((state) => state.reading);
  const backupCount = useAppStore((state) => state.backupRows.length);
  const backupAvailable = useAppStore((state) => state.backupAvailable);
  const locked = useAppStore(isLocked);
  const actions = useAppStore((state) => state.actions);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="keyboard-panel">
      <div className="panel-toolbar">
        <div>
          <h2>{t('keyboard.layout')}</h2>
          <p>
            {profile
              ? `${t(source === 'demo' ? 'keyboard.demo' : source === 'read' ? 'keyboard.deviceProfile' : 'keyboard.imported')} · ${count(profile.records.length, 'keyboard.records.one', 'keyboard.records.other')}${stale ? ' · ' + t('keyboard.stale') : ''}`
              : t('keyboard.notLoaded')}
          </p>
        </div>
        <Button variant="outline" disabled={!session.connected || locked} onClick={actions.read}>
          <RotateCw />
          {reading ? t('keyboard.reading') : t('keyboard.read')}
        </Button>
      </div>
      <Tabs value={String(layer)} onValueChange={(value) => actions.selectKey(key, Number(value))}>
        <div className="layout-controls">
          <TabsList aria-label={t('keyboard.layers')}>
            {[0, 1, 2].map((index) => (
              <TabsTrigger key={index} value={String(index)} disabled={locked}>
                {text(layerMessage(index))}
              </TabsTrigger>
            ))}
          </TabsList>
          <Label className="check-label">
            <Checkbox checked={counts} onCheckedChange={(value) => actions.setShowCounts(value === true)} />
            {t('keyboard.showCounts')}
          </Label>
        </div>
        {[0, 1, 2].map((index) => (
          <TabsContent key={index} value={String(index)}>
            <Keyboard />
          </TabsContent>
        ))}
      </Tabs>
      <div className="keyboard-caption">
        <span>
          <i className="change-dot" />
          {t('keyboard.changedKeys')}
        </span>
        <span>{t(profile?.groupCount === 9 ? 'keyboard.nineGroups' : 'keyboard.threeLayers')}</span>
      </div>
      <div className="file-toolbar">
        <div className="file-actions">
          <Button variant="ghost" disabled={locked} onClick={() => input.current?.click()}>
            <Upload />
            {t('keyboard.import')}
          </Button>
          <Button variant="ghost" disabled={!profile || locked} onClick={actions.exportProfile}>
            <Download />
            {t('keyboard.export')}
          </Button>
          <Button variant="ghost" disabled={locked} onClick={actions.showBackups}>
            <FolderOpen />
            {t('backup.title')}{' '}
            <span className="text-muted-foreground">
              {backupAvailable ? backupCount : t('common.unavailable')}
            </span>
          </Button>
          <input
            ref={input}
            type="file"
            aria-label={t('keyboard.importFile')}
            accept=".json,.pro,application/json"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) void actions.importFile(file);
            }}
          />
        </div>
        <Button variant="link" disabled={locked} onClick={actions.demo}>
          {t('keyboard.demo')}
        </Button>
      </div>
      <ActivityLog />
    </div>
  );
}
