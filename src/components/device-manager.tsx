import { useEffect, useRef } from 'react';
import { ArrowRight, Cpu, FileCheck2, FileInput, Info, PencilLine, Plus, SlidersHorizontal, Unplug, ScanLine, TriangleAlert } from 'lucide-react';
import { supportedModels } from '@/devices';
import { deviceName } from '@/i18n/device';
import { useI18n } from '@/i18n/use-i18n';
import { isLocked } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';
import { DeviceIllustration } from './device-illustration';
import { ConnectionIllustration } from './connection-illustration';
import { DemoLauncher } from './demo-launcher';

export function DeviceManager() {
  const { t, text, count } = useI18n();
  const session = useAppStore(state => state.session);
  const devices = useAppStore(state => state.connectedDevices);
  const disconnectedEditors = useAppStore(state => state.disconnectedEditors);
  const profile = useAppStore(state => state.profile);
  const editorName = useAppStore(state => state.editorName);
  const source = useAppStore(state => state.source);
  const stale = useAppStore(state => state.stale);
  const locked = useAppStore(isLocked);
  const dialogOpen = useAppStore(state => state.dialog !== null);
  const actions = useAppStore(state => state.actions);
  const calibrationResults = useAppStore(state => state.calibrationResults);
  const firmwareResults = useAppStore(state => state.firmwareResults);
  const localProfile = profile && (!session.connected || !session.hasLiveBaseline || source === 'demo' || stale);
  const localName = source === 'demo' ? profile?.model.name || ''
    : text(editorName);
  const hasSavedEditors = localProfile || disconnectedEditors.length > 0;
  const focusedDevice = useRef<string | null>(null);
  useEffect(() => {
    if (!focusedDevice.current || devices.some(device => device.id === focusedDevice.current)) return;
    focusedDevice.current = null;
    if (!dialogOpen && document.activeElement === document.body)
      document.getElementById('page-title')?.focus({ preventScroll: true });
  }, [devices, dialogOpen]);

  return <div className="device-page" onFocusCapture={() => { focusedDevice.current = null; }}>
    {devices.length > 0 && <div className="device-page-heading">
      <div>
        <h2 id="page-title" tabIndex={-1}>{t('devices.title')}</h2>
        <p className="device-page-summary">{count(devices.length, 'devices.connectedCount.one', 'devices.connectedCount.other')}</p>
      </div>
      <Button variant="outline" disabled={locked} onClick={() => actions.navigate('connect')}><Plus />{t('devices.add')}</Button>
    </div>}

    <section className="device-list" aria-label={t(devices.length ? 'devices.connected' : 'devices.emptyTitle')}>
      {devices.length ? <div className="device-card-grid" data-multiple={devices.length > 1}>{devices.map(device => {
        const name = text(deviceName(device, devices));
        return <article key={device.id} className="device-card" aria-label={name}
          onFocusCapture={() => { focusedDevice.current = device.id; }}>
        <div className="device-card-art"><DeviceIllustration model={device.model} /></div>
        <div className="device-card-content">
          <div className="device-card-heading">
            <span className="device-status"><span className="status-dot connected" aria-hidden="true" />{t('connection.connectedShort')}</span>
            <div className="device-card-tools">
              <Button id={`device-details-${device.id}`} className="device-details-entry" variant="ghost" size="icon" disabled={locked}
                aria-label={t('connection.details')} aria-haspopup="dialog" title={t('connection.details')}
                onClick={() => actions.showDeviceDetails(device.id)}><Info /></Button>
              <Button id={`device-disconnect-${device.id}`} className="device-disconnect" variant="ghost" size="icon" disabled={locked}
                aria-label={t('connection.disconnect')} aria-haspopup="dialog" aria-describedby={`disconnect-hint-${device.id}`}
                title={t('connection.disconnect')} onClick={() => actions.disconnect(device.id)}><Unplug /></Button>
            </div>
            <span className="sr-only" id={`disconnect-hint-${device.id}`}>{t('devices.disconnectHint')}</span>
          </div>
          <h3>{name}</h3>
          <p className="device-specification">{t('keyboard.dimensions', { keys: device.model.keyCount, layers: device.model.layers.length })}</p>
          <div className="device-config-summary" id={`configuration-${device.id}`}>
            <p>{device.hasLiveBaseline ? <FileCheck2 aria-hidden="true" /> : <FileInput aria-hidden="true" />}
              {t(device.hasLiveBaseline ? 'connection.loaded' : 'connection.notRead')}</p>
            {device.hasEdits && <p className="device-pending-edits"><PencilLine aria-hidden="true" />{t('devices.pendingEdits')}</p>}
          </div>
          <div className="device-card-actions">
            <Button className="configure-device" disabled={locked} aria-describedby={`configuration-${device.id}`}
              onClick={() => actions.configureDevice(device.id)}>
              <SlidersHorizontal />{t('devices.configure')}<ArrowRight />
            </Button>
            {device.calibration === 'available' &&
              <Button id={`calibration-${device.id}`} variant="outline" className="device-calibration" disabled={locked}
                onClick={() => actions.openCalibration(device.id)}><ScanLine />{t('calibration.entry')}</Button>}
            {device.firmwareFlash && <Button id={`firmware-${device.id}`} variant="outline" disabled={locked}
              onClick={() => actions.openFirmware(device.id)}><Cpu />{t('firmware.entry')}</Button>}
          </div>
        </div>
      </article>;
      })}</div> : <div className="devices-empty">
        <div className="devices-empty-art"><ConnectionIllustration step="cable" connected={false} /></div>
        <div className="devices-empty-copy">
          <h2 id="page-title" tabIndex={-1}>{t('devices.emptyTitle')}</h2>
          <p>{t('devices.emptyDescription')}</p>
          <p className="devices-supported">{t('devices.supported', { models: supportedModels.map(model => model.name).join(' · ') })}</p>
          <Button disabled={locked} onClick={() => actions.navigate('connect')}>
            {t('devices.add')}<ArrowRight />
          </Button>
          <DemoLauncher />
        </div>
      </div>}
    </section>

    {Object.values(calibrationResults).filter(result => result.state.error).map(result =>
      <section key={result.target.id} className="resume-profile calibration-recovery">
        <TriangleAlert aria-hidden="true" />
        <div><h3>{t('calibration.recoveryTitle', { name: result.name })}</h3><p>{text(result.state.error!)}</p></div>
        <Button id={`calibration-result-${result.target.id}`} variant="outline" disabled={locked}
          onClick={() => actions.reviewCalibration(result.target.id)}>{t('calibration.reviewResult')}</Button>
      </section>)}
    {Object.values(firmwareResults).map(result => <section key={result.target.id} className="resume-profile">
      <Cpu aria-hidden="true" />
      <div><h3>{t('firmware.resultTitle', { name: result.name })}</h3><p>{t(`firmware.phase.${result.state.phase}`)}</p></div>
      <Button id={`firmware-result-${result.target.id}`} variant="outline" disabled={locked}
        onClick={() => actions.reviewFirmware(result.target.id)}>{t('firmware.review')}</Button>
    </section>)}

    {hasSavedEditors && <section className="saved-editors" aria-labelledby="saved-editors-title">
      <h3 id="saved-editors-title">{t('devices.savedEditors')}</h3>
      {localProfile && <section className="resume-profile" aria-label={t('devices.localProfile')}>
      <span className="resume-profile-icon">{!session.connected && source !== 'demo' ? <Unplug aria-hidden="true" /> : <SlidersHorizontal aria-hidden="true" />}</span>
      <div><h4>{localName}{source === 'demo' && <span className="saved-editor-kind">{t('keyboard.demo')}</span>}</h4>
        <p>{!session.connected && source === 'read' ? t('devices.disconnectedDraft') : t('devices.localDescription', { model: profile.model.name })}</p></div>
      <Button variant="outline" disabled={locked} onClick={() => actions.navigate('editor')}>{t('devices.resume')}<ArrowRight /></Button>
      </section>}
    {disconnectedEditors.map(saved => <section key={saved.id} className="resume-profile">
      <span className="resume-profile-icon"><Unplug aria-hidden="true" /></span>
      <div><h4>{text(saved.name)}</h4><p>{t('devices.disconnectedDraft')}</p></div>
      <Button variant="outline" disabled={locked} onClick={() => actions.resumeEditor(saved.id)}>{t('devices.resume')}<ArrowRight /></Button>
    </section>)}
    </section>}

  </div>;
}
