import { useI18n } from '@/i18n/use-i18n';
import { backupReason } from '@/i18n/core';
import { deviceName } from '@/i18n/device';
import { useAppStore } from '@/store/context';
import { OperationOverlay } from './operation-overlay';
import { ConfirmationDialog } from './confirmation-dialog';
import { CalibrationDialog } from './calibration-dialog';
import { ChangeReview } from './change-review';
import { ActivityLog } from './activity-log';
import { DeviceDetails } from './connected-device';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

export function AppDialogs() {
  const { t, text, locale, count } = useI18n();
  const dialog = useAppStore((state) => state.dialog);
  const devices = useAppStore(state => state.connectedDevices);
  const operation = useAppStore((state) => state.hardwareOperation);
  const backups = useAppStore((state) => state.backupRows);
  const actions = useAppStore((state) => state.actions);
  const calibration = useAppStore(state => state.calibration);
  const detailDevice = dialog?.kind === 'device' ? devices.find(device => device.id === dialog.deviceId) : undefined;
  if (calibration && (operation === 'calibrate' || dialog?.kind === 'calibration'))
    return <CalibrationDialog key={`${calibration.target.id}:${calibration.target.epoch}`} view={calibration} />;
  if (operation === 'read' || operation === 'write') return <OperationOverlay operation={operation} />;
  if (!dialog) return null;
  if (dialog.kind === 'confirm') return <ConfirmationDialog dialog={dialog} onConfirm={actions.confirm} />;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) actions.closeDialog();
      }}
    >
      <DialogContent closeLabel={t('common.close')} className={dialog.kind === 'changes' ? 'review-dialog' : dialog.kind === 'activity' ? 'activity-dialog' : undefined}
        onCloseAutoFocus={event => {
          const trigger = dialog.kind === 'activity' ? 'activity-trigger' : dialog.kind === 'device' ? dialog.triggerId : null;
          if (trigger) {
            event.preventDefault();
            const fallback = dialog.kind === 'device' ? 'page-title' : 'activity-trigger';
            (document.getElementById(trigger) ?? document.getElementById(fallback))?.focus({ preventScroll: true });
          }
        }}>
        {dialog.kind === 'changes' ? <>
          <DialogHeader><DialogTitle>{t('mapping.reviewTitle')}</DialogTitle><DialogDescription>{t('mapping.reviewHint')}</DialogDescription></DialogHeader>
          <ChangeReview review={dialog.review} />
        </> : dialog.kind === 'activity' ? <>
          <DialogHeader><DialogTitle>{t('activity.title')}</DialogTitle><DialogDescription>{t('activity.description')}</DialogDescription></DialogHeader>
          <ActivityLog />
        </> : dialog.kind === 'device' ? <>
          <DialogHeader><DialogTitle>{t('connection.details')}</DialogTitle><DialogDescription>{t('connection.detailsDescription', {
            name: detailDevice ? text(deviceName(detailDevice, devices)) : '—',
          })}</DialogDescription></DialogHeader>
          <DeviceDetails deviceId={dialog.deviceId} />
        </> : dialog.kind === 'message' ? (
          <>
            <DialogHeader>
              <DialogTitle>{text(dialog.title)}</DialogTitle>
              <DialogDescription className="whitespace-pre-wrap leading-relaxed">
                {text(dialog.body)}
              </DialogDescription>
            </DialogHeader>
            <Button className="justify-self-end" onClick={actions.closeDialog}>
              {t('common.ok')}
            </Button>
          </>
        ) : dialog.kind === 'backups' ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('backup.title')}</DialogTitle>
              <DialogDescription>{t('backup.description')}</DialogDescription>
            </DialogHeader>
            {backups.length ? (
              backups.map((row) => (
                <section className="backup-item" key={row.id}>
                  <div>
                    <h3>
                      {text(backupReason(row.reason))} ·{' '}
                      {new Date(row.createdAt).toLocaleString(locale, { hour12: false })}
                    </h3>
                    <p>
                      {row.version} · {count(row.records, 'keyboard.records.one', 'keyboard.records.other')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => actions.importBackup(row.id)}>
                      {t('common.import')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => actions.downloadBackup(row.id)}>
                      {t('common.download')}
                    </Button>
                  </div>
                </section>
              ))
            ) : (
              <p className="muted">{t('backup.empty')}</p>
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('help.title')}</DialogTitle>
              <DialogDescription>{t('help.description')}</DialogDescription>
            </DialogHeader>
            <div className="help-content">
              <ol>
                <li>{t('help.connect')}</li>
                <li>{t('help.read')}</li>
                <li>{t('help.edit')}</li>
                <li>{t('help.write')}</li>
              </ol>
              <p>{t('help.reconnect')}</p>
              <p>{t('help.features')}</p>
              <p>{t('help.validation')}</p>
              <p>{t('help.privacy')}</p>
              <a
                href="https://developer.chrome.com/docs/capabilities/hid"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('help.webhid')}
              </a>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
