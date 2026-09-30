import { useI18n } from '@/i18n/use-i18n';
import { Cable } from 'lucide-react';
import { useAppStore } from '@/store/context';
import { isLocked } from '@/store/app-store';
import { Button } from './ui/button';

export function ConnectionPanel() {
  const { t, text } = useI18n();
  const session = useAppStore((state) => state.session);
  const profile = useAppStore((state) => state.profile);
  const locked = useAppStore(isLocked);
  const actions = useAppStore((state) => state.actions);
  if (session.connected || profile) return null;
  const titles = {
    waiting: t('connection.waiting'),
    connecting: t('connection.connecting'),
    authorizing: t('connection.authorizing'),
    error: t('connection.error'),
    unsupported: t('connection.unsupported'),
    connected: t('connection.connected', { product: session.product }),
  };
  return (
    <section className="connection-bar" aria-label={t('connection.section')}>
      <div className="connection-copy">
        <div className="connection-heading">
          <span className={`status-dot ${session.connected ? 'connected' : session.state}`} />
          <h2 id="connection-title">{titles[session.state]}</h2>
        </div>
        <p id="connection-detail">
          {text(session.message) || t('connection.initial')}
        </p>
      </div>
      <Button disabled={locked} onClick={() => actions.navigate('connect')}>
        <Cable />{t('guide.title')}
      </Button>
    </section>
  );
}
