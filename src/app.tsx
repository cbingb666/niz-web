import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { ArrowRight, CircleHelp, LayoutGrid, SlidersHorizontal, Undo2, Redo2 } from 'lucide-react';
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
  return (
    <div className="commit-bar-space">
      <footer ref={bar} className="commit-bar">
        <div className="commit-details">
          <strong>
            {details.length
              ? t('changes.pending', { details: details.join(' · ') })
              : t(source === 'demo' ? 'changes.demo' : 'changes.none')}
          </strong>
          <p className="commit-status" aria-live="polite" title={text(status)}>{text(status)}</p>
          {(drafts.length > 0 || stale || (session.hasLiveBaseline && !canWrite && (count > 0 || lights))) &&
            <p className="commit-warning">{t(drafts.length ? 'mapping.finishDrafts' : 'mapping.unbound')}</p>}
        </div>
        <div className="commit-actions">
          <Button variant="outline" disabled={locked || !canUndo} onClick={actions.undo}><Undo2 />{t('mapping.undo')}</Button>
          <Button variant="outline" disabled={locked || !canRedo} onClick={actions.redo}><Redo2 />{t('mapping.redo')}</Button>
          <Button disabled={locked || !canWrite} onClick={actions.write}>
            {t('changes.write')}
            <ArrowRight />
          </Button>
        </div>
      </footer>
    </div>
  );
}
function Header() {
  const { t } = useI18n();
  const locked = useAppStore(isLocked);
  const showHelp = useAppStore((state) => state.actions.showHelp);
  const connected = useAppStore(state => state.session.connected);
  const otherConnected = useAppStore(state => state.connectedDevices.length > 0);
  const page = useAppStore(state => state.page);
  const profile = useAppStore(state => state.profile);
  const navigate = useAppStore(state => state.actions.navigate);
  const configureDevice = useAppStore(state => state.actions.configureDevice);
  const header = useRef<HTMLElement>(null);
  useChromeHeight(header, '--app-header-height');
  return (
    <header ref={header} className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          N
        </span>
        <div>
          <h1>
            NIZ <span>Web</span>
          </h1>
        </div>
      </div>
      <nav className="page-navigation" aria-label={t('devices.navigation')}>
        <Button variant="ghost" size="sm" disabled={locked} aria-current={page === 'devices' ? 'page' : undefined}
          onClick={() => navigate('devices')}><LayoutGrid />{t('devices.title')}</Button>
        {(profile || connected) && <Button variant="ghost" size="sm" disabled={locked} aria-current={page === 'editor' ? 'page' : undefined}
          onClick={() => profile ? navigate('editor') : configureDevice()}><SlidersHorizontal />{t('devices.editor')}</Button>}
      </nav>
      <div className="header-device">
        {connected ? <ConnectedDevice /> : <span className="disconnected-device"><span className="status-dot" />{t(otherConnected ? 'devices.chooseDevice' : 'connection.waiting')}</span>}
      </div>
      <div className="header-detail">
        <ProfileActions />
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
