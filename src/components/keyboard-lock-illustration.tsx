import { Laptop, LockKeyhole } from 'lucide-react';
import { useI18n } from '@/i18n/use-i18n';

function KeyboardWithLock() {
  return <g>
    <g stroke="currentColor" strokeWidth={1.5}>
      <rect x={30} y={42} width={260} height={80} rx={8} />
      <g className="keyboard-lock-keys">
        {[56, 74, 92].flatMap(y => Array.from({ length: 14 }, (_, column) =>
          <rect key={`${y}-${column}`} x={44 + column * 17} y={y} width={12} height={9} rx={2} />,
        ))}
        <path d="M102 110h116" strokeLinecap="round" />
      </g>
    </g>
    <rect x={133} y={54} width={54} height={36} rx={6} fill="var(--background)" />
    <LockKeyhole x={124} y={24} width={72} height={72} strokeWidth={1.2}
      className="keyboard-lock-symbol" aria-hidden="true" />
  </g>;
}

/** Static diagrams of locking and data exchange, not device telemetry. */
export function KeyboardLockIllustration({ variant = 'lock', label }: { variant?: 'lock' | 'transfer'; label?: string }) {
  const { t } = useI18n();
  const transferring = variant === 'transfer';
  return <svg className="keyboard-lock-illustration" data-variant={variant}
    viewBox={transferring ? '0 0 468 156' : '24 22 272 108'} fill="none"
    role="img" aria-label={label ?? t(transferring ? 'operation.transferIllustration' : 'confirm.lockIllustration')} focusable="false">
    {transferring ? <>
      <Laptop x={4} y={6} width={152} height={152} strokeWidth={.3} aria-hidden="true" />
      <g className="keyboard-transfer-arrows" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M166 66h62m-8-8 8 8-8 8" />
        <path d="M228 94h-62m8-8-8 8 8 8" />
      </g>
      <g transform="translate(236 20) scale(.72)"><KeyboardWithLock /></g>
    </> : <KeyboardWithLock />}
  </svg>;
}
