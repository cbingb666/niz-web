import { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, TriangleAlert } from 'lucide-react';
import type { CalibrationView } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { useI18n } from '@/i18n/use-i18n';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { KeyboardLockIllustration } from './keyboard-lock-illustration';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from './ui/alert-dialog';

export function CalibrationDialog({ view }: { view: CalibrationView }) {
  const { t, text } = useI18n();
  const actions = useAppStore(state => state.actions);
  const active = useAppStore(state => state.hardwareOperation === 'calibrate');
  const content = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const held = useRef<HTMLButtonElement>(null);
  const typing = useRef<HTMLTextAreaElement>(null);
  const activation = useRef<string | null>(null);
  const [awaitRelease, setAwaitRelease] = useState(false);
  const [testText, setTestText] = useState('');
  const phase = view.state.phase;
  const preparing = phase === 'preparing';
  const ready = phase === 'awaiting-held-keys';
  const terminal = phase === 'testing' || phase === 'failed';
  const waiting = !preparing && !ready && !terminal;
  const step = preparing || ['identifying', 'locking', 'calibrating-release'].includes(phase) ? 1 :
    phase === 'testing' || phase === 'failed' || phase === 'unlocking' ? 3 : 2;

  useEffect(() => {
    if (ready) held.current?.focus();
    else if (phase === 'testing') typing.current?.focus();
    else if (!preparing) content.current?.focus();
  }, [phase, preparing, ready]);

  const start = () => {
    activation.current = null;
    setAwaitRelease(false);
    void actions.startCalibration();
  };

  return <AlertDialog open onOpenChange={open => { if (!open && !active) actions.closeCalibration(); }}>
    <AlertDialogContent ref={content} className="calibration-dialog" tabIndex={-1}
      onEscapeKeyDown={event => { if (active) event.preventDefault(); }}
      onOpenAutoFocus={event => {
        event.preventDefault();
        if (preparing) cancel.current?.focus();
        else content.current?.focus();
      }}
      onCloseAutoFocus={event => {
        event.preventDefault();
        (document.getElementById(`calibration-${view.target.id}`) ?? document.getElementById(`calibration-result-${view.target.id}`) ??
          document.getElementById('page-title'))?.focus();
      }}>
      <div className="calibration-heading">
        <AlertDialogTitle>{t('calibration.title')}</AlertDialogTitle>
        <p className="text-sm text-muted-foreground">{text(view.name)}</p>
        <p className="text-xs text-muted-foreground">{t('calibration.validationNotice')}</p>
      </div>
      <p className="text-sm text-muted-foreground">{t('calibration.step', { step })}</p>
      <div className="calibration-stage" role="status" aria-live="polite">
        {waiting ? <LoaderCircle className="operation-spinner" aria-hidden="true" /> :
          phase === 'failed' ? <TriangleAlert aria-hidden="true" /> :
            phase === 'testing' ? <Check aria-hidden="true" /> : null}
        <h3>{t(`calibration.phase.${phase}`)}</h3>
      </div>
      {(preparing || (waiting && phase !== 'unlocking')) && <KeyboardLockIllustration label={t('calibration.lockIllustration')} />}
      <AlertDialogDescription asChild>
        <div className="calibration-copy">
          {preparing ? <>
            <p>{t('calibration.releaseBody')}</p>
            <p>{t('calibration.backupNotice')}</p>
          </> : ready ? <>
            {view.state.batches > 0 && <p>{t('calibration.batchDone', { count: view.state.batches })}</p>}
            <p>{t('calibration.holdBody')}</p>
          </> : phase === 'testing' ? <>
            <p>{t('calibration.testingBody')}</p>
            <p>{t('calibration.testHint')}</p>
          </> : phase === 'failed' ? <>
            <p className="text-destructive">{view.state.error && text(view.state.error)}</p>
            <p>{t(view.state.unlock === 'sent' ? 'calibration.unlockSent' : view.state.unlock === 'not-needed' ?
              'calibration.noLock' : 'calibration.unlockUncertain')}</p>
            <p>{t('calibration.recovery')}</p>
          </> : <p>{t(phase === 'calibrating-press' ? 'calibration.keepHeld' :
            phase === 'unlocking' ? 'operation.keepConnected' : 'calibration.releaseWaiting')}</p>}
        </div>
      </AlertDialogDescription>
      {preparing && <div className="flex items-start gap-3">
        <Checkbox id="calibration-trace" checked={view.recordTrace} onCheckedChange={checked => actions.setCalibrationTrace(checked === true)} />
        <Label htmlFor="calibration-trace" className="text-sm leading-relaxed">{t('calibration.trace')}</Label>
      </div>}
      {preparing && awaitRelease && <p className="text-sm" role="status">{t('calibration.releaseActivation')}</p>}
      {phase === 'testing' && <div className="grid gap-2">
        <Label htmlFor="calibration-test">{t('calibration.testLabel')}</Label>
        <Textarea ref={typing} id="calibration-test" value={testText} onChange={event => setTestText(event.target.value)}
          autoComplete="off" spellCheck={false} rows={3} />
        <p className="text-sm text-muted-foreground">{t('calibration.baselineNotice')}</p>
      </div>}
      <div className="calibration-actions">
        {preparing ? <>
          <Button ref={cancel} variant="outline" onClick={actions.closeCalibration}>{t('common.cancel')}</Button>
          <Button onKeyDown={event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            if (!event.repeat) { activation.current = event.key; setAwaitRelease(true); }
          }} onKeyUp={event => {
            if (event.key !== activation.current) return;
            event.preventDefault();
            start();
          }} onPointerDown={() => { activation.current = null; setAwaitRelease(false); }}
          onClick={() => { if (!activation.current) start(); }}>{t('calibration.start')}</Button>
        </> : ready ? <>
          <Button variant="outline" onClick={actions.finishCalibration}>{t('calibration.finish')}</Button>
          <Button ref={held} onClick={actions.calibrateHeldKeys}>{t('calibration.press')}</Button>
        </> : terminal ? <>
          {view.hasCapture && <Button variant="outline" onClick={actions.exportCalibration}>{t('calibration.export')}</Button>}
          <Button disabled={active} onClick={actions.closeCalibration}>{t('calibration.done')}</Button>
        </> : null}
      </div>
    </AlertDialogContent>
  </AlertDialog>;
}
