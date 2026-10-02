import { defaultModel, supportedModels } from './devices';
import { isRecord } from './protocol';
import { isLocked, type AppPage, type AppState, type AppStore } from './store/app-store';

export type AppRoute = {
  page: AppPage;
  modelId?: string;
  returnPage?: 'connect';
};
export interface RoutingWindow {
  readonly location: Pick<Location, 'hash' | 'replace'>;
  readonly history: Pick<History, 'state' | 'pushState' | 'replaceState' | 'go'>;
  addEventListener(type: 'popstate' | 'hashchange', listener: () => void): void;
  removeEventListener(type: 'popstate' | 'hashchange', listener: () => void): void;
}

const modelExists = (id: string | null): id is string => supportedModels.some(model => model.id === id);

export function parseRoute(hash: string): AppRoute {
  try {
    const [path, query = ''] = (hash.startsWith('#') ? hash.slice(1) : hash).split('?');
    if (path === '/devices' || path === '/connect' || path === '/editor')
      return { page: path.slice(1) as 'devices' | 'connect' | 'editor' };
    if (path === '/demo') {
      const params = new URLSearchParams(query), modelId = params.get('model');
      return {
        page: 'demo',
        ...(modelExists(modelId) ? { modelId } : {}),
        ...(params.get('from') === 'connect' ? { returnPage: 'connect' as const } : {}),
      };
    }
    if (path.startsWith('/demo/')) {
      const modelId = decodeURIComponent(path.slice('/demo/'.length));
      if (modelExists(modelId)) return { page: 'editor', modelId };
    }
  } catch { /* Invalid encoded routes return to the safe device page. */ }
  return { page: 'devices' };
}

export function routeHash(route: AppRoute) {
  if (route.page === 'editor' && route.modelId) return `#/demo/${encodeURIComponent(route.modelId)}`;
  if (route.page === 'demo') {
    const params = new URLSearchParams();
    if (route.modelId) params.set('model', route.modelId);
    if (route.returnPage) params.set('from', route.returnPage);
    const query = params.toString();
    return `#/demo${query ? `?${query}` : ''}`;
  }
  return `#/${route.page}`;
}

export function currentRoute(state: AppState): AppRoute {
  if (state.page === 'editor' && state.source === 'demo' && modelExists(state.model.id))
    return { page: 'editor', modelId: state.model.id };
  if (state.page === 'demo') return {
    page: 'demo',
    modelId: modelExists(state.demoModelId) ? state.demoModelId
      : modelExists(state.model.id) ? state.model.id : defaultModel.id,
    ...(state.demoReturnPage === 'connect' ? { returnPage: 'connect' as const } : {}),
  };
  return { page: state.page };
}

function entryIndex(state: unknown) {
  if (!isRecord(state)) return null;
  const index = state.nizWebNavigation;
  return typeof index === 'number' && Number.isSafeInteger(index) && index >= 0 ? index : null;
}

/** Same-document routing only. URLs never carry profiles or hardware permission. */
export function bindRouting(store: AppStore, browser: RoutingWindow) {
  let index = entryIndex(browser.history.state) ?? 0;
  let committedHash = browser.location.hash;
  let applying = true;
  let stopped = false;
  let pendingHash: string | null = null;
  let restoring = false;
  let restoringFrom: number | null = null;

  function write(hash: string, replace: boolean) {
    if (!replace) index++;
    const previous: unknown = browser.history.state;
    const state = { ...(isRecord(previous) ? previous : {}), nizWebNavigation: index };
    committedHash = hash;
    try {
      browser.history[replace ? 'replaceState' : 'pushState'](state, '', hash);
    } catch (cause) {
      if (!isRecord(cause) || cause.name !== 'SecurityError') throw cause;
      // Opaque file origins may reject a URL argument to the History API.
      // Change only the fragment, then tag that same-document entry without a URL.
      if (browser.location.hash !== hash) {
        if (replace) browser.location.replace(hash);
        else browser.location.hash = hash;
      }
      browser.history.replaceState(state, '');
    }
  }
  function restore(targetIndex: number | null) {
    committedHash = routeHash(currentRoute(store.getState()));
    if (targetIndex !== null && targetIndex !== index) {
      restoring = true;
      restoringFrom = targetIndex;
      browser.history.go(index - targetIndex);
    } else {
      restoring = false;
      write(committedHash, true);
    }
  }
  async function apply(route: AppRoute, fromHistory: boolean) {
    const { actions } = store.getState();
    if (route.page === 'editor' && route.modelId) {
      const state = store.getState();
      if (state.source === 'demo' && state.profile?.model.id === route.modelId)
        await actions.navigate('editor', { fromHistory });
      else await actions.demo(route.modelId);
    } else {
      await actions.navigate(route.page, { fromHistory });
      if (route.page === 'demo' && store.getState().page === 'demo' && !isLocked(store.getState())) {
        if (route.modelId) actions.setDemoModel(route.modelId);
        store.setState({ demoReturnPage: route.returnPage ?? 'devices' });
      }
    }
    const state = store.getState();
    return state.page === route.page && (route.page !== 'editor' || !route.modelId ||
      state.source === 'demo' && state.profile?.model.id === route.modelId);
  }
  async function changed() {
    if (stopped) return;
    const targetIndex = entryIndex(browser.history.state), hash = browser.location.hash;
    if (restoring) {
      if (targetIndex === index) {
        restoring = false;
        write(committedHash, true);
      } else if (targetIndex !== restoringFrom) restore(targetIndex);
      return;
    }
    if (pendingHash === hash) return; // popstate and hashchange describe the same traversal.
    if (pendingHash !== null) {
      const dialog = store.getState().dialog;
      if (dialog?.kind === 'confirm' && !dialog.locksKeyboard) store.getState().actions.confirm(false);
      restore(targetIndex);
      return;
    }
    if (hash === committedHash) {
      index = targetIndex ?? index;
      write(committedHash, true);
      return;
    }
    if (isLocked(store.getState()) || store.getState().dialog) {
      restore(targetIndex);
      return;
    }
    pendingHash = hash;
    applying = true;
    const accepted = await apply(parseRoute(hash), true);
    applying = false;
    pendingHash = null;
    if (stopped) return;
    if (!accepted || browser.location.hash !== hash) {
      if (!restoring) restore(entryIndex(browser.history.state));
      return;
    }
    index = targetIndex ?? index + 1;
    write(routeHash(currentRoute(store.getState())), true);
  }
  const listener = () => { void changed(); };
  const unsubscribe = store.subscribe((state, previous) => {
    if (stopped || applying) return;
    const hash = routeHash(currentRoute(state));
    if (hash !== committedHash) write(hash, state.page === 'demo' && previous.page === 'demo');
  });
  browser.addEventListener('popstate', listener);
  browser.addEventListener('hashchange', listener);
  const ready = apply(parseRoute(browser.location.hash), false).then(() => {
    if (stopped) return;
    applying = false;
    write(routeHash(currentRoute(store.getState())), true);
  });
  return {
    ready,
    dispose() {
      stopped = true;
      unsubscribe();
      browser.removeEventListener('popstate', listener);
      browser.removeEventListener('hashchange', listener);
    },
  };
}
