import { useRef } from 'react';
import { Download, Eye, FolderOpen, History, Upload } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';
import { isLocked } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';

export function ProfileActions() {
  const { t } = useI18n();
  const profile = useAppStore(state => state.profile);
  const draftCount = useAppStore(state => state.draftIndices.length);
  const backupCount = useAppStore(state => state.backupRows.length);
  const backupAvailable = useAppStore(state => state.backupAvailable);
  const locked = useAppStore(isLocked);
  const actions = useAppStore(state => state.actions);
  const input = useRef<HTMLInputElement>(null);
  return <div className="profile-actions">
    <Button variant="ghost" title={t('keyboard.import')} disabled={locked} onClick={() => input.current?.click()}><Upload /><span className="sr-only">{t('keyboard.import')}</span></Button>
    <Button variant="ghost" title={t('keyboard.export')} disabled={!profile || locked || draftCount > 0} onClick={actions.exportProfile}><Download /><span className="sr-only">{t('keyboard.export')}</span></Button>
    <Button variant="ghost" title={t('backup.title')} disabled={locked} onClick={actions.showBackups}>
      <FolderOpen /><span className="sr-only">{t('backup.title')} {backupAvailable ? backupCount : t('common.unavailable')}</span>
    </Button>
    <Button variant="ghost" title={t('keyboard.demo')} disabled={locked} onClick={actions.demo}><Eye /><span className="sr-only">{t('keyboard.demo')}</span></Button>
    <Button id="activity-trigger" variant="ghost" title={t('activity.title')} disabled={locked} aria-haspopup="dialog" onClick={actions.showActivity}><History /><span className="sr-only">{t('activity.title')}</span></Button>
    <input ref={input} type="file" aria-label={t('keyboard.importFile')} accept=".json,.pro,application/json" hidden
      onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void actions.importFile(file);
      }} />
  </div>;
}
