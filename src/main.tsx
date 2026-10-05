import { browserLocale, saveBrowserLocale } from './i18n/preferences';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { browserEnvironment, downloadJSON } from './lib/browser';
import { HIDSession } from './hid';
import { BackupStore } from './storage';
import { createAppStore, isLocked } from './store/app-store';
import { bindRouting } from './routing';
import './styles.css';
import { applyTheme, browserTheme } from './lib/theme';

applyTheme(browserTheme());

const environment = browserEnvironment();
const session = new HIDSession(environment.hid);
const store = createAppStore({
  session,
  backups: new BackupStore(),
  download: downloadJSON,
  locale: browserLocale(),
  onLocaleChange: saveBrowserLocale,
});
const element = document.getElementById('root');
if (!element) throw new Error('Missing application root');
const root = createRoot(element);
const routing = bindRouting(store, window);
let stopped = false;
void routing.ready.then(() => {
  if (stopped) return;
  root.render(
    <StrictMode>
      <App store={store} notices={environment.notices} usbAvailable={!!environment.hid} />
    </StrictMode>,
  );
  // The device session is owned by the application, never a component effect.
  void store.getState().actions.start(document.modelContext);
});
const beforeUnload = (event: BeforeUnloadEvent) => {
  const state = store.getState();
  if (isLocked(state) || state.hasUnsavedChanges) {
    event.preventDefault();
    event.returnValue = '';
  }
};
window.addEventListener('beforeunload', beforeUnload);
const stop = () => {
  stopped = true;
  routing.dispose();
  window.removeEventListener('beforeunload', beforeUnload);
  window.removeEventListener('pagehide', stop);
  void store.getState().actions.stop();
};
window.addEventListener('pagehide', stop, { once: true });
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    stop();
    root.unmount();
  });
