import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Cable, Check, CheckCircle2, MousePointer2, Play, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';
import { isLocked } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { Button } from './ui/button';
import { DeviceIllustration } from './device-illustration';

const steps = [
  { label: 'guide.usbStep', title: 'guide.usbTitle', description: 'guide.usbDescription', icon: Cable },
  { label: 'guide.permissionStep', title: 'guide.permissionTitle', description: 'guide.permissionDescription', icon: MousePointer2 },
  { label: 'guide.configureStep', title: 'guide.configureTitle', description: 'guide.configureDescription', icon: SlidersHorizontal },
] as const;

export function ConnectionGuide({ usbAvailable }: { usbAvailable: boolean }) {
  const { t, text } = useI18n();
  const session = useAppStore(state => state.session);
  const [cableConfirmed, setCableConfirmed] = useState(session.connected);
  const locked = useAppStore(isLocked);
  const dialogOpen = useAppStore(state => state.dialog !== null);
  const actions = useAppStore(state => state.actions);
  const activeStep = session.connected ? 2 : cableConfirmed || session.authorizing || session.state === 'connecting' ? 1 : 0;
  const complete = session.connected && session.hasLiveBaseline;
  const StepIcon = complete ? CheckCircle2 : steps[activeStep].icon;
  const heading = useRef<HTMLHeadingElement>(null);
  const focusKey = `${activeStep}:${complete}`;
  const lastFocusKey = useRef(focusKey);
  useEffect(() => {
    if (locked || dialogOpen || lastFocusKey.current === focusKey) return;
    lastFocusKey.current = focusKey;
    heading.current?.focus({ preventScroll: true });
  }, [focusKey, locked, dialogOpen]);
  const unsupported = !usbAvailable || session.state === 'unsupported';
  const status = session.connected
    ? t('connection.connected', { product: session.model?.name || session.product })
    : unsupported ? t('connection.unsupported')
    : t(session.state === 'authorizing' ? 'connection.authorizing' : session.state === 'connecting' ? 'connection.connecting' : session.state === 'error' ? 'connection.error' : 'guide.ready');

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
        data-complete={index < activeStep || complete}>
        <span className="step-number" aria-hidden="true">{index < activeStep || complete ? <Check /> : `0${index + 1}`}</span>
        <span>{t(step.label)}</span>
      </li>)}
    </ol>
    <section className="guide-layout" aria-labelledby="guide-step-title">
      <div className="guide-visual" data-step={activeStep} data-connected={complete}>
        <div className="guide-visual-label"><span className={`status-dot ${session.connected ? 'connected' : ''}`} />{t('guide.connectionLabel')}</div>
        <div className="guide-illustration-stage" key={activeStep}>
          <DeviceIllustration variant={activeStep === 0 ? 'keyboard' : 'connection'} animated />
        </div>
        <div className="guide-visual-caption" key={focusKey}>
          <span className="guide-caption-icon"><StepIcon aria-hidden="true" /></span>
          <div><span className="guide-step-label">{t('guide.step', { current: activeStep + 1, total: steps.length })}</span>
            <strong>{complete ? t('guide.completeTitle') : t(steps[activeStep].label)}</strong></div>
        </div>
        <div className="guide-progress" aria-hidden="true">{steps.map((step, index) => <span key={step.title} data-active={index === activeStep} />)}</div>
      </div>

      <div className="guide-instructions">
        <div className="guide-step-copy" key={focusKey}>
          <p className="page-eyebrow">{t('guide.step', { current: activeStep + 1, total: steps.length })}</p>
          <h3 id="guide-step-title" ref={heading} tabIndex={-1}>{complete ? t('guide.completeTitle') : t(steps[activeStep].title)}</h3>
          <p className="step-description">{complete ? t('guide.completeDescription') : t(steps[activeStep].description)}</p>
          {activeStep === 0 && <div className="guide-step-tip"><Cable aria-hidden="true" /><p>{t('guide.cableHint')}</p></div>}
          {activeStep === 2 && <div className="guide-step-tip"><ShieldCheck aria-hidden="true" /><p>{t(complete ? 'guide.backupHint' : 'guide.readHint')}</p></div>}
        </div>
        {(activeStep > 0 || unsupported) && <div className="guide-connection-state" role="status">
          <span className={`status-dot ${session.connected ? 'connected' : unsupported ? 'error' : session.state}`} />
          <div><strong>{status}</strong>
            <p>{unsupported ? t('guide.browserRequired') : session.connected ? t(complete ? 'connection.loaded' : 'connection.notRead') : text(session.message) || t('guide.permissionHint')}</p>
          </div>
        </div>}
        <div className="guide-step-actions">
          {activeStep === 1 && <Button variant="outline" disabled={locked} onClick={() => setCableConfirmed(false)}><ArrowLeft />{t('guide.previous')}</Button>}
          {activeStep === 0
            ? <Button className="guide-connect" disabled={locked} onClick={() => setCableConfirmed(true)}>{t('guide.cableNext')}<ArrowRight /></Button>
            : activeStep === 1
              ? <Button className="guide-connect" disabled={unsupported || locked} onClick={actions.connect}><MousePointer2 />{t('connection.connect')}<ArrowRight /></Button>
              : complete
                ? <Button className="guide-connect" disabled={locked} onClick={() => actions.navigate('devices')}>{t('guide.finish')}<ArrowRight /></Button>
                : <Button className="guide-connect" disabled={locked} onClick={actions.read}>{t('guide.read')}<ArrowRight /></Button>}
        </div>
        <p className="guide-privacy"><ShieldCheck aria-hidden="true" />{t('guide.readConsent')}</p>
      </div>
    </section>
    <section className="guide-demo" aria-labelledby="guide-demo-title">
      <span className="demo-icon"><Play aria-hidden="true" /></span>
      <div><h3 id="guide-demo-title">{t('guide.demoTitle')}</h3><p>{t('guide.demoDescription')}</p></div>
      <Button variant="outline" disabled={locked} onClick={actions.demo}>{t('keyboard.demo')}<ArrowRight /></Button>
    </section>
  </div>;
}
