import { ArrowRight, Keyboard, Plus, SlidersHorizontal, Unplug } from 'lucide-react';
import { deviceName } from '@/i18n/device';
import { useI18n } from '@/i18n/use-i18n';
import { supportedModels } from '@/devices';
import { isLocked } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';
import { DeviceIllustration } from './device-illustration';

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
    <div className="device-page-heading">
      <div>
        <p className="page-eyebrow"><Keyboard aria-hidden="true" />{t('app.subtitle')}</p>
        <h2 id="page-title" tabIndex={-1}>{t('devices.title')}</h2>
        <p className="page-description">{t('devices.description')}</p>
      </div>
      <Button disabled={locked} onClick={() => actions.navigate('connect')}><Plus />{t('devices.add')}</Button>
    </div>

    <section className="device-list" aria-label={t('devices.connected')}>
      <div className="device-list-heading">
        <h3>{t('devices.connected')}<span className="device-count">{devices.length}</span></h3>
      </div>
      {devices.length ? <div className="device-card-grid" data-multiple={devices.length > 1}>{devices.map(device => {
        const name = text(deviceName(device, devices));
        return <article key={device.id} className="device-card" aria-label={name}>
        <div className="device-card-art"><DeviceIllustration /></div>
        <div className="device-card-content">
          <span className="device-status"><span className="status-dot connected" />{t('connection.connectedShort')}</span>
          <h3>{name}</h3>
          <p className="device-specification">{t('keyboard.dimensions', { keys: device.model.keyCount, layers: device.model.layers.length })}</p>
          <dl className="device-card-details">
            <div><dt>{t('connection.product')}</dt><dd>{device.product}</dd></div>
            <div><dt>{t('connection.firmware')}</dt><dd>{device.version || '—'}</dd></div>
            <div><dt>{t('connection.configuration')}</dt><dd>{t(device.hasLiveBaseline ? 'connection.loaded' : 'connection.notRead')}</dd></div>
          </dl>
          {device.hasEdits && <p className="device-pending-edits">{t('devices.pendingEdits')}</p>}
          <div className="device-card-actions">
            <Button className="configure-device" disabled={locked} onClick={() => actions.configureDevice(device.id)}>
              <SlidersHorizontal />{t('devices.configure')}<ArrowRight />
            </Button>
            <Button variant="ghost" disabled={locked} onClick={() => actions.disconnect(device.id)}><Unplug />{t('connection.disconnect')}</Button>
          </div>
        </div>
      </article>;
      })}</div> : <div className="devices-empty">
        <div className="device-card-art"><DeviceIllustration /></div>
        <div className="devices-empty-copy">
          <span className="device-status offline"><span className="status-dot" />{t('connection.waiting')}</span>
          <h3>{t('devices.emptyTitle')}</h3>
          <p>{t('devices.emptyDescription')}</p>
          <Button variant="outline" disabled={locked} onClick={() => actions.navigate('connect')}>
            {t('devices.openGuide')}<ArrowRight />
          </Button>
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

    <footer className="device-page-footer">
      <span>{t('devices.supported', { models: supportedModels.map(model => model.name).join(' / ') })}</span>
    </footer>
  </div>;
}
