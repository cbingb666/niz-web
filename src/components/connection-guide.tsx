import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Cable, Check, CheckCircle2, MousePointer2, Play, ShieldCheck, Unplug } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';
import { deviceName } from '@/i18n/device';
import { isLocked } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';
import { ConnectionIllustration } from './connection-illustration';

const steps = [
  { label: 'guide.usbStep', title: 'guide.usbTitle', description: 'guide.usbDescription', icon: Cable },
  { label: 'guide.permissionStep', title: 'guide.permissionTitle', description: 'guide.permissionDescription', icon: MousePointer2 },
  { label: 'guide.completeStep', title: 'guide.completeTitle', description: 'guide.completeDescription', icon: CheckCircle2 },
] as const;

export function ConnectionGuide({ usbAvailable }: { usbAvailable: boolean }) {
  const { t, text } = useI18n();
  const session = useAppStore(state => state.session);
  const devices = useAppStore(state => state.connectedDevices);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const selected = devices.find(device => device.id === selectedId);
  const [activeStep, setActiveStep] = useState<0 | 1 | 2>(0);
  const locked = useAppStore(isLocked);
  const dialogOpen = useAppStore(state => state.dialog !== null);
  const actions = useAppStore(state => state.actions);
  const complete = activeStep === 2 && !!selected;
  const StepIcon = activeStep === 2 && !selected ? Unplug : steps[activeStep].icon;
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
    : t(session.state === 'connecting' ? 'connection.connecting' : session.state === 'error' ? 'connection.error' : 'guide.selectDevice');
  async function chooseDevice() {
    setAttempted(true);
    const id = await actions.connect();
    if (id) setSelectedId(id);
  }

  return <div className="device-page connection-guide-page">
    <Button className="page-back" variant="ghost" disabled={locked} onClick={() => actions.navigate('devices')}>
      <ArrowLeft />{t('devices.back')}
    </Button>
    <div className="device-page-heading">
      <div>
        <h2 id="page-title" tabIndex={-1}>{t('guide.title')}</h2>
        <p className="page-description">{t('guide.description')}</p>
      </div>
    </div>
    <ol className="connection-steps" aria-label={t('guide.steps')}>
      {steps.map((step, index) => <li key={step.title} aria-current={activeStep === index ? 'step' : undefined}
        data-complete={index === 0 ? activeStep > 0 : !!selected && (index < activeStep || complete)}>
        <span className="step-number" aria-hidden="true">{(index === 0 ? activeStep > 0 : !!selected && (index < activeStep || complete)) ? <Check /> : `0${index + 1}`}</span>
        <span>{t(step.label)}</span>
      </li>)}
    </ol>
    <section className="guide-layout" aria-labelledby="guide-step-title">
      <div className="guide-visual" data-step={activeStep} data-connected={complete}>
        <div className="guide-visual-label">{t(activeStep < 2 ? 'guide.illustrationLabel' : 'guide.connectionLabel')}</div>
        <div className="guide-illustration-stage" key={activeStep}>
          <ConnectionIllustration step={activeStep} connected={!!selected} />
        </div>
        <div className="guide-visual-caption" key={focusKey}>
          <span className="guide-caption-icon"><StepIcon aria-hidden="true" /></span>
          <div><span className="guide-step-label">{t('guide.step', { current: activeStep + 1, total: steps.length })}</span>
            <strong>{activeStep === 2 && !selected ? t('guide.disconnectedTitle') : t(steps[activeStep].label)}</strong></div>
        </div>
        <div className="guide-progress" aria-hidden="true">{steps.map((step, index) => <span key={step.title} data-active={index === activeStep} />)}</div>
      </div>

      <div className="guide-instructions">
        <div className="guide-step-copy" key={focusKey}>
          <p className="page-eyebrow">{t('guide.step', { current: activeStep + 1, total: steps.length })}</p>
          <h3 id="guide-step-title" ref={heading} tabIndex={-1}>{activeStep === 2 && !selected ? t('guide.disconnectedTitle') : t(steps[activeStep].title)}</h3>
          <p className="step-description">{activeStep === 2 && !selected ? t('guide.disconnectedDescription') : t(steps[activeStep].description)}</p>
          {activeStep === 0 && <div className="guide-step-tip"><Cable aria-hidden="true" /><p>{t('guide.cableHint')}</p></div>}
          {complete && <div className="guide-step-tip"><ShieldCheck aria-hidden="true" /><p>{t('guide.configureLater')}</p></div>}
        </div>
        {(activeStep > 0 || unsupported) && <div className="guide-connection-state" role="status">
          <span className={`status-dot ${session.authorizing ? 'authorizing' : selected ? 'connected' : unsupported ? 'error' : 'waiting'}`} />
          <div><strong>{status}</strong>
            <p>{unsupported ? t('guide.browserRequired') : selected ? t(activeStep === 2 ? 'guide.configureLater' : 'guide.deviceReady')
              : !attempted && devices.length ? t('guide.existingDevices', { count: devices.length }) : text(session.message) || t('guide.permissionHint')}</p>
          </div>
        </div>}
        {activeStep === 1 && selected && <Button className="guide-pick-again" variant="outline" disabled={unsupported || locked} onClick={chooseDevice}>
          <MousePointer2 />{t('guide.chooseAgain')}
        </Button>}
        <div className="guide-step-actions">
          {activeStep > 0 && <Button variant="outline" disabled={locked} onClick={() => setActiveStep(activeStep === 2 ? 1 : 0)}><ArrowLeft />{t('guide.previous')}</Button>}
          {activeStep === 0
            ? <Button className="guide-connect" disabled={locked} onClick={() => setActiveStep(1)}>{t('guide.cableNext')}<ArrowRight /></Button>
            : activeStep === 1
              ? selected
                ? <Button className="guide-connect" disabled={locked} onClick={() => setActiveStep(2)}>{t('guide.next')}<ArrowRight /></Button>
                : <Button className="guide-connect" disabled={unsupported || locked} onClick={chooseDevice}><MousePointer2 />{t(devices.length ? 'connection.addAnother' : 'connection.connect')}<ArrowRight /></Button>
              : complete
                ? <Button className="guide-connect" disabled={locked} onClick={() => actions.navigate('devices')}>{t('guide.finish')}<ArrowRight /></Button>
                : <Button className="guide-connect" disabled={locked} onClick={() => setActiveStep(1)}>{t('guide.reconnect')}<ArrowRight /></Button>}
        </div>
      </div>
    </section>
    <section className="guide-demo" aria-labelledby="guide-demo-title">
      <span className="demo-icon"><Play aria-hidden="true" /></span>
      <div><h3 id="guide-demo-title">{t('guide.demoTitle')}</h3><p>{t('guide.demoDescription')}</p></div>
      <Button variant="outline" disabled={locked} onClick={actions.demo}>{t('keyboard.demo')}<ArrowRight /></Button>
    </section>
  </div>;
}
