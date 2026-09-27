import { ArrowRight, Plus, SlidersHorizontal, Unplug } from 'lucide-react';
import { deviceName, formatUsbId } from '@/i18n/device';
import { useI18n } from '@/i18n/use-i18n';
import { isLocked } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';
import { DeviceIllustration } from './device-illustration';
import { ConnectionIllustration } from './connection-illustration';

export function DeviceManager() {
  const { t, text } = useI18n();
  const session = useAppStore(state => state.session);
  const devices = useAppStore(state => state.connectedDevices);
  const disconnectedEditors = useAppStore(state => state.disconnectedEditors);
  const profile = useAppStore(state => state.profile);
  const source = useAppStore(state => state.source);
  const stale = useAppStore(state => state.stale);
  const locked = useAppStore(isLocked);
  const actions = useAppStore(state => state.actions);
  const localProfile = profile && (!session.connected || source !== 'read' || stale);

  return <div className="device-page">
    {devices.length > 0 && <div className="device-page-heading">
      <div>
        <h2 id="page-title" tabIndex={-1}>{t('devices.title')}</h2>
      </div>
      <Button disabled={locked} onClick={() => actions.navigate('connect')}><Plus />{t('devices.add')}</Button>
    </div>}

    <section className="device-list" aria-label={t(devices.length ? 'devices.connected' : 'devices.emptyTitle')}>
      {devices.length > 0 && <div className="device-list-heading">
        <h3>{t('devices.connected')}<span className="device-count">{devices.length}</span></h3>
      </div>}
      {devices.length ? <div className="device-card-grid" data-multiple={devices.length > 1}>{devices.map(device => {
        const name = text(deviceName(device, devices));
        return <article key={device.id} className="device-card" aria-label={name}>
        <div className="device-card-art"><DeviceIllustration /></div>
        <div className="device-card-content">
          <span className="device-status"><span className="status-dot connected" />{t('connection.connectedShort')}</span>
          <h3>{name}</h3>
          <p className="device-specification">{t('keyboard.dimensions', { keys: device.model.keyCount, layers: device.model.layers.length })}</p>
          <dl className="device-card-details">
            <div><dt>{t('connection.vendorId')}</dt><dd><code>{formatUsbId(device.vendorId)}</code></dd></div>
            <div><dt>{t('connection.productId')}</dt><dd><code>{formatUsbId(device.productId)}</code></dd></div>
            <div><dt>{t('connection.firmware')}</dt><dd>{device.version || '—'}</dd></div>
            <div><dt>{t('connection.configuration')}</dt><dd>{t(device.hasLiveBaseline ? 'connection.loaded' : 'connection.notRead')}</dd></div>
          </dl>
          {device.hasEdits && <p className="device-pending-edits">{t('devices.pendingEdits')}</p>}
          <div className="device-card-actions">
            <Button className="configure-device" disabled={locked} onClick={() => actions.configureDevice(device.id)}>
              <SlidersHorizontal />{t('devices.configure')}<ArrowRight />
            </Button>
            <Button className="device-disconnect" variant="ghost" disabled={locked} onClick={() => actions.disconnect(device.id)}><Unplug />{t('connection.disconnect')}</Button>
          </div>
        </div>
      </article>;
      })}</div> : <div className="devices-empty">
        <div className="devices-empty-art"><ConnectionIllustration step="cable" connected={false} /></div>
        <div className="devices-empty-copy">
          <h2 id="page-title" tabIndex={-1}>{t('devices.emptyTitle')}</h2>
          <p>{t('devices.emptyDescription')}</p>
          <Button aria-describedby="connection-next-step" disabled={locked} onClick={() => actions.navigate('connect')}>
            {t('devices.add')}<ArrowRight />
          </Button>
          <p id="connection-next-step" className="devices-empty-next">{t('devices.emptyNext')}</p>
        </div>
      </div>}
    </section>

    {localProfile && <section className="resume-profile" aria-label={t('devices.localProfile')}>
      <span className="resume-profile-icon"><SlidersHorizontal aria-hidden="true" /></span>
      <div><h3>{t('devices.localProfile')}</h3><p>{t('devices.localDescription', { model: profile.model.name })}</p></div>
      <Button variant="outline" disabled={locked} onClick={() => actions.navigate('editor')}>{t('devices.resume')}<ArrowRight /></Button>
    </section>}
    {disconnectedEditors.map(saved => <section key={saved.id} className="resume-profile">
      <span className="resume-profile-icon"><Unplug aria-hidden="true" /></span>
      <div><h3>{t('devices.numberedName', { name: saved.model, number: saved.number })}</h3><p>{t('devices.disconnectedDraft')}</p></div>
      <Button variant="outline" disabled={locked} onClick={() => actions.resumeEditor(saved.id)}>{t('devices.resume')}<ArrowRight /></Button>
    </section>)}

  </div>;
}
