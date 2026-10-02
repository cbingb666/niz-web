import { expect, onTestFinished, test, vi } from 'vitest';
import { bindRouting, parseRoute, routeHash, type RoutingWindow } from '../src/routing';
import { FakeDevice, FakeHID } from './helpers';
import { application, memoryBackups } from './store-helpers';

class HistoryBrowser extends EventTarget implements RoutingWindow {
  location: RoutingWindow['location'];
  entries: { hash: string; state: unknown }[];
  position = 0;
  history: RoutingWindow['history'];
  constructor(hash = '') {
    super();
    this.location = { hash, replace: url => this.history.replaceState(null, '', url) };
    this.entries = [{ hash, state: null }];
    const currentEntry = () => this.entries[this.position];
    this.history = {
      get state() { return currentEntry().state; },
      pushState: (state: unknown, _unused: string, url?: string | URL | null) => {
        const hash = String(url ?? this.location.hash);
        this.entries.splice(this.position + 1);
        this.entries.push({ state, hash });
        this.position++;
        this.location.hash = hash;
      },
      replaceState: (state: unknown, _unused: string, url?: string | URL | null) => {
        const hash = String(url ?? this.location.hash);
        this.entries[this.position] = { state, hash };
        this.location.hash = hash;
      },
      go: (delta = 0) => {
        const position = this.position + delta;
        if (position < 0 || position >= this.entries.length) return;
        this.position = position;
        this.location.hash = this.entries[position].hash;
        this.dispatchEvent(new Event('popstate'));
        this.dispatchEvent(new Event('hashchange'));
      },
    };
  }
  openHash(hash: string) {
    this.history.pushState(null, '', hash);
    this.dispatchEvent(new Event('hashchange'));
  }
}

async function settleRouting() { await new Promise<void>(resolve => setImmediate(resolve)); }

test('routes accept only known pages and production demo models', () => {
  expect(parseRoute('#/connect')).toEqual({ page: 'connect' });
  expect(parseRoute('#/demo?model=atom68&from=connect')).toEqual({ page: 'demo', modelId: 'atom68', returnPage: 'connect' });
  expect(parseRoute('#/demo/atom68')).toEqual({ page: 'editor', modelId: 'atom68' });
  expect(parseRoute('#/demo?model=test-68')).toEqual({ page: 'demo' });
  for (const hash of ['', '#/unknown', '#/demo/pro', '#/demo/%', '#https://example.com/', '#/demo/test-68'])
    expect(parseRoute(hash)).toEqual({ page: 'devices' });
  expect(routeHash({ page: 'demo', modelId: 'atom68', returnPage: 'connect' })).toBe('#/demo?model=atom68&from=connect');
});

test.each([{ modelId: 'atom66', records: 198 }, { modelId: 'atom68', records: 204 },
  { modelId: 'micro82', records: 246 }, { modelId: 'micro84', records: 252 }])('a fresh demo link restores the $modelId offline editor without hardware access', async ({ modelId, records }) => {
  const hid = new FakeHID(), { store } = application(hid);
  const browser = new HistoryBrowser(`#/demo/${modelId}`), routing = bindRouting(store, browser);
  onTestFinished(routing.dispose);
  await routing.ready;
  expect(store.getState()).toMatchObject({ page: 'editor', source: 'demo', canWrite: false, model: { id: modelId } });
  expect(store.getState().profile?.records.length).toBe(records);
  expect(hid.requestCount).toBe(0);
  expect(hid.getCount).toBe(0);
});

test('navigation records pages while model selection replaces the chooser entry', async () => {
  const { store, actions } = application(), browser = new HistoryBrowser();
  const routing = bindRouting(store, browser);
  onTestFinished(routing.dispose);
  await routing.ready;
  await actions.navigate('connect');
  await actions.navigate('demo');
  const length = browser.entries.length;
  actions.setDemoModel('atom68');
  expect(browser.entries).toHaveLength(length);
  expect(browser.location.hash).toBe('#/demo?model=atom68&from=connect');
  await actions.demo('atom68');
  expect(browser.location.hash).toBe('#/demo/atom68');
  browser.history.go(-1);
  await settleRouting();
  expect(store.getState()).toMatchObject({ page: 'demo', demoModelId: 'atom68', demoReturnPage: 'connect' });
  browser.history.go(-1);
  await settleRouting();
  expect(store.getState().page).toBe('connect');
  browser.history.go(1);
  await settleRouting();
  expect(store.getState().page).toBe('demo');
  browser.history.go(1);
  await settleRouting();
  expect(store.getState().page).toBe('editor');
  expect(browser.location.hash).toBe('#/demo/atom68');
});

test('cancelling Back keeps edits, drafts and the history cursor, and permits a later Back and Forward', async () => {
  const { store, actions } = application(), browser = new HistoryBrowser();
  const routing = bindRouting(store, browser);
  onTestFinished(routing.dispose);
  await routing.ready;
  await actions.navigate('demo');
  await actions.demo('atom68');
  actions.assignKey(58);
  actions.updateForm({ sequence: 'unfinished macro', view: 'advanced' });
  const before = store.getState(), cursor = browser.position, length = browser.entries.length;
  browser.history.go(-1);
  expect(store.getState().dialog).toMatchObject({ kind: 'confirm' });
  actions.confirm(false);
  await settleRouting();
  expect(browser.position).toBe(cursor);
  expect(browser.entries).toHaveLength(length);
  expect(browser.location.hash).toBe('#/demo/atom68');
  expect(store.getState().profile?.toJSON()).toEqual(before.profile?.toJSON());
  expect(store.getState().drafts).toEqual(before.drafts);
  browser.history.go(-1);
  actions.confirm(true);
  await settleRouting();
  expect(store.getState().page).toBe('demo');
  browser.history.go(1);
  await settleRouting();
  expect(store.getState().profile?.toJSON()).toEqual(before.profile?.toJSON());
  expect(store.getState().drafts).toEqual(before.drafts);
  expect(store.getState().canUndo).toBe(true);
});

test('history between chooser entries restores both the model and the return page', async () => {
  const { store, actions } = application(), browser = new HistoryBrowser();
  const routing = bindRouting(store, browser);
  onTestFinished(routing.dispose);
  await routing.ready;
  await actions.navigate('demo');
  await actions.navigate('connect');
  await actions.navigate('demo');
  actions.setDemoModel('atom68');
  browser.history.go(-2);
  await settleRouting();
  expect(store.getState()).toMatchObject({ page: 'demo', demoModelId: 'atom66', demoReturnPage: 'devices' });
  browser.history.go(2);
  await settleRouting();
  expect(store.getState()).toMatchObject({ page: 'demo', demoModelId: 'atom68', demoReturnPage: 'connect' });
});

test('editing a different demo URL requires replacement consent and rejects invalid routes safely', async () => {
  const { store, actions } = application(), browser = new HistoryBrowser('#/demo/atom66');
  const routing = bindRouting(store, browser);
  onTestFinished(routing.dispose);
  await routing.ready;
  actions.updateForm({ sequence: 'unfinished' });
  browser.openHash('#/demo/atom68');
  expect(store.getState().dialog?.kind).toBe('confirm');
  actions.confirm(false);
  await settleRouting();
  expect(store.getState().model.id).toBe('atom66');
  expect(store.getState().form.sequence).toBe('unfinished');
  expect(browser.location.hash).toBe('#/demo/atom66');
  browser.openHash('#/demo/atom68');
  actions.confirm(true);
  await settleRouting();
  expect(store.getState().model.id).toBe('atom68');
  browser.openHash('#/unsupported');
  await settleRouting();
  expect(store.getState().page).toBe('devices');
  expect(browser.location.hash).toBe('#/devices');
});

test('URL changes cannot authorize or read devices, and hardware confirmation and read locks resist Back', async () => {
  const device = new FakeDevice(), hid = new FakeHID([device]), backups = memoryBackups();
  const { store, actions } = application(hid, backups), browser = new HistoryBrowser('#/connect');
  const routing = bindRouting(store, browser);
  onTestFinished(routing.dispose);
  await routing.ready;
  await actions.start();
  expect(device.sent.map(packet => packet[1])).toEqual([0xf9]);
  await actions.navigate('editor');
  const reading = actions.read(), index = browser.position;
  browser.history.go(-1);
  expect(browser.position).toBe(index);
  expect(store.getState().dialog).toMatchObject({ kind: 'confirm', locksKeyboard: true });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  onTestFinished(release);
  const persist = vi.mocked(backups.save).getMockImplementation()!;
  vi.mocked(backups.save).mockImplementationOnce(async (...args) => { await gate; return persist(...args); });
  actions.confirm(true);
  await vi.waitFor(() => expect(store.getState().progress?.phase).toBe('backup'));
  browser.history.go(-1);
  expect(browser.position).toBe(index);
  expect(store.getState().hardwareOperation).toBe('read');
  expect(browser.location.hash).toBe('#/editor');
  release();
  await reading;
  expect(hid.requestCount).toBe(0);
});

test('an empty editor deep link returns to Devices, and disposing routing releases all listeners', async () => {
  const { store, actions } = application(), browser = new HistoryBrowser('#/editor');
  const routing = bindRouting(store, browser);
  await routing.ready;
  expect(browser.location.hash).toBe('#/devices');
  routing.dispose();
  await actions.navigate('connect');
  expect(browser.location.hash).toBe('#/devices');
  browser.openHash('#/demo/atom68');
  await settleRouting();
  expect(store.getState().page).toBe('connect');
});
