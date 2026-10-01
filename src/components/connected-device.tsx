import { ChevronRight, Unplug } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';
import { deviceName, formatUsbId } from '@/i18n/device';
import { isLocked } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';

export function ConnectedDevice() {
  const { t, text } = useI18n();
  const session = useAppStore(state => state.session);
  const devices = useAppStore(state => state.connectedDevices);
  const locked = useAppStore(isLocked);
  const actions = useAppStore(state => state.actions);
  if (!session.connected) return null;
  const current = devices.find(device => device.id === session.id);
  const name = current ? text(deviceName(current, devices)) : session.product || session.model?.name || '';
  return <div className="connected-device">
    <Button id="device-details-trigger" variant="ghost" size="sm" className="device-summary" disabled={locked}
      aria-label={t('connection.connected', { product: name })} aria-haspopup="dialog" title={`${t('connection.details')} · ${name}`}
      onClick={() => actions.showDeviceDetails()}>
      <span className="status-dot connected" aria-hidden="true" /><span className="device-name">{name}</span><ChevronRight />
    </Button>
    <Button id="device-disconnect-trigger" variant="ghost" size="icon" className="device-disconnect" title={t('connection.disconnect')}
      aria-haspopup="dialog" disabled={locked} onClick={() => actions.disconnect()}><Unplug /><span className="sr-only">{t('connection.disconnect')}</span></Button>
  </div>;
}

export function DeviceDetails({ deviceId }: { deviceId: string }) {
  const { t } = useI18n();
  const device = useAppStore(state => state.connectedDevices.find(device => device.id === deviceId));
  if (!device) return null;
  const details = [
    ['connection.deviceStatus', t('connection.connectedShort')],
    ['connection.model', device.model.name],
    ['connection.product', device.product || '—'],
    ['connection.vendorId', <code>{formatUsbId(device.vendorId)}</code>],
    ['connection.productId', <code>{formatUsbId(device.productId)}</code>],
    ['connection.firmware', device.version || '—'],
    ['connection.configuration', t(device.hasLiveBaseline ? 'connection.loaded' : 'connection.notRead')],
  ] as const;
  return <>
    <dl className="device-details">{details.map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}</dl>
    {device.calibration === 'unsupported' && <p className="device-details-hint">{t('calibration.unsupported')}</p>}
    <p className="device-details-hint">{t('devices.disconnectHint')}</p>
  </>;
}
