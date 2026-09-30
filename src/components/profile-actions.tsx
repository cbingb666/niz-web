import { useRef } from 'react';
import { DatabaseBackup, Download, ScrollText, Upload } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';
import { isLocked } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';

export function ProfileActions() {
  const { t } = useI18n();
  const profile = useAppStore(state => state.profile);
  const draftCount = useAppStore(state => state.draftIndices.length);
  const locked = useAppStore(isLocked);
  const actions = useAppStore(state => state.actions);
  const input = useRef<HTMLInputElement>(null);
  return <div className="profile-actions">
    <Button variant="outline" aria-label={t('keyboard.import')} title={t('keyboard.import')} disabled={locked} onClick={() => input.current?.click()}><Upload />{t('common.import')}</Button>
    <Button variant="outline" aria-label={t('keyboard.export')} title={t('keyboard.export')} disabled={!profile || locked || draftCount > 0} onClick={actions.exportProfile}><Download />{t('common.export')}</Button>
    <input ref={input} type="file" aria-label={t('keyboard.importFile')} accept=".json,.pro,application/json" hidden
      onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void actions.importFile(file);
      }} />
  </div>;
}

export function ProfileUtilities() {
  const { t } = useI18n();
  const backupCount = useAppStore(state => state.backupRows.length);
  const backupAvailable = useAppStore(state => state.backupAvailable);
  const locked = useAppStore(isLocked);
  const actions = useAppStore(state => state.actions);
  return <div className="profile-utilities">
    <Button size="icon" variant="ghost" title={t('backup.title')} disabled={locked} onClick={actions.showBackups}>
      <DatabaseBackup /><span className="sr-only">{t('backup.title')} {backupAvailable ? backupCount : t('common.unavailable')}</span>
    </Button>
    <Button id="activity-trigger" size="icon" variant="ghost" title={t('activity.title')} disabled={locked} aria-haspopup="dialog" onClick={actions.showActivity}><ScrollText /><span className="sr-only">{t('activity.title')}</span></Button>
  </div>;
}
