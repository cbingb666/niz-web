import { useI18n } from '@/i18n/use-i18n';
import { Cable, Unplug } from 'lucide-react';
import { useAppStore } from '@/store/context';
import { isLocked } from '@/store/app-store';
import { Button } from './ui/button';

export function ConnectionPanel({ usbAvailable }: { usbAvailable: boolean }) {
  const { t, text } = useI18n();
  const session = useAppStore((state) => state.session);
  const reading = useAppStore((state) => state.reading);
  const locked = useAppStore(isLocked);
  const actions = useAppStore((state) => state.actions);
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
          {session.connected
            ? `${session.version} · ${reading ? t('connection.reading') : session.hasLiveBaseline ? t('connection.loaded') : t('connection.notRead')}`
            : text(session.message) || t('connection.initial')}
        </p>
      </div>
      {session.connected ? (
        <Button variant="outline" disabled={locked} onClick={actions.disconnect}>
          <Unplug />
          {t('connection.disconnect')}
        </Button>
      ) : (
        <Button disabled={!usbAvailable || locked} onClick={actions.connect}>
          <Cable />
          {t('connection.connect')}
        </Button>
      )}
    </section>
  );
}
