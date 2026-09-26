import { ChevronRight, Unplug } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';
import { isLocked } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';

export function ConnectedDevice() {
  const { t } = useI18n();
  const session = useAppStore(state => state.session);
  const locked = useAppStore(isLocked);
  const actions = useAppStore(state => state.actions);
  if (!session.connected) return null;
  const name = session.model?.name || session.product;
  return <div className="connected-device">
    <Button id="device-details-trigger" variant="ghost" size="sm" className="device-summary" disabled={locked}
      aria-label={t('connection.connected', { product: name })} aria-haspopup="dialog" title={t('connection.details')}
      onClick={actions.showDeviceDetails}>
      <span className="status-dot connected" aria-hidden="true" /><span className="device-name">{name}</span><ChevronRight />
    </Button>
    <Button variant="ghost" size="sm" disabled={locked} onClick={actions.disconnect}><Unplug />{t('connection.disconnect')}</Button>
  </div>;
}

export function DeviceDetails() {
  const { t, text } = useI18n();
  const session = useAppStore(state => state.session);
  const reading = useAppStore(state => state.reading);
  const details = [
    ['connection.deviceStatus', session.connected ? t('connection.connectedShort') : text(session.message) || t('connection.waiting')],
    ['connection.model', session.model?.name || '—'],
    ['connection.product', session.product || '—'],
    ['connection.firmware', session.version || '—'],
    ['connection.configuration', t(reading ? 'connection.reading' : session.hasLiveBaseline ? 'connection.loaded' : 'connection.notRead')],
  ] as const;
  return <dl className="device-details">{details.map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}</dl>;
}
