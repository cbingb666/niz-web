import { useRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';
import { useAppStore } from '@/store/context';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from './ui/alert-dialog';

export function OperationOverlay({ operation }: { operation: 'read' | 'write' }) {
  const { t, text } = useI18n();
  const status = useAppStore((state) => state.status);
  const progress = useAppStore((state) => state.progress);
  const content = useRef<HTMLDivElement>(null);
  const transfer = progress?.transfer;
  const percentage = transfer?.total
    ? Math.floor(transfer.completed / transfer.total * 100)
    : null;
  const detail = transfer
    ? transfer.total === null
      ? t('progress.receivedPackets', { completed: transfer.completed })
      : t(transfer.unit === 'packets' ? 'progress.packets' : 'progress.bytes', {
          completed: transfer.completed, total: transfer.total,
        })
    : '';
  return (
    <AlertDialog open>
      <AlertDialogContent
        ref={content}
        className="operation-overlay"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          content.current?.focus();
        }}
      >
        <div className="operation-panel">
          <LoaderCircle className="operation-spinner" aria-hidden="true" />
          <AlertDialogTitle className="operation-title">
            {t(operation === 'read' ? 'operation.readTitle' : 'operation.writeTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription className="operation-description">
            {t('operation.locked')}
          </AlertDialogDescription>
          <p className="operation-status" role="status">{text(status)}</p>
          <div className="operation-progress-label">
            <span>{t('progress.stage')}</span>
            {percentage !== null && <span className="operation-percentage" aria-hidden="true">{percentage}%</span>}
          </div>
          <div
            className="operation-progress"
            role="progressbar"
            aria-label={t('progress.stage')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentage ?? undefined}
            aria-valuetext={[text(status), detail].filter(Boolean).join(' · ')}
          >
            <div
              key={progress?.phase}
              className={`operation-progress-fill${percentage === null ? ' indeterminate' : ''}`}
              style={percentage === null ? undefined : { width: `${percentage}%` }}
            />
          </div>
          {detail && <p className="operation-count">{detail}</p>}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
