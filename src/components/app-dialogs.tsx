import { useI18n } from '@/i18n/use-i18n';
import { backupReason } from '@/i18n/core';
import { localizedDetail } from '@/i18n/profile';
import { deviceName } from '@/i18n/device';
import { useAppStore } from '@/store/context';
import { OperationOverlay } from './operation-overlay';
import { ConfirmationDialog } from './confirmation-dialog';
import { CalibrationDialog } from './calibration-dialog';
import { FirmwareDialog } from './firmware-dialog';
import { ChangeReview } from './change-review';
import { ActivityLog } from './activity-log';
import { DeviceDetails } from './connected-device';
import { BackupEmptyState } from './backup-empty-state';
import { ManualPicker } from './manual-picker';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

export function AppDialogs() {
  const { t, text, locale, count } = useI18n();
  const dialog = useAppStore((state) => state.dialog);
  const devices = useAppStore(state => state.connectedDevices);
  const operation = useAppStore((state) => state.hardwareOperation);
  const backups = useAppStore((state) => state.backupRows);
  const busy = useAppStore(state => !!state.busy);
  const actions = useAppStore((state) => state.actions);
  const calibration = useAppStore(state => state.calibration);
  const firmware = useAppStore(state => state.firmware);
  const detailDevice = dialog?.kind === 'device' ? devices.find(device => device.id === dialog.deviceId) : undefined;
  if (calibration && (operation === 'calibrate' || dialog?.kind === 'calibration'))
    return <CalibrationDialog key={`${calibration.target.id}:${calibration.target.epoch}`} view={calibration} />;
  if (firmware && (operation === 'firmware' || dialog?.kind === 'firmware'))
    return <FirmwareDialog key={`${firmware.target.id}:${firmware.target.epoch}`} view={firmware} />;
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
      <DialogContent closeLabel={t('common.close')} className={dialog.kind === 'changes' || dialog.kind === 'importMigration' ? 'review-dialog' : dialog.kind === 'activity' ? 'activity-dialog' : dialog.kind === 'backups' ? 'backups-dialog' : dialog.kind === 'manuals' ? 'manual-dialog' : undefined}
        {...(dialog.kind === 'backups' ? { 'aria-labelledby': 'backup-title' } : {})}
        onCloseAutoFocus={event => {
          const trigger = dialog.kind === 'changes' ? 'changes-trigger' : dialog.kind === 'manuals' ? 'manuals-trigger' : dialog.kind === 'activity' ? 'activity-trigger' : dialog.kind === 'backups' ? 'backups-trigger' : dialog.kind === 'device' ? dialog.triggerId : null;
          if (trigger) {
            event.preventDefault();
            const fallback = dialog.kind === 'device' ? 'page-title' : 'activity-trigger';
            (document.getElementById(trigger) ?? document.getElementById(fallback))?.focus({ preventScroll: true });
          }
        }}>
        {dialog.kind === 'importMigration' ? <>
          <DialogHeader>
            <DialogTitle>{t('importMigration.title')}</DialogTitle>
            <DialogDescription>{t('importMigration.description')}</DialogDescription>
          </DialogHeader>
          <p className="text-sm break-words">{dialog.source.version} → {dialog.result.profile.version}</p>
          {!!dialog.result.skipped.length && <div className="change-review">
            <table><thead><tr><th>{t('mapping.position')}</th><th>{t('importMigration.source')}</th><th>{t('importMigration.kept')}</th></tr></thead>
              <tbody>{dialog.result.skipped.map(({ index, reason }) => <tr key={index}>
                <th scope="row">{text(dialog.source.model.layers[Math.floor(index / dialog.source.model.keyCount)])}<br />
                  {t('keyboard.position', { position: index % dialog.source.model.keyCount + 1 })}</th>
                <td>{localizedDetail(dialog.source, index, locale)}<p className="text-sm text-muted-foreground">{text(reason)}</p></td>
                <td>{localizedDetail(dialog.result.profile, index, locale)}</td>
              </tr>)}</tbody>
            </table>
          </div>}
          {dialog.result.lightsSkipped && <p>{t('importMigration.lightsSkipped')}</p>}
          <Button className="justify-self-end" onClick={actions.closeDialog}>{t('importMigration.continue')}</Button>
        </> : dialog.kind === 'manuals' ? <ManualPicker /> : dialog.kind === 'changes' ? <>
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
            <DialogHeader className="shrink-0">
              <DialogTitle id="backup-title" tabIndex={-1}>{t('backup.title')}</DialogTitle>
              <DialogDescription>{t('backup.description')}</DialogDescription>
            </DialogHeader>
            <div className="backup-list" role="region" aria-labelledby="backup-title" tabIndex={0} aria-busy={busy}>
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
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => actions.importBackup(row.id)}>
                        {t('common.import')}
                      </Button>
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => actions.downloadBackup(row.id)}>
                        {t('common.download')}
                      </Button>
                      <Button id={`backup-delete-${row.id}`} variant="outline" size="sm" disabled={busy}
                        onClick={() => actions.deleteBackup(row.id)}>
                        {t('backup.delete')}
                      </Button>
                    </div>
                  </section>
                ))
              ) : (
                <BackupEmptyState />
              )}
            </div>
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
