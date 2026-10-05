import { useI18n } from '@/i18n/use-i18n';
import type { AppDialog } from '@/store/app-store';
import { ChangeReview } from './change-review';
import { KeyboardLockIllustration } from './keyboard-lock-illustration';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from './ui/alert-dialog';

export function ConfirmationDialog({ dialog, onConfirm }: {
  dialog: Extract<AppDialog, { kind: 'confirm' }>;
  onConfirm(accepted: boolean): void;
}) {
  const { t, text } = useI18n();
  const description = [dialog.body, dialog.notice, dialog.warning]
    .filter(value => value !== undefined).map(value => text(value!)).join('\n\n');
  return <AlertDialog open onOpenChange={open => { if (!open) onConfirm(false); }}>
    <AlertDialogContent className={dialog.review ? 'review-dialog' : undefined}
      onCloseAutoFocus={event => {
        if (!dialog.triggerId) return;
        event.preventDefault();
        const trigger = document.getElementById(dialog.triggerId);
        const target = trigger instanceof HTMLButtonElement && !trigger.disabled ? trigger
          : (dialog.returnDialog === 'backups' ? document.getElementById('backup-title') : null)
            ?? document.getElementById('page-title') ?? document.querySelector('main');
        target?.focus({ preventScroll: true });
      }}>
      <AlertDialogTitle className={dialog.locksKeyboard ? 'text-center' : dialog.disconnectTarget ? 'text-balance' : undefined}>{text(dialog.title)}</AlertDialogTitle>
      {dialog.locksKeyboard && <KeyboardLockIllustration />}
      <AlertDialogDescription asChild={dialog.locksKeyboard}
        className={dialog.locksKeyboard ? 'lock-confirmation-copy leading-relaxed' : 'whitespace-pre-wrap leading-relaxed'}>
        {dialog.locksKeyboard
          ? <div>{description.split(/\n\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
          : description}
      </AlertDialogDescription>
      {dialog.review && <details className="confirmation-review text-sm">
        <summary className="min-h-11 cursor-pointer py-2 text-muted-foreground">{t('confirm.reviewDetails')}</summary>
        <ChangeReview review={dialog.review} />
      </details>}
      <div className={dialog.locksKeyboard ? 'flex justify-end gap-3 pt-2' : 'flex justify-end gap-3'}>
        <AlertDialogCancel onClick={() => onConfirm(false)}>{t('common.cancel')}</AlertDialogCancel>
        <AlertDialogAction className={dialog.destructive ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
          onClick={() => onConfirm(true)}>{text(dialog.label)}</AlertDialogAction>
      </div>
    </AlertDialogContent>
  </AlertDialog>;
}
