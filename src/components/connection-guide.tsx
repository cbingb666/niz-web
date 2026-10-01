import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Cable, Check, CheckCircle2, CircleAlert, Keyboard, Play } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';
import { deviceName } from '@/i18n/device';
import { supportedModels } from '@/devices';
import { isLocked } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { ConnectionIllustration } from './connection-illustration';

const steps = [
  { id: 'support', label: 'guide.supportStep', title: 'guide.supportTitle', description: 'guide.supportDescription' },
  { id: 'cable', label: 'guide.usbStep', title: 'guide.usbTitle', description: 'guide.usbDescription' },
  { id: 'permission', label: 'guide.permissionStep', title: 'guide.permissionTitle', description: 'guide.permissionDescription' },
  { id: 'complete', label: 'guide.completeStep', title: 'guide.completeTitle', description: 'guide.completeDescription' },
] as const;

export function ConnectionGuide({ usbAvailable }: { usbAvailable: boolean }) {
  const { t, text } = useI18n();
  const session = useAppStore(state => state.session);
  const devices = useAppStore(state => state.connectedDevices);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [selectionFailed, setSelectionFailed] = useState(false);
  const selected = devices.find(device => device.id === selectedId);
  const [activeStep, setActiveStep] = useState(0);
  const [supportConfirmed, setSupportConfirmed] = useState(false);
  const step = steps[activeStep];
  const locked = useAppStore(isLocked);
  const dialogOpen = useAppStore(state => state.dialog !== null);
  const actions = useAppStore(state => state.actions);
  const complete = step.id === 'complete' && !!selected;
  const disconnected = step.id === 'complete' && !selected;
  const heading = useRef<HTMLHeadingElement>(null);
  const focusKey = `${activeStep}:${selected?.id ?? ''}`;
  const lastFocusKey = useRef(focusKey);
  useEffect(() => {
    if (locked || dialogOpen || lastFocusKey.current === focusKey) return;
    lastFocusKey.current = focusKey;
    heading.current?.focus({ preventScroll: true });
  }, [focusKey, locked, dialogOpen]);
  const unsupported = !usbAvailable || session.state === 'unsupported';
  const selectedName = selected && text(deviceName(selected, devices));
  const status = session.authorizing ? t('connection.authorizing') : selected
    ? t('connection.connected', { product: selectedName! })
    : unsupported ? t('connection.unsupported')
    : t(session.state === 'connecting' ? 'connection.connecting' : 'connection.error');
  const showStatus = unsupported || step.id === 'permission' && (attempted || !!selected);
  const needsRetry = (selectionFailed || attempted && !selected) && !locked && !unsupported;
  async function chooseDevice() {
    setAttempted(true);
    setSelectionFailed(false);
    const id = await actions.connect();
    if (id) setSelectedId(id);
    else setSelectionFailed(true);
  }

  return <div className="device-page connection-guide-page">
    <div className="guide-toolbar">
      <Button className="page-back" variant="ghost" disabled={locked} onClick={() => actions.navigate('devices')}>
        <ArrowLeft />{t('devices.back')}
      </Button>
      <span id="guide-step-progress">{t('guide.step', { current: activeStep + 1, total: steps.length })}</span>
    </div>
    <ol className="connection-steps" aria-label={t('guide.steps')}>
      {steps.map((item, index) => {
        const done = index < 2 ? index < activeStep : !!selected && (index < activeStep || complete);
        return <li key={item.id} aria-current={activeStep === index ? 'step' : undefined} data-complete={done}>
          <span className="step-number" aria-hidden="true">{done ? <Check /> : index + 1}</span>
          <span>{t(item.label)}</span>
        </li>;
      })}
    </ol>
    <section className="guide-layout" aria-labelledby="page-title">
      <header className="guide-step-heading">
        <h2 id="page-title" ref={heading} tabIndex={-1} aria-describedby="guide-step-progress">{disconnected ? t('guide.disconnectedTitle') : t(step.title)}</h2>
        {!disconnected && !(step.id === 'permission' && selected) && <p>{t(step.description)}</p>}
      </header>
      <div className="guide-illustration-stage" key={activeStep}>
        <ConnectionIllustration step={step.id} connected={!!selected} model={selected?.model} />
      </div>
      <div className="guide-instructions" key={step.id}>
        {step.id === 'support' && <div className="guide-support">
          <p id="supported-models-title" className="guide-field-label">{t('guide.supportedModels')}</p>
          <ul className="supported-models" aria-labelledby="supported-models-title">
            {supportedModels.map(model => <li key={model.id}><Keyboard aria-hidden="true" /><strong>{model.name}</strong></li>)}
          </ul>
          <label className="support-confirmation">
            <Checkbox checked={supportConfirmed} disabled={locked} onCheckedChange={checked => setSupportConfirmed(checked === true)} />
            <span>{t('guide.supportConfirm')}</span>
          </label>
          <details className="guide-help">
            <summary>{t('guide.modelHelp')}</summary>
            <p>{t('guide.unsupportedModel')}</p>
          </details>
        </div>}
        {step.id === 'cable' && <div className="guide-cable-note"><Cable aria-hidden="true" /><p>{t('guide.cableHint')}</p></div>}
        {step.id === 'permission' && !selected && <ol className="guide-picker-instructions" aria-label={t('guide.pickerInstructions')}>
          <li><span aria-hidden="true">1</span>{t('guide.pickerSelect')}</li>
          <li><span aria-hidden="true">2</span>{t('guide.pickerConfirm')}</li>
        </ol>}
        {step.id === 'permission' && !attempted && !selected && devices.length > 0 && <p className="guide-existing-devices">{t('guide.existingDevices', { count: devices.length })}</p>}
        {complete && <div className="guide-selected-device"><Keyboard aria-hidden="true" /><strong>{selectedName}</strong></div>}
        {disconnected && <div className="guide-cable-note"><Cable aria-hidden="true" /><p>{t('guide.disconnectedDescription')}</p></div>}
        {showStatus && <div className="guide-connection-state" role="status" data-warning={unsupported || needsRetry}>
          {unsupported || needsRetry ? <CircleAlert aria-hidden="true" /> : selected ? <CheckCircle2 aria-hidden="true" /> : <span className="status-dot authorizing" />}
          <div><strong>{status}</strong>
            {unsupported ? <p>{t('guide.browserRequired')}</p> : needsRetry && <>
              <p>{text(session.message)}</p>
              <p>{t(selected ? 'guide.reselectHint' : 'guide.retryHint')}</p>
            </>}
          </div>
        </div>}
        {step.id === 'permission' && selected && <Button className="guide-pick-again" variant="ghost" disabled={unsupported || locked} onClick={chooseDevice}>
          {t('guide.chooseAgain')}
        </Button>}
        {(step.id === 'cable' || step.id === 'permission') && <details className="guide-help">
          <summary>{t('guide.connectionHelp')}</summary>
          <ul><li>{t('guide.checkCable')}</li><li>{t('guide.closeOtherTools')}</li></ul>
        </details>}
      </div>
      <div className="guide-step-actions">
        {activeStep > 0 && <Button variant="ghost" disabled={locked} onClick={() => setActiveStep(activeStep - 1)}><ArrowLeft />{t('guide.previous')}</Button>}
        {step.id === 'support'
          ? <Button className="guide-connect" disabled={locked || !supportConfirmed} onClick={() => setActiveStep(1)}>{t('guide.supportNext')}<ArrowRight /></Button>
          : step.id === 'cable'
          ? <Button className="guide-connect" disabled={locked} onClick={() => setActiveStep(2)}>{t('guide.cableNext')}<ArrowRight /></Button>
          : step.id === 'permission'
            ? selected
              ? <Button className="guide-connect" disabled={locked} onClick={() => setActiveStep(3)}>{t('guide.next')}<ArrowRight /></Button>
              : <Button className="guide-connect" disabled={unsupported || locked} onClick={chooseDevice}>{t(devices.length ? 'connection.addAnother' : 'connection.connect')}<ArrowRight /></Button>
            : complete
              ? <Button className="guide-connect" disabled={locked} onClick={() => actions.navigate('devices')}>{t('guide.finish')}<ArrowRight /></Button>
              : <Button className="guide-connect" disabled={locked} onClick={() => setActiveStep(2)}>{t('guide.reconnect')}<ArrowRight /></Button>}
      </div>
    </section>
    <div className="guide-alternative"><Button variant="ghost" disabled={locked} onClick={actions.demo}><Play />{t('keyboard.demo')}</Button></div>
  </div>;
}
