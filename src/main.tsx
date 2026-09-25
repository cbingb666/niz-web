import { browserLocale, saveBrowserLocale } from './i18n/preferences';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { browserEnvironment, downloadJSON } from './lib/browser';
import { HIDSession } from './hid';
import { BackupStore } from './storage';
import { createAppStore, isLocked } from './store/app-store';
import './styles.css';

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
root.render(
  <StrictMode>
    <App store={store} notices={environment.notices} usbAvailable={!!environment.hid} />
  </StrictMode>,
);
// The device session is owned by the application, never a component effect.
void store.getState().actions.start(document.modelContext);
const beforeUnload = (event: BeforeUnloadEvent) => {
  const state = store.getState();
  if (isLocked(state) || state.formDirty || state.changes.length || state.lightsChanged) {
    event.preventDefault();
    event.returnValue = '';
  }
};
window.addEventListener('beforeunload', beforeUnload);
const stop = () => {
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
