import { useId } from 'react';
import { PanelLeftClose } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';
import { localizedDetail, localizedSummary } from '@/i18n/profile';
import { useAppStore } from '@/store/context';
import { isLocked, type ChangeReview as Review } from '@/store/app-store';
import { equalBytes, hex } from '@/protocol';
import { Button } from './ui/button';

export function ChangeReview({ review }: { review: Review }) {
  const { t, text, locale } = useI18n();
  const { before, after, indices, lights } = review;
  const { model } = after;
  const colors = lights && before.lights && after.lights ? model.keys.flatMap((_, i) => {
    const a = before.lights!.slice(i * 3, i * 3 + 3), b = after.lights!.slice(i * 3, i * 3 + 3);
    return equalBytes(a, b) ? [] : [{ index: i, before: '#' + hex(a), after: '#' + hex(b) }];
  }) : [];
  return <div className="change-review">
    <table><thead><tr><th>{t('mapping.position')}</th><th>{t('mapping.before')}</th><th>{t('mapping.after')}</th></tr></thead>
      <tbody>{indices.map(index => <tr key={index}><th scope="row">{index < model.editableRecords
        ? <>{text(model.layers[Math.floor(index / model.keyCount)])}<br />{t('keyboard.position', { position: index % model.keyCount + 1 })}</>
        : t('confirm.extendedKey', { group: Math.floor(index / model.keyCount) + 1, key: index % model.keyCount + 1 })}</th>
        <td>{localizedDetail(before, index, locale)}</td><td>{localizedDetail(after, index, locale)}</td></tr>)}
      {colors.map(color => <tr key={`rgb-${color.index}`}><th scope="row">RGB · {t('keyboard.position', { position: color.index + 1 })}</th><td><i className="color-swatch" style={{ backgroundColor: color.before }} />{color.before}</td><td><i className="color-swatch" style={{ backgroundColor: color.after }} />{color.after}</td></tr>)}</tbody>
    </table>
    {!indices.length && !lights && <p className="field-hint">{t('changes.none')}</p>}
    {lights && !colors.length && <p>{t('changes.rgb')}</p>}
  </div>;
}

export function PendingChanges({ collapsed, onToggle, onEdit, onReview }: { collapsed: boolean; onToggle(): void; onEdit?: () => void; onReview?: () => void }) {
  const { t, text, locale } = useI18n();
  const contentId = useId();
  const profile = useAppStore(state => state.profile);
  const baseline = useAppStore(state => state.baseline);
  const model = useAppStore(state => state.model);
  const changes = useAppStore(state => state.changes);
  const lights = useAppStore(state => state.lightsChanged);
  const drafts = useAppStore(state => state.draftIndices);
  const selectedKey = useAppStore(state => state.key);
  const selectedLayer = useAppStore(state => state.layer);
  const locked = useAppStore(isLocked);
  const actions = useAppStore(state => state.actions);
  const count = changes.length + (lights ? 1 : 0);
  const toggleLabel = t('mapping.collapseChanges');
  function review() { onReview?.(); actions.showChanges(); }
  function select(index: number) {
    if (actions.selectKey(index % model.keyCount, Math.floor(index / model.keyCount))) onEdit?.();
  }
  function position(index: number) {
    return index < model.editableRecords
      ? `${text(model.layers[Math.floor(index / model.keyCount)])} · ${t('keyboard.position', { position: index % model.keyCount + 1 })}`
      : t('confirm.extendedKey', { group: Math.floor(index / model.keyCount) + 1, key: index % model.keyCount + 1 });
  }
  return <aside id="pending-changes" className="pending-changes changes-pane" hidden={collapsed} aria-label={t('mapping.reviewTitle')}>
    <div className="pending-heading">
      <h2>{t('mapping.reviewTitle')}</h2>
      <Button variant="ghost" size="icon" aria-label={toggleLabel} title={toggleLabel}
        aria-expanded={!collapsed} aria-controls={contentId} onClick={onToggle}>
        <PanelLeftClose />
      </Button>
      <span className="pending-count" aria-label={t('mapping.changeItems', { count })} title={t('mapping.changeItems', { count })} aria-live="polite">{count}</span>
      {drafts.length > 0 && <span className="pending-draft-count" aria-label={t('mapping.drafts', { count: drafts.length })}
        title={t('mapping.drafts', { count: drafts.length })}>{t('mapping.drafts', { count: drafts.length })}</span>}
    </div>
    <div id={contentId} className="pending-body" hidden={collapsed}>
      <div className="pending-list" tabIndex={0}>
        {!profile || !baseline ? <p className="field-hint">{t('keyboard.notLoaded')}</p> : <>
          {!changes.length && !lights && !drafts.length && <p className="field-hint">{t('mapping.emptyChanges')}</p>}
          {changes.map(index => <button type="button" className="change-row" key={index}
            aria-current={index === selectedLayer * model.keyCount + selectedKey ? 'true' : undefined}
            disabled={locked || index >= model.editableRecords} onClick={() => select(index)}>
            <span>{position(index)}</span>{' '}
            <span><span className="muted">{localizedSummary(baseline, index, locale)}</span> → {localizedSummary(profile, index, locale)}</span>
          </button>)}
          {lights && <button type="button" className="change-row" disabled={locked} onClick={review}>{t('changes.rgb')}</button>}
          {drafts.length > 0 && <h3 className="pending-draft-heading">{t('mapping.drafts', { count: drafts.length })}</h3>}
          {drafts.map(index => <button type="button" className="change-row pending-draft" key={`draft-${index}`} disabled={locked}
            aria-current={index === selectedLayer * model.keyCount + selectedKey ? 'true' : undefined} onClick={() => select(index)}>
            <span>{position(index)}</span>{' '}<span>{t('mapping.drafts', { count: 1 })} →</span>
          </button>)}
        </>}
      </div>
      <div className="pending-footer"><Button variant="outline" size="sm" disabled={locked || !count} onClick={review}>{t('mapping.review')}</Button></div>
    </div>
  </aside>;
}
