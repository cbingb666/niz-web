import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { ArrowRight, BookOpen, Cable, ChevronRight, CircleHelp, Undo2, Redo2 } from 'lucide-react';
import { ConnectionPanel } from './components/connection-panel';
import { DeviceManager } from './components/device-manager';
import { ConnectionGuide } from './components/connection-guide';
import { DemoPicker } from './components/demo-picker';
import { KeyboardPanel } from './components/keyboard-panel';
import { KeyEditor } from './components/key-editor';
import { AppDialogs } from './components/app-dialogs';
import { LanguageSwitcher } from './components/language-switcher';
import { ThemeSwitcher } from './components/theme-switcher';
import { ProfileActions, ProfileUtilities } from './components/profile-actions';
import { ConnectedDevice } from './components/connected-device';
import { PendingChanges } from './components/change-review';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogTitle } from './components/ui/dialog';
import { StoreContext, useAppStore } from './store/context';
import { isLocked, type AppStore } from './store/app-store';
import { useI18n } from './i18n/use-i18n';
import { deviceName } from './i18n/device';
import { applyDocumentLocale } from './i18n/preferences';
import type { Message } from './i18n/core';

function useChromeHeight(ref: RefObject<HTMLElement | null>, property: string) {
  useLayoutEffect(() => {
    const element = ref.current;
    const shell = element?.closest<HTMLElement>('.app-shell');
    if (!element || !shell) return;
    const measure = () => {
      const height = element.getBoundingClientRect().height;
      if (height > 0) shell.style.setProperty(property, `${Math.ceil(height)}px`);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [ref, property]);
}

function CommitBar() {
  const { t } = useI18n();
  const session = useAppStore((state) => state.session);
  const otherConnected = useAppStore(state => state.connectedDevices.length > 0);
  const canUndo = useAppStore((state) => state.canUndo);
  const canRedo = useAppStore((state) => state.canRedo);
  const profile = useAppStore((state) => state.profile);
  const canWrite = useAppStore((state) => state.canWrite);
  const locked = useAppStore(isLocked);
  const actions = useAppStore((state) => state.actions);
  const bar = useRef<HTMLElement>(null);
  useChromeHeight(bar, '--commit-bar-height');
  return (
    <div className="commit-bar-space">
      <footer ref={bar} className="commit-bar">
        <div className="commit-toolbar">
          <div className="commit-tools">
            <div className="commit-device">
              {session.connected ? <ConnectedDevice /> : profile ? <Button className="disconnected-device" variant="ghost" disabled={locked}
                aria-label={t(otherConnected ? 'devices.chooseDevice' : 'guide.title')}
                onClick={() => actions.navigate(otherConnected ? 'devices' : 'connect')}><Cable />{t(otherConnected ? 'devices.title' : 'common.connect')}</Button>
                : null}
            </div>
            <ProfileUtilities />
          </div>
          <div className="commit-actions">
            <div className="commit-history">
              <Button variant="ghost" size="icon" title={t('mapping.undo')} disabled={locked || !canUndo} onClick={actions.undo}><Undo2 /><span className="sr-only">{t('mapping.undo')}</span></Button>
              <Button variant="ghost" size="icon" title={t('mapping.redo')} disabled={locked || !canRedo} onClick={actions.redo}><Redo2 /><span className="sr-only">{t('mapping.redo')}</span></Button>
            </div>
            <ProfileActions />
            <Button className="commit-write" disabled={locked || !canWrite} onClick={actions.write}>
              {t('changes.write')}
              <ArrowRight />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
function Header() {
  const { t, text } = useI18n();
  const locked = useAppStore(isLocked);
  const showHelp = useAppStore((state) => state.actions.showHelp);
  const showManuals = useAppStore((state) => state.actions.showManuals);
  const page = useAppStore(state => state.page);
  const navigate = useAppStore(state => state.actions.navigate);
  const session = useAppStore(state => state.session);
  const devices = useAppStore(state => state.connectedDevices);
  const model = useAppStore(state => state.model);
  const source = useAppStore(state => state.source);
  const currentDevice = devices.find(device => device.id === session.id);
  const currentPage = page === 'connect' ? t('guide.title')
    : page === 'demo' ? t('keyboard.demo')
    : source === 'demo' ? `${model.name} · ${t('keyboard.demo')}`
    : currentDevice ? text(deviceName(currentDevice, devices)) : session.product || model.name;
  const header = useRef<HTMLElement>(null);
  useChromeHeight(header, '--app-header-height');
  return (
    <header ref={header} className="app-header">
      <div className="brand">
        <h1>NIZ Web</h1>
      </div>
      {page !== 'devices' && <nav className="page-navigation" aria-label={t('devices.navigation')}>
        <ol>
          <li><Button variant="ghost" size="sm" disabled={locked} onClick={() => navigate('devices')}>{t('devices.title')}</Button></li>
          <li className="breadcrumb-current">
            <ChevronRight aria-hidden="true" /><span aria-current="page" title={currentPage}>{currentPage}</span>
          </li>
        </ol>
      </nav>}
      <div className="header-detail">
        <Button id="manuals-trigger" variant="ghost" size="icon" className="text-muted-foreground"
          aria-label={t('manual.open')} title={t('manual.open')} disabled={locked} onClick={showManuals}>
          <BookOpen aria-hidden="true" />
        </Button>
        <ThemeSwitcher />
        <LanguageSwitcher />
        <Button variant="ghost" size="icon" aria-label={t('help.open')} disabled={locked} onClick={showHelp}>
          <CircleHelp />
        </Button>
        <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
          <a href="https://github.com/cbingb666/niz-web" target="_blank" rel="noopener noreferrer"
            aria-label={t('app.github')} title={t('app.github')}>
            {/* GitHub mark: https://github.com/primer/octicons (MIT). */}
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656" />
            </svg>
          </a>
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
  const [narrow, setNarrow] = useState(() => window.matchMedia?.('(max-width: 900px)').matches ?? false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const returnToEditor = useRef(false);
  const page = useAppStore(state => state.page);
  const demoReturnPage = useAppStore(state => state.demoReturnPage);
  const main = useRef<HTMLElement>(null);
  const previousPage = useRef(page);
  const operating = useAppStore((state) => state.hardwareOperation !== null);
  const dialogOpen = useAppStore(state => state.dialog !== null);
  const editorKey = useAppStore(state => `${state.session.id}:${state.generation}:${state.layer}:${state.key}`);
  const unsaved = useAppStore(state => state.hasUnsavedChanges);
  const storeWrite = useAppStore(state => state.actions.write);
  useEffect(() => {
    if (previousPage.current === page) return;
    previousPage.current = page;
    (document.getElementById('page-title') ?? main.current)?.focus({ preventScroll: true });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [page]);
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 900px)');
    const update = () => { setNarrow(media?.matches ?? false); setEditorOpen(false); };
    media?.addEventListener('change', update);
    return () => {
      media?.removeEventListener('change', update);
    };
  }, []);
  useEffect(() => {
    applyDocumentLocale(locale, document);
  }, [locale]);
  useEffect(() => {
    if (!unsaved && !operating) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved, operating]);
  return (
    <>
      <div className="app-shell" data-page={page} inert={operating} aria-busy={operating}>
        <Header />
        <main ref={main} tabIndex={-1}>
          {page === 'editor' && <ConnectionPanel />}
          {notices.length > 0 && (
            <div className="notice" role="status">
              {notices.map(text).join(' ')}
            </div>
          )}
          {page === 'devices' && <DeviceManager />}
          {(page === 'connect' || page === 'demo' && demoReturnPage === 'connect') &&
            <ConnectionGuide usbAvailable={usbAvailable} active={page === 'connect'} />}
          {page === 'demo' && <DemoPicker />}
          {page === 'editor' && <section className="workspace" aria-label={t('app.editor')}>
            <KeyboardPanel onEdit={() => { if (narrow) setEditorOpen(true); }}
              changesExpanded={changesOpen}
              onShowChanges={() => { returnToEditor.current = false; setChangesOpen(true); }} />
          </section>}
        </main>
        {page === 'editor' && !narrow && <div className="editor-pane"><KeyEditor key={editorKey} /></div>}
        {page === 'editor' && <CommitBar />}
      </div>
      {page === 'editor' && <Dialog open={changesOpen && !operating} onOpenChange={setChangesOpen}>
        <DialogContent id="pending-changes" className="pending-changes-dialog" closeLabel={t('common.close')}
          onOpenAutoFocus={event => {
            event.preventDefault();
            document.getElementById('pending-changes')?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={event => {
            event.preventDefault();
            if (!editorOpen && !dialogOpen) {
              const target = returnToEditor.current
                ? document.querySelector<HTMLElement>('.editor-pane .inspector-header')
                : document.getElementById('changes-trigger');
              target?.focus({ preventScroll: true });
            }
          }}>
          <PendingChanges
            onEdit={() => { returnToEditor.current = true; setChangesOpen(false); if (narrow) setEditorOpen(true); }}
            onClose={() => setChangesOpen(false)}
            onWrite={() => { setChangesOpen(false); void storeWrite(); }} />
        </DialogContent>
      </Dialog>}
      {page === 'editor' && narrow && <Dialog open={editorOpen && !operating} onOpenChange={setEditorOpen}>
        <DialogContent className="editor-drawer" closeLabel={t('common.close')} aria-describedby={undefined}
          onEscapeKeyDown={event => {
            // Radix handles Escape at document capture, before the editor's key handlers.
            if (event.target instanceof Element && event.target.closest('[data-editor-escape="true"]')) event.preventDefault();
          }}
          onCloseAutoFocus={event => {
            event.preventDefault();
            document.querySelector<HTMLButtonElement>('.keyboard .key-layer[aria-pressed="true"]')?.focus({ preventScroll: true });
          }}>
          <DialogTitle className="sr-only">{t('editor.section')}</DialogTitle>
          <KeyEditor key={editorKey} />
        </DialogContent>
      </Dialog>}
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
