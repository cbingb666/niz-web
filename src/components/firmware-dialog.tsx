import { useEffect, useRef } from 'react';
import { Cpu, TriangleAlert } from 'lucide-react';
import type { FirmwareView } from '@/store/app-store';
import { useAppStore } from '@/store/context';
import { useI18n } from '@/i18n/use-i18n';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { KeyboardLockIllustration } from './keyboard-lock-illustration';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from './ui/alert-dialog';

export function FirmwareDialog({ view }: { view: FirmwareView }) {
  const { t, text } = useI18n();
  const actions = useAppStore(state => state.actions);
  const active = useAppStore(state => state.hardwareOperation === 'firmware');
  const device = useAppStore(state => state.connectedDevices.find(device => device.id === view.target.id));
  const content = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const phase = view.state.phase;
  const preparing = ['preparing', 'checking-file', 'ready'].includes(phase);
  const reconnect = phase === 'awaiting-reconnect' || phase === 'unconfirmed';
  const percentage = phase === 'sending' && view.state.total > 0 ? Math.floor(view.state.completed / view.state.total * 100) : null;
  const targetConnected = !!device?.firmwareFlash && device.epoch === view.target.epoch;

  useEffect(() => {
    if (!preparing) content.current?.focus({ preventScroll: true });
  }, [phase, preparing]);

  return <AlertDialog open onOpenChange={open => { if (!open && !active) actions.closeFirmware(); }}>
    <AlertDialogContent ref={content} tabIndex={-1}
      onEscapeKeyDown={event => { if (active) event.preventDefault(); }}
      onOpenAutoFocus={event => { event.preventDefault(); if (preparing) cancel.current?.focus(); else content.current?.focus(); }}
      onCloseAutoFocus={event => {
        event.preventDefault();
        (document.getElementById(`firmware-${view.target.id}`) ?? document.getElementById(`firmware-result-${view.target.id}`) ??
          document.getElementById('page-title'))?.focus({ preventScroll: true });
      }}>
      <div className="grid gap-2">
        <AlertDialogTitle>{t('firmware.title')}</AlertDialogTitle>
        <p className="text-sm text-muted-foreground">{text(view.name)}</p>
        <p className="text-sm text-muted-foreground">{t('firmware.scope')}</p>
      </div>
      {(preparing || active && phase !== 'checking-version') && <KeyboardLockIllustration />}
      <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-semibold">
        {phase === 'failed' ? <TriangleAlert aria-hidden="true" size={20} /> : <Cpu aria-hidden="true" size={20} />}
        {t(`firmware.phase.${phase}`)}
      </p>
      <AlertDialogDescription asChild>
        <div className="grid gap-3 text-sm leading-relaxed text-left">
          {preparing ? <>
            <p>{t('firmware.lock')}</p>
            <p>{t('firmware.risk')}</p>
            <p>{t('firmware.backupNotice')}</p>
          </> : reconnect ? <>
            {phase === 'unconfirmed' && !view.canVerify && <p>{t('firmware.unconfirmed')}</p>}
            <p>{t('firmware.reconnect')}</p>
          </> : phase === 'version-confirmed' ? <p>{t('firmware.verified')}</p> : phase === 'failed' ?
            <p>{t(view.state.attempted ? 'firmware.recovery' : 'firmware.noWrite')}</p> :
              <p>{t(phase === 'checking-version' ? 'operation.keepConnected' : 'firmware.lock')}</p>}
        </div>
      </AlertDialogDescription>
      {preparing && <div className="grid gap-2">
        <Label htmlFor="firmware-file">{t('firmware.file')}</Label>
        <Input id="firmware-file" type="file" accept=".bin" disabled={phase === 'checking-file'} onChange={event => {
          const file = event.target.files?.[0];
          if (file) void actions.selectFirmwareFile(file);
        }} />
        {view.file && <p className="text-sm break-words">{t('firmware.fileReady', { name: view.file.fileName })}</p>}
        {!targetConnected && <p className="text-sm">{t('firmware.changed')}</p>}
        {view.pendingInput && <p className="text-sm">{t('firmware.draftsRequired')}</p>}
      </div>}
      {view.state.error && <p role="alert" className="text-sm text-destructive leading-relaxed">{text(view.state.error)}</p>}
      {percentage !== null && <div className="operation-meter">
        <div role="progressbar" className="operation-progress" aria-label={t('firmware.phase.sending')}
          aria-valuemin={0} aria-valuemax={view.state.total} aria-valuenow={view.state.completed}>
          <div className="operation-progress-fill" style={{ width: `${percentage}%` }} />
        </div>
        <span className="operation-percentage" aria-hidden="true">{percentage}%</span>
      </div>}
      {!active && <div className="flex flex-wrap justify-end gap-3 pt-2">
        {preparing ? <>
          <Button ref={cancel} variant="outline" onClick={actions.closeFirmware}>{t('common.cancel')}</Button>
          <Button disabled={phase !== 'ready' || !targetConnected || view.pendingInput} onClick={actions.startFirmware}>{t('confirm.writeAction')}</Button>
        </> : <>
          {view.state.backupId && <Button variant="outline" onClick={actions.downloadFirmwareBackup}>{t('common.download')}</Button>}
          <Button variant="outline" onClick={actions.closeFirmware}>{t('common.close')}</Button>
          {reconnect && <Button disabled={!view.canVerify} onClick={actions.verifyFirmware}>{t('firmware.verify')}</Button>}
        </>}
      </div>}
    </AlertDialogContent>
  </AlertDialog>;
}
