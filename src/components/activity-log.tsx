import { Download } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';
import { isLocked } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';

export function ActivityLog() {
  const { t, text, locale } = useI18n();
  const logs = useAppStore(state => state.logs);
  const hasCapture = useAppStore(state => state.session.hasCapture);
  const actions = useAppStore(state => state.actions);
  const locked = useAppStore(isLocked);
  return <>
    <ol className="activity">
      {logs.length ? logs.map(entry => <li key={entry.id} className={entry.error ? 'error' : undefined}>
        <time dateTime={entry.time}>{new Date(entry.time).toLocaleTimeString(locale, { hour12: false })}</time>
        <span>{text(entry.message)}</span>
      </li>) : <li className="empty-log">{t('activity.empty')}</li>}
    </ol>
    {hasCapture && <Button variant="outline" className="justify-self-end" disabled={locked} onClick={actions.exportDiagnostic}><Download />{t('activity.export')}</Button>}
  </>;
}
