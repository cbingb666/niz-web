import { useRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';
import { useAppStore } from '@/store/context';
import { KeyboardLockIllustration } from './keyboard-lock-illustration';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from './ui/alert-dialog';

export function OperationOverlay({ operation }: { operation: 'read' | 'write' }) {
  const { t, text } = useI18n();
  const status = useAppStore(state => state.status);
  const progress = useAppStore(state => state.progress);
  const content = useRef<HTMLDivElement>(null);
  const transfer = progress?.transfer;
  const percentage = transfer?.total
    ? Math.floor(transfer.completed / transfer.total * 100)
    : null;
  return <AlertDialog open>
    <AlertDialogContent
      ref={content}
      className="operation-overlay"
      onEscapeKeyDown={event => event.preventDefault()}
      onOpenAutoFocus={event => {
        event.preventDefault();
        content.current?.focus();
      }}
    >
      <AlertDialogTitle className="sr-only">
        {t(operation === 'read' ? 'operation.readTitle' : 'operation.writeTitle')}
      </AlertDialogTitle>
      <div className="operation-status-row">
        {percentage === null && <LoaderCircle className="operation-spinner" aria-hidden="true" />}
        <p className="text-lg font-semibold" role="status">{text(status)}</p>
      </div>
      <KeyboardLockIllustration variant="transfer" />
      <div className={percentage === null ? 'sr-only' : 'operation-meter'}>
        <div
          className="operation-progress"
          role="progressbar"
          aria-label={t('progress.stage')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage ?? undefined}
          aria-valuetext={text(status)}
        >
          {percentage !== null && <div key={progress?.phase} className="operation-progress-fill" style={{ width: `${percentage}%` }} />}
        </div>
        {percentage !== null && <span className="operation-percentage" aria-hidden="true">{percentage}%</span>}
      </div>
      <AlertDialogDescription className="whitespace-pre-line text-center leading-relaxed">{t('operation.locked')}</AlertDialogDescription>
    </AlertDialogContent>
  </AlertDialog>;
}
