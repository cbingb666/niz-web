import { useEffect } from 'react';
import { ArrowRight, CircleHelp } from 'lucide-react';
import { ConnectionPanel } from './components/connection-panel';
import { KeyboardPanel } from './components/keyboard-panel';
import { KeyEditor } from './components/key-editor';
import { AppDialogs } from './components/app-dialogs';
import { LanguageSwitcher } from './components/language-switcher';
import { Button } from './components/ui/button';
import { StoreContext, useAppStore } from './store/context';
import { isLocked, type AppStore } from './store/app-store';
import { useI18n } from './i18n/use-i18n';
import { applyDocumentLocale } from './i18n/preferences';
import type { Message } from './i18n/core';

function CommitBar() {
  const { t, text, count: countText } = useI18n();
  const count = useAppStore((state) => state.changes.length);
  const lights = useAppStore((state) => state.lightsChanged);
  const formDirty = useAppStore((state) => state.formDirty);
  const source = useAppStore((state) => state.source);
  const status = useAppStore((state) => state.status);
  const canWrite = useAppStore((state) => state.canWrite);
  const locked = useAppStore(isLocked);
  const actions = useAppStore((state) => state.actions);
  const details = [
    count ? countText(count, 'changes.records.one', 'changes.records.other') : '',
    lights ? t('changes.rgb') : '',
    formDirty ? t('changes.unsaved') : '',
  ].filter(Boolean);
  return (
    <footer className="commit-bar">
      <div>
        <strong>
          {details.length
            ? t('changes.pending', { details: details.join(' · ') })
            : t(source === 'demo' ? 'changes.demo' : 'changes.none')}
        </strong>
        <p aria-live="polite">{text(status)}</p>
      </div>
      <div className="commit-actions">
        <Button disabled={locked || !canWrite} onClick={actions.write}>
          {t('changes.write')}
          <ArrowRight />
        </Button>
      </div>
    </footer>
  );
}
function Header() {
  const { t } = useI18n();
  const locked = useAppStore(isLocked);
  const showHelp = useAppStore((state) => state.actions.showHelp);
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          N
        </span>
        <div>
          <h1>
            NIZ <span>Web</span>
          </h1>
          <p>{t('app.subtitle')}</p>
        </div>
      </div>
      <div className="header-detail">
        <span className="local-dot" aria-hidden="true" />
        <span>{t('app.localOnly')}</span>
        <LanguageSwitcher />
        <Button variant="ghost" size="icon" aria-label={t('help.open')} disabled={locked} onClick={showHelp}>
          <CircleHelp />
        </Button>
      </div>
    </header>
  );
}
interface AppContentProps {
  notices?: Message[];
  usbAvailable?: boolean;
}
function AppContent({ notices = [], usbAvailable = false }: AppContentProps) {
  const { t, text, locale } = useI18n();
  const operating = useAppStore((state) => state.hardwareOperation !== null);
  useEffect(() => {
    applyDocumentLocale(locale, document);
  }, [locale]);
  return (
    <>
      <div inert={operating} aria-busy={operating}>
        <Header />
        <main>
          <ConnectionPanel usbAvailable={usbAvailable} />
          {notices.length > 0 && (
            <div className="notice" role="status">
              {notices.map(text).join(' ')}
            </div>
          )}
          <section className="workspace" aria-label={t('app.editor')}>
            <KeyboardPanel />
            <KeyEditor />
          </section>
          <CommitBar />
        </main>
      </div>
      <AppDialogs />
    </>
  );
}
export function App({ store, ...props }: AppContentProps & { store: AppStore }) {
  return (
    <StoreContext.Provider value={store}>
      <AppContent {...props} />
    </StoreContext.Provider>
  );
}
