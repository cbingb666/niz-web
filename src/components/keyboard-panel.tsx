import { useI18n } from '@/i18n/use-i18n';
import { localizedSummary } from '@/i18n/profile';
import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { Download, FolderOpen, RotateCw, Upload } from 'lucide-react';
import { isLocked } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

function Keyboard() {
  const { t, locale } = useI18n();
  const model = useAppStore((state) => state.model);
  const profile = useAppStore((state) => state.profile);
  const layer = useAppStore((state) => state.layer);
  const selected = useAppStore((state) => state.key);
  const changes = useAppStore((state) => state.changes);
  const counts = useAppStore((state) =>
    state.showCounts && state.model.capabilities(state.profile?.version ?? '').counters,
  );
  const locked = useAppStore(isLocked);
  const actions = useAppStore((state) => state.actions);
  const keys = useRef<(HTMLButtonElement | null)[]>([]);
  let position = 0;
  const rows = model.rows.map((row) => {
    let left = 0;
    const total = row.reduce((sum, key) => sum + key.width, 0);
    return row.map(({ label, width }) => {
      const center = (left + width / 2) / total;
      left += width;
      return { label, weight: width, key: position++, center };
    });
  });
  function navigate(event: KeyboardEvent<HTMLButtonElement>, key: number) {
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
    if (actions.selectKey(next)) keys.current[next]?.focus();
  }
  return (
    <div className="keyboard-scroll">
      <div className="keyboard" aria-label={t('keyboard.physical', { model: model.name })}>
        {rows.map((row, rowIndex) => (
          <div className="key-row" key={rowIndex}>
            {row.map(({ key, weight, label }) => {
              const summary = profile ? localizedSummary(profile, layer * model.keyCount + key, locale) : '—';
              const changed = changes.includes(layer * model.keyCount + key);
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
                  title={`${label} · ${summary}`}
                  aria-label={t('keyboard.keyLabel', {
                    layer: model.layers[layer],
                    position: key + 1,
                    key: label,
                    assignment: summary,
                    changed: changed ? t('keyboard.changedSuffix') : '',
                  })}
                  onClick={() => actions.selectKey(key)}
                  onKeyDown={(event) => navigate(event, key)}
                >
                  <span className="legend">{label}</span>
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
  const model = useAppStore((state) => state.model);
  const source = useAppStore((state) => state.source);
  const stale = useAppStore((state) => state.stale);
  const layer = useAppStore((state) => state.layer);
  const key = useAppStore((state) => state.key);
  const counts = useAppStore((state) =>
    state.showCounts && state.model.capabilities(state.profile?.version ?? '').counters,
  );
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
          <h2>{model.name} · {t('keyboard.layout')}</h2>
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
            {model.layers.map((label, index) => (
              <TabsTrigger key={index} value={String(index)} disabled={locked}>
                {text(label)}
              </TabsTrigger>
            ))}
          </TabsList>
          <Label className="check-label">
            <Checkbox
              checked={counts}
              disabled={locked || !model.capabilities(profile?.version ?? '').counters}
              onCheckedChange={(value) => actions.setShowCounts(value === true)}
            />
            {t('keyboard.showCounts')}
          </Label>
        </div>
        {model.layers.map((_, index) => (
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
        <span>
          {profile && profile.groupCount > model.layers.length
            ? t('keyboard.extendedGroups', { groups: profile.groupCount, layers: model.layers.length })
            : t('keyboard.dimensions', { keys: model.keyCount, layers: model.layers.length })}
        </span>
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
