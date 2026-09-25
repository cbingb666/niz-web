import { useI18n } from '@/i18n/use-i18n';
import { backupReason } from '@/i18n/core';
import { useAppStore } from '@/store/context';
import { OperationOverlay } from './operation-overlay';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from './ui/alert-dialog';

export function AppDialogs() {
  const { t, text, locale, count } = useI18n();
  const dialog = useAppStore((state) => state.dialog);
  const operation = useAppStore((state) => state.hardwareOperation);
  const backups = useAppStore((state) => state.backupRows);
  const actions = useAppStore((state) => state.actions);
  if (operation) return <OperationOverlay operation={operation} />;
  if (!dialog) return null;
  if (dialog.kind === 'confirm')
    return (
      <AlertDialog
        open
        onOpenChange={(open) => {
          if (!open) actions.confirm(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{text(dialog.title)}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-wrap leading-relaxed">
            {text(dialog.body)}
          </AlertDialogDescription>
          <div className="flex justify-end gap-3">
            <AlertDialogCancel onClick={() => actions.confirm(false)}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => actions.confirm(true)}>{text(dialog.label)}</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) actions.closeDialog();
      }}
    >
      <DialogContent closeLabel={t('common.close')}>
        {dialog.kind === 'message' ? (
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
