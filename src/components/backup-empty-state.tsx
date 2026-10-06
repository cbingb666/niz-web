import { useI18n } from '@/i18n/use-i18n';

export function BackupEmptyState() {
  const { t } = useI18n();

  return <div className="backup-empty">
    <svg className="backup-empty-art" viewBox="0 0 240 160" fill="none" aria-hidden="true" focusable="false">
      <ellipse cx="120" cy="142" rx="88" ry="9" fill="var(--muted)" />
      <rect x="76" y="20" width="88" height="100" rx="10" fill="var(--background)" stroke="currentColor" strokeWidth="2" />
      <path d="M94 42h52M94 55h36" stroke="var(--border)" strokeWidth="4" strokeLinecap="round" />
      <path d="M120 72v28m-10-10 10 10 10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m46 91 15-24h15m88 0h15l15 24" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M46 91h43l9 16h44l9-16h43v39a8 8 0 0 1-8 8H54a8 8 0 0 1-8-8V91Z" fill="var(--muted)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M109 123h22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
    <p>{t('backup.empty')}</p>
  </div>;
}
