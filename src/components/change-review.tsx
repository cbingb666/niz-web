import { msg, renderMessage } from '@/i18n/core';
import { useI18n } from '@/i18n/use-i18n';
import { localizedDetail, localizedSummary } from '@/i18n/profile';
import { useAppStore } from '@/store/context';
import { isLocked, type ChangeReview as Review } from '@/store/app-store';
import { equalBytes, hex, type Profile } from '@/protocol';
import { Button } from './ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { ArrowRight, FilePenLine, Pencil } from 'lucide-react';

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

function mappingPreview(profile: Profile, index: number, locale: Parameters<typeof localizedDetail>[2]): string {
  const definition = profile.definition(index);
  if (definition.type < 2) return localizedDetail(profile, index, locale);
  const mode = definition.type === 2 ? 'editor.mode.macroCycles' : definition.type === 3 ? 'editor.mode.macroHold' : 'editor.mode.macroToggle';
  return [localizedSummary(profile, index, locale), definition.type === 2 ? '' : renderMessage(msg(mode), locale),
    definition.customDelay ? renderMessage(msg('mapping.perStepTiming'), locale) : renderMessage(msg('mapping.intervalDetail', { ms: definition.interval }), locale),
    definition.type === 2 ? renderMessage(msg('mapping.cyclesDetail', { count: definition.cycles }), locale) : '',
  ].filter(Boolean).join('\n');
}

function MappingComparison({ before, after, beforeDetail, afterDetail }: {
  before: string; after: string; beforeDetail?: string; afterDetail?: string;
}) {
  const { t } = useI18n();
  return <>
    <div className="pending-comparison">
      <dl><dt>{t('mapping.before')}</dt><dd>{before}</dd></dl>
      <ArrowRight aria-hidden="true" />
      <dl><dt>{t('mapping.changedTo')}</dt><dd>{after}</dd></dl>
    </div>
    {(beforeDetail || afterDetail) && <details className="pending-details">
      <summary>{t('mapping.actionDetails')}</summary>
      <div className="pending-comparison">
        <dl><dt>{t('mapping.before')}</dt><dd>{beforeDetail ?? before}</dd></dl>
        <ArrowRight aria-hidden="true" />
        <dl><dt>{t('mapping.changedTo')}</dt><dd>{afterDetail ?? after}</dd></dl>
      </div>
    </details>}
  </>;
}

export function PendingChanges({ onEdit, onWrite, onClose }: { onEdit(): void; onWrite(): void; onClose(): void }) {
  const { t, text, locale, count } = useI18n();
  const profile = useAppStore(state => state.profile);
  const baseline = useAppStore(state => state.baseline);
  const model = useAppStore(state => state.model);
  const changes = useAppStore(state => state.changes);
  const lights = useAppStore(state => state.lightsChanged);
  const drafts = useAppStore(state => state.draftIndices);
  const canWrite = useAppStore(state => state.canWrite);
  const locked = useAppStore(isLocked);
  const actions = useAppStore(state => state.actions);
  const groups = Array.from(new Set(changes.map(index => Math.floor(index / model.keyCount))));
  const colors = lights && baseline?.lights && profile?.lights ? model.keys.flatMap((_, index) => {
    const before = baseline.lights!.slice(index * 3, index * 3 + 3);
    const after = profile.lights!.slice(index * 3, index * 3 + 3);
    return equalBytes(before, after) ? [] : [{ index, before: '#' + hex(before), after: '#' + hex(after) }];
  }) : [];
  function select(index: number) {
    if (actions.selectKey(index % model.keyCount, Math.floor(index / model.keyCount))) onEdit();
  }
  function keyHeading(index: number, draft = false) {
    const position = index % model.keyCount;
    const editable = index < model.editableRecords;
    const label = editable
      ? `${text(model.layers[Math.floor(index / model.keyCount)])} · ${t('keyboard.position', { position: position + 1 })}`
      : t('confirm.extendedKey', { group: Math.floor(index / model.keyCount) + 1, key: position + 1 });
    return <div className="pending-key-heading">
      <div className="pending-key-location"><kbd>{model.keys[position].label}</kbd><span>{t('keyboard.position', { position: position + 1 })}</span></div>
      {editable && <Button variant="ghost" className="pending-edit" disabled={locked}
        aria-label={t(draft ? 'mapping.continueAt' : 'mapping.editAt', { position: label })} onClick={() => select(index)}>
        {draft ? <FilePenLine aria-hidden="true" /> : <Pencil aria-hidden="true" />}{t(draft ? 'mapping.resumeDraft' : 'mapping.editChange')}
      </Button>}
    </div>;
  }
  return <div className="pending-changes">
    <DialogHeader className="pending-heading">
      <DialogTitle tabIndex={-1}>{t('mapping.reviewTitle')}</DialogTitle>
      <DialogDescription>{t('mapping.pendingHint')}</DialogDescription>
      {(changes.length > 0 || lights) && <p className="pending-summary" aria-live="polite">
        {changes.length > 0 && <>
          {count(new Set(changes.map(index => index % model.keyCount)).size, 'mapping.positionCount.one', 'mapping.positionCount.other')}
          {' · '}{count(changes.length, 'mapping.mappingCount.one', 'mapping.mappingCount.other')}
        </>}
        {lights ? `${changes.length ? ' · ' : ''}${t('changes.rgb')}` : ''}
      </p>}
    </DialogHeader>
    <div className="pending-list" tabIndex={0}>
      {drafts.length > 0 && <section className="pending-drafts" aria-labelledby="pending-drafts-title">
        <h3 id="pending-drafts-title"><FilePenLine aria-hidden="true" />{t('mapping.drafts', { count: drafts.length })}</h3>
        <p>{t('mapping.finishDrafts')}</p>
        <ul>{drafts.map(index => <li className="pending-card" key={index}>
          {keyHeading(index, true)}
          <p className="pending-draft-layer">{text(model.layers[Math.floor(index / model.keyCount)])}</p>
        </li>)}</ul>
      </section>}
      {!profile || !baseline ? <p className="pending-empty">{t('keyboard.notLoaded')}</p> : <>
        {!changes.length && !lights && !drafts.length && <p className="pending-empty">{t('mapping.emptyChanges')}</p>}
        {groups.map(layer => <section className="pending-group" key={layer} aria-labelledby={`pending-layer-${layer}`}>
          <h3 id={`pending-layer-${layer}`}>{layer < model.layers.length ? text(model.layers[layer]) : t('mapping.extendedGroup', { group: layer + 1 })}{' '}
            <span>{count(changes.filter(index => Math.floor(index / model.keyCount) === layer).length, 'mapping.mappingCount.one', 'mapping.mappingCount.other')}</span>
          </h3>
          <ul>{changes.filter(index => Math.floor(index / model.keyCount) === layer).map(index => {
            const before = mappingPreview(baseline, index, locale), after = mappingPreview(profile, index, locale);
            return <li className="pending-card" key={index}>
              {keyHeading(index)}
              <MappingComparison before={before} after={after}
                beforeDetail={baseline.definition(index).type >= 2 ? localizedDetail(baseline, index, locale) : undefined}
                afterDetail={profile.definition(index).type >= 2 ? localizedDetail(profile, index, locale) : undefined} />
            </li>;
          })}</ul>
        </section>)}
        {lights && <section className="pending-group" aria-labelledby="pending-lights-title">
          <h3 id="pending-lights-title">{t('changes.rgb')}</h3>
          {colors.length ? <ul>{colors.map(color => <li className="pending-card" key={color.index}>
            <div className="pending-key-location"><kbd>{model.keys[color.index].label}</kbd><span>{t('keyboard.position', { position: color.index + 1 })}</span></div>
            <div className="pending-comparison">
              <dl><dt>{t('mapping.before')}</dt><dd><i className="color-swatch" style={{ backgroundColor: color.before }} />{color.before}</dd></dl>
              <ArrowRight aria-hidden="true" />
              <dl><dt>{t('mapping.changedTo')}</dt><dd><i className="color-swatch" style={{ backgroundColor: color.after }} />{color.after}</dd></dl>
            </div>
          </li>)}</ul> : <p>{t('changes.rgb')}</p>}
        </section>}
      </>}
    </div>
    <div className="pending-footer">
      <Button variant={canWrite ? 'outline' : 'default'} onClick={onClose}>{t('mapping.backToEditing')}</Button>
      {canWrite && <Button disabled={locked} onClick={onWrite}>{t('changes.write')}<ArrowRight aria-hidden="true" /></Button>}
    </div>
  </div>;
}
