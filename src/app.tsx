import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { ArrowRight, ChevronRight, CircleHelp, Undo2, Redo2 } from 'lucide-react';
import { ConnectionPanel } from './components/connection-panel';
import { DeviceManager } from './components/device-manager';
import { ConnectionGuide } from './components/connection-guide';
import { KeyboardPanel } from './components/keyboard-panel';
import { KeyEditor } from './components/key-editor';
import { AppDialogs } from './components/app-dialogs';
import { LanguageSwitcher } from './components/language-switcher';
import { ProfileActions } from './components/profile-actions';
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
  const { t, text } = useI18n();
  const count = useAppStore((state) => state.changes.length);
  const lights = useAppStore((state) => state.lightsChanged);
  const drafts = useAppStore((state) => state.draftIndices);
  const changes = useAppStore((state) => state.changes);
  const model = useAppStore((state) => state.model);
  const session = useAppStore((state) => state.session);
  const otherConnected = useAppStore(state => state.connectedDevices.length > 0);
  const stale = useAppStore((state) => state.stale);
  const canUndo = useAppStore((state) => state.canUndo);
  const canRedo = useAppStore((state) => state.canRedo);
  const source = useAppStore((state) => state.source);
  const status = useAppStore((state) => state.status);
  const canWrite = useAppStore((state) => state.canWrite);
  const locked = useAppStore(isLocked);
  const actions = useAppStore((state) => state.actions);
  const bar = useRef<HTMLElement>(null);
  useChromeHeight(bar, '--commit-bar-height');
  const details = [
    count ? t('mapping.changeCount', { keys: new Set(changes.map(index => index % model.keyCount)).size, records: count }) : '',
    lights ? t('changes.rgb') : '',
    drafts.length ? t('mapping.drafts', { count: drafts.length }) : '',
  ].filter(Boolean);
  const summary = details.length
    ? t('changes.pending', { details: details.join(' · ') })
    : source === 'demo' ? t('changes.demo') : '';
  const warning = drafts.length > 0 || stale || (session.hasLiveBaseline && !canWrite && (count > 0 || lights))
    ? t(drafts.length ? 'mapping.finishDrafts' : 'mapping.unbound') : '';
  const backupStatus = typeof status !== 'string' && 'key' in status && status.key === 'status.readReady'
    ? status.params?.backup : undefined;
  const statusText = typeof backupStatus === 'object' && 'key' in backupStatus && backupStatus.key === 'status.backupSaved'
    ? '' : text(status);
  return (
    <div className="commit-bar-space">
      <footer ref={bar} className="commit-bar">
        <div className="commit-tools">
          <div className="commit-device">
            {session.connected ? <ConnectedDevice /> : <span className="disconnected-device"><span className="status-dot" />{t(otherConnected ? 'devices.chooseDevice' : 'connection.waiting')}</span>}
          </div>
          <ProfileActions />
        </div>
        <div className="commit-details" data-pending={details.length > 0} data-warning={Boolean(warning)}>
          <div className="commit-summary" title={summary}><strong>{summary}</strong></div>
          <p className="commit-status" aria-live="polite" title={statusText}>{statusText}</p>
          {warning && <p className="commit-warning" title={warning}>{warning}</p>}
        </div>
        <div className="commit-actions">
          <div className="commit-history">
            <Button variant="ghost" size="icon" title={t('mapping.undo')} disabled={locked || !canUndo} onClick={actions.undo}><Undo2 /><span className="sr-only">{t('mapping.undo')}</span></Button>
            <Button variant="ghost" size="icon" title={t('mapping.redo')} disabled={locked || !canRedo} onClick={actions.redo}><Redo2 /><span className="sr-only">{t('mapping.redo')}</span></Button>
          </div>
          <Button className="commit-write" disabled={locked || !canWrite} onClick={actions.write}>
            {t('changes.write')}
            <ArrowRight />
          </Button>
        </div>
      </footer>
    </div>
  );
}
function Header() {
  const { t, text } = useI18n();
  const locked = useAppStore(isLocked);
  const showHelp = useAppStore((state) => state.actions.showHelp);
  const page = useAppStore(state => state.page);
  const navigate = useAppStore(state => state.actions.navigate);
  const session = useAppStore(state => state.session);
  const devices = useAppStore(state => state.connectedDevices);
  const model = useAppStore(state => state.model);
  const source = useAppStore(state => state.source);
  const currentDevice = devices.find(device => device.id === session.id);
  const currentPage = page === 'connect' ? t('guide.title')
    : source === 'demo' ? `${model.name} · ${t('keyboard.demo')}`
    : currentDevice ? text(deviceName(currentDevice, devices)) : session.product || model.name;
  const header = useRef<HTMLElement>(null);
  useChromeHeight(header, '--app-header-height');
  return (
    <header ref={header} className="app-header">
      <div className="brand">
        <h1>NIZ Web</h1>
      </div>
      <nav className="page-navigation" aria-label={t('devices.navigation')}>
        <ol>
          <li>{page === 'devices' ? <span aria-current="page">{t('devices.title')}</span>
            : <Button variant="ghost" size="sm" disabled={locked} onClick={() => navigate('devices')}>{t('devices.title')}</Button>}</li>
          {page !== 'devices' && <li className="breadcrumb-current">
            <ChevronRight aria-hidden="true" /><span aria-current="page" title={currentPage}>{currentPage}</span>
          </li>}
        </ol>
      </nav>
      <div className="header-detail">
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
  const [compactChanges, setCompactChanges] = useState(() => window.matchMedia?.('(max-width: 1599px)').matches ?? false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [changesPreference, setChangesPreference] = useState<boolean | null>(null);
  const page = useAppStore(state => state.page);
  const main = useRef<HTMLElement>(null);
  const previousPage = useRef(page);
  const changesCollapsed = changesPreference ?? compactChanges;
  const operating = useAppStore((state) => state.hardwareOperation !== null);
  const dialogOpen = useAppStore(state => state.dialog !== null);
  const editorKey = useAppStore(state => `${state.session.id}:${state.generation}:${state.layer}:${state.key}`);
  const unsaved = useAppStore(state => state.hasUnsavedChanges);
  useEffect(() => {
    if (previousPage.current === page) return;
    previousPage.current = page;
    (document.getElementById('page-title') ?? main.current)?.focus({ preventScroll: true });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [page]);
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 900px)');
    const changesMedia = window.matchMedia?.('(max-width: 1599px)');
    const update = () => { setNarrow(media?.matches ?? false); setEditorOpen(false); };
    const updateChanges = () => setCompactChanges(changesMedia?.matches ?? false);
    media?.addEventListener('change', update);
    changesMedia?.addEventListener('change', updateChanges);
    return () => {
      media?.removeEventListener('change', update);
      changesMedia?.removeEventListener('change', updateChanges);
    };
  }, []);
  useEffect(() => {
    applyDocumentLocale(locale, document);
  }, [locale]);
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);
  return (
    <>
      <div className="app-shell" data-page={page} data-changes-collapsed={changesCollapsed || compactChanges} inert={operating} aria-busy={operating}>
        <Header />
        <main ref={main} tabIndex={-1}>
          {page === 'editor' && !compactChanges && <PendingChanges collapsed={changesCollapsed} onToggle={() => setChangesPreference(true)} />}
          {page === 'editor' && <ConnectionPanel />}
          {notices.length > 0 && (
            <div className="notice" role="status">
              {notices.map(text).join(' ')}
            </div>
          )}
          {page === 'devices' && <DeviceManager />}
          {page === 'connect' && <ConnectionGuide usbAvailable={usbAvailable} />}
          {page === 'editor' && <section className="workspace" aria-label={t('app.editor')}>
            <KeyboardPanel onEdit={() => { if (narrow) setEditorOpen(true); }}
              changesExpanded={!changesCollapsed}
              onShowChanges={changesCollapsed || compactChanges ? () => setChangesPreference(false) : undefined} />
          </section>}
        </main>
        {page === 'editor' && !narrow && <div className="editor-pane"><KeyEditor key={editorKey} /></div>}
        {page === 'editor' && <CommitBar />}
      </div>
      {page === 'editor' && compactChanges && <Dialog open={!changesCollapsed && !operating} onOpenChange={open => setChangesPreference(!open)}>
        <DialogContent className="changes-drawer" closeLabel={t('common.close')} aria-describedby={undefined}
          onCloseAutoFocus={event => {
            event.preventDefault();
            if (!editorOpen && !dialogOpen) document.getElementById('changes-trigger')?.focus({ preventScroll: true });
          }}>
          <DialogTitle className="sr-only">{t('mapping.reviewTitle')}</DialogTitle>
          <PendingChanges collapsed={false} onToggle={() => setChangesPreference(true)}
            onEdit={() => { setChangesPreference(true); if (narrow) setEditorOpen(true); }}
            onReview={() => setChangesPreference(true)} />
        </DialogContent>
      </Dialog>}
      {page === 'editor' && narrow && <Dialog open={editorOpen && !operating} onOpenChange={setEditorOpen}>
        <DialogContent className="editor-drawer" closeLabel={t('common.close')} aria-describedby={undefined}
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
