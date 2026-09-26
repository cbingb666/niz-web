import {
  msg,
  renderMessage,
  joinMessages,
  backupReason,
  defaultLocale,
  isLocale,
  type Message,
  type Locale,
} from '../i18n/core';
import { localizedKeyName } from '../i18n/key-names';
import { createStore } from 'zustand/vanilla';
import { EditorState, type EditorSource } from '../editor';
import { HIDSession, protocolError } from '../hid';
import { importWindowsProfile } from '../devices/atom66/legacy';
import type { KeyboardModel } from '../devices/index';
import { registerModelTools, type ModelContext } from '../model-tools';
import {
  Profile,
  ProtocolError,
  MAX_FILE_SIZE,
  assert,
  demoProfile,
  hex,
  integer,
  mergeImported,
  parseKey,
  parseSequence,
  sequenceText,
  type KeyDefinition,
} from '../protocol';
import type { BackupRow, Backups } from '../storage';
import type { ConnectionState, OperationProgress } from '../types/hid';

export interface EditorForm {
  view?: 'key' | 'chord' | 'system' | 'advanced';
  type: string;
  sequence: string;
  interval: string;
  cycles: string;
  customDelay: boolean;
  picker: string;
  color: string;
}
export interface ChangeReview { before: Profile; after: Profile; indices: number[]; lights: boolean }
export type AppDialog =
  | { kind: 'confirm'; title: Message; body: Message; label: Message; review?: ChangeReview }
  | { kind: 'message'; title: Message; body: Message }
  | { kind: 'backups' | 'help' | 'activity' | 'device' }
  | { kind: 'changes'; review: ChangeReview };
export interface SessionView {
  model: KeyboardModel | null;
  state: ConnectionState;
  connected: boolean;
  version: string;
  product: string;
  message: Message;
  pending: number;
  authorizing: boolean;
  hasLiveBaseline: boolean;
  epoch: number;
  hasCapture: boolean;
}
export interface Activity {
  id: number;
  time: string;
  message: Message;
  error: boolean;
}
export type AppPage = 'devices' | 'connect' | 'editor';
export interface AppState {
  page: AppPage;
  model: KeyboardModel;
  locale: Locale;
  profile: Profile | null;
  baseline: Profile | null;
  generation: number;
  source: EditorSource;
  key: number;
  layer: number;
  changes: number[];
  lightsChanged: boolean;
  stale: boolean;
  canWrite: boolean;
  form: EditorForm;
  formDirty: boolean;
  drafts: Record<number, EditorForm>;
  draftIndices: number[];
  formError: Message;
  canUndo: boolean;
  canRedo: boolean;
  showCounts: boolean;
  showKeyNumbers: boolean;
  session: SessionView;
  busy: Message;
  hardwareOperation: 'read' | 'write' | null;
  reading: boolean;
  status: Message;
  progress: OperationProgress | null;
  dialog: AppDialog | null;
  logs: Activity[];
  backupRows: BackupRow[];
  backupAvailable: boolean;
  actions: AppActions;
}
export interface AppActions {
  navigate(page: AppPage): void;
  configureDevice(): Promise<void>;
  setLocale(locale: Locale): void;
  start(context?: ModelContext): Promise<void>;
  stop(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  read(): Promise<void>;
  demo(): Promise<void>;
  importFile(file: Pick<File, 'name' | 'size' | 'text'>): Promise<void>;
  exportProfile(): void;
  exportDiagnostic(): void;
  selectKey(key: number, layer?: number): boolean;
  updateForm(form: Partial<EditorForm>): void;
  saveForm(announce?: boolean): boolean;
  assignKey(code: number): void;
  discardForm(): void;
  undo(): void;
  redo(): void;
  showChanges(): void;
  resetKey(): void;
  addKey(): void;
  applyColor(all?: boolean): void;
  setShowCounts(show: boolean): void;
  setShowKeyNumbers(show: boolean): void;
  showBackups(): Promise<void>;
  importBackup(id: string): Promise<void>;
  downloadBackup(id: string): Promise<void>;
  showHelp(): void;
  showActivity(): void;
  showDeviceDetails(): void;
  closeDialog(): void;
  confirm(accepted: boolean): void;
  write(): Promise<void>;
}
export interface AppDependencies {
  locale?: Locale;
  onLocaleChange?: (locale: Locale) => void;
  session: HIDSession;
  backups: Backups;
  download: (label: string, data: unknown) => void;
}
const emptyForm = (): EditorForm => ({
  type: '0',
  sequence: '',
  interval: '30',
  cycles: '1',
  customDelay: false,
  picker: '',
  color: '#42ddb4',
});
export const isLocked = (state: AppState) =>
  !!state.busy || state.session.pending > 0 || state.session.authorizing || state.dialog?.kind === 'confirm';

export function createAppStore(dependencies: AppDependencies) {
  const session: HIDSession = dependencies.session;
  const { backups, download } = dependencies;
  const editor = new EditorState();
  let autoReadEpoch: number | null = null;
  let lastConnection = '';
  let logId = 0;
  let started = false;
  let disposed = false;
  let resolveConfirmation: ((accepted: boolean) => void) | null = null;
  let unregisterTools = () => {};
  let modelContext: ModelContext | undefined;
  let toolsModel: KeyboardModel | null = null;
  const sessionView = (): SessionView => ({
    model: session.model,
    state: session.state,
    connected: session.connected,
    version: session.version,
    product: String(session.identity.Product ?? session.model?.name ?? ''),
    message: session.statusMessage,
    pending: session.pending,
    authorizing: session.authorizing,
    hasLiveBaseline: session.hasLiveBaseline,
    epoch: session.epoch,
    hasCapture: !!session.lastCapture,
  });

  return createStore<AppState>()((set, get) => {
    function syncEditor() {
      set({
        model: editor.model,
        profile: editor.profile?.clone() ?? null,
        baseline: editor.baseline?.clone() ?? null,
        generation: editor.generation,
        canUndo: editor.canUndo,
        canRedo: editor.canRedo,
        draftIndices: Object.keys(get().drafts).map(Number),
        source: editor.source,
        key: editor.key,
        layer: editor.layer,
        changes: editor.changes,
        lightsChanged: editor.lightsChanged,
        stale: editor.boundEpoch !== null && editor.boundEpoch !== session.epoch,
        session: sessionView(),
        canWrite:
          editor.source !== 'demo' &&
          editor.boundEpoch === session.epoch &&
          session.hasLiveBaseline &&
          editor.dirty && !Object.keys(get().drafts).length,
      });
      if (started && toolsModel !== editor.model) refreshTools();
    }
    function loadForm(reset = false) {
      if (reset) set({ drafts: {} });
      const definition = editor.profile?.definition(editor.index);
      const draft = get().drafts[editor.index];
      set({
        formDirty: !!draft,
        formError: '',
        form: draft ?? (definition
          ? {
              type: String(definition.type),
              sequence: sequenceText(definition, (code) => localizedKeyName(code, get().locale)),
              interval: String(definition.interval),
              cycles: String(definition.cycles || 1),
              customDelay: !!definition.customDelay,
              picker: '',
              color: editor.profile?.lights
                ? '#' + hex(editor.profile.lights.slice(editor.key * 3, editor.key * 3 + 3))
                : '#42ddb4',
            }
          : emptyForm()),
      });
      syncEditor();
    }
    function log(message: Message, error = false) {
      set((state) => ({
        logs: [{ id: ++logId, time: new Date().toISOString(), message, error }, ...state.logs].slice(0, 100),
      }));
    }
    function fail(error: unknown) {
      const message = protocolError(error).description;
      log(message, true);
      set({ status: message, dialog: { kind: 'message', title: msg('common.errorTitle'), body: message } });
    }
    async function refreshBackups() {
      try {
        set({ backupRows: await backups.list(), backupAvailable: true });
      } catch (error) {
        set({ backupAvailable: false });
        throw error;
      }
    }
    async function saveBackup(profile: Profile, reason: string) {
      const id = await backups.save(profile, reason);
      await refreshBackups().catch(() => {});
      log(msg('backup.saved', { reason: backupReason(reason) }));
      return id;
    }
    function confirm(
      title: Message,
      body: Message,
      label: Message = msg('common.continue'),
      review?: ChangeReview,
    ): Promise<boolean> {
      if (resolveConfirmation || disposed) return Promise.resolve(false);
      return new Promise((resolve) => {
        resolveConfirmation = resolve;
        set({ dialog: { kind: 'confirm', title, body, label, review } });
      });
    }
    async function discardIfNeeded(action: Message) {
      if (!editor.dirty && !get().draftIndices.length) return true;
      const accepted = await confirm(
        msg('confirm.replaceTitle', { action }),
        msg('confirm.replaceBody'),
        msg('confirm.replace'),
      );
      if (!accepted) maybeAutoRead();
      return accepted;
    }
    async function operation(
      label: Message,
      execute: () => Promise<void>,
      hardwareOperation: AppState['hardwareOperation'] = null,
    ) {
      if (disposed || isLocked(get())) return;
      set({ busy: label, status: label, hardwareOperation, progress: null });
      try {
        await execute();
      } catch (error) {
        fail(error);
      } finally {
        set({ busy: '', hardwareOperation: null, reading: false, progress: null });
        syncEditor();
        maybeAutoRead();
      }
    }
    function progress(value: OperationProgress) {
      const labels = {
        read: msg('status.readKeys'),
        verify: msg('status.verify'),
        counters: msg('status.readCounters'),
        readLights: msg('status.readLights'),
        backup: msg('status.backingUp'),
        write: msg('status.write'),
        writeLights: msg('status.writeLights'),
        settle: msg('status.deviceProcessing'),
        readback: msg('status.readback'),
        readbackLights: msg('status.readbackLights'),
        validate: msg('status.validateReadback'),
        done: msg('status.done'),
      };
      set({ status: labels[value.phase], progress: value });
    }
    async function readConfiguration(automatic = false) {
      if (disposed || !session.connected || isLocked(get()) || get().dialog) return;
      const epoch = session.epoch;
      const preserve =
        automatic && (get().draftIndices.length > 0 || editor.dirty || (!!editor.profile && editor.source !== 'read'));
      // A cancelled connection prompt must not appear again until a new connection
      // or an explicit Read action. Consent is valid only for this connection epoch.
      autoReadEpoch = epoch;
      set({ status: msg('status.readConfirmation') });
      const title = automatic
        ? msg(session.connectionSource === 'automatic' ? 'confirm.autoReadTitle' : 'confirm.connectedReadTitle')
        : msg('confirm.readTitle');
      const body = joinMessages(
        automatic
          ? joinMessages(msg('confirm.connectedDevice', { product: sessionView().product }), '\n\n')
          : '',
        msg('confirm.keyLock'),
        '\n\n',
        msg('confirm.readBody'),
        preserve
          ? joinMessages('\n\n', msg('confirm.readPreserve'))
          : editor.dirty || get().draftIndices.length
            ? joinMessages('\n\n', msg('confirm.replaceBody'))
            : '',
      );
      if (!(await confirm(title, body, msg('confirm.readAction')))) {
        if (!disposed && epoch === session.epoch) set({ status: msg('status.readCancelled') });
        maybeAutoRead();
        return;
      }
      if (disposed) return;
      if (!session.connected || epoch !== session.epoch) {
        fail(new ProtocolError(msg('error.confirmReadConnection')));
        return;
      }
      await operation(automatic ? msg('status.autoRead') : msg('status.read'), async () => {
        set({ reading: true });
        const { profile, notes } = await session.read(progress);
        session.assertReady(epoch);
        if (preserve) {
          editor.boundEpoch = null;
          syncEditor();
        } else {
          editor.load(profile, { epoch, source: 'read' });
          loadForm(true);
        }
        log(
          msg(automatic ? 'status.autoReadSuccess' : 'status.readSuccess', {
            groups: profile.groupCount,
            records: profile.records.length,
          }),
        );
        notes.forEach((note) => log(note, true));
        let saved = false;
        try {
          progress({ phase: 'backup' });
          await saveBackup(profile, automatic ? '自动读取备份' : '读取备份');
          saved = true;
        } catch (error) {
          log(protocolError(error).description, true);
        }
        const suffix = saved ? msg('status.backupSaved') : msg('status.backupFailed');
        set({
          status:
            !session.connected || session.epoch !== epoch
              ? msg('status.readStale', { backup: suffix })
              : preserve
                ? msg('status.readPreserved', { backup: suffix })
                : msg(automatic ? 'status.autoReadReady' : 'status.readReady', { backup: suffix }),
        });
      }, 'read');
    }
    function maybeAutoRead() {
      if (disposed || !session.connected || isLocked(get()) || get().dialog || autoReadEpoch === session.epoch) return;
      void readConfiguration(true);
    }
    function onSessionChange() {
      const state = `${session.state}:${session.version}:${session.message}`;
      if (state !== lastConnection) {
        lastConnection = state;
        log(
          session.connected
            ? msg('status.connected', { version: session.version })
            : session.statusMessage || msg('status.waiting'),
          session.state === 'error',
        );
      }
      syncEditor();
      maybeAutoRead();
    }
    function saveForm(announce = false): boolean {
      if (!editor.profile || !get().formDirty) return true;
      if (isLocked(get())) return false;
      try {
        const form = get().form;
        const definition = parseSequence(form.sequence, {
          type: Number(form.type),
          interval: Number(form.type) > 0
            ? integer(form.interval.trim() ? Number(form.interval) : NaN, 65535, msg('field.interval'))
            : Number(form.interval),
          cycles: Number(form.type) === 2
            ? integer(form.cycles.trim() ? Number(form.cycles) : NaN, 255, msg('field.cycles'), 1)
            : Number(form.cycles),
          customDelay: form.customDelay,
        });
        applyDefinition(definition);
        if (announce)
          log(msg('status.keySaved', {
            layer: editor.model.layers[editor.layer], key: `#${String(editor.key + 1).padStart(2, '0')}`,
          }));
        return true;
      } catch (error) {
        set({ formError: protocolError(error).description });
        return false;
      }
    }
    function assertNoRelatedDrafts(allLayers: boolean) {
      if (allLayers)
        assert(!get().draftIndices.some(index => index !== editor.index && index % editor.model.keyCount === editor.key), msg('mapping.fnDrafts'));
    }
    function applyDefinition(definition: KeyDefinition) {
      assertNoRelatedDrafts(editor.isFn(definition) || editor.hasFnAt(editor.key));
      editor.applyDefinitions([{ index: editor.index, definition }]);
      const drafts = { ...get().drafts };
      delete drafts[editor.index];
      set({ drafts, status: msg('mapping.staged') });
      loadForm();
    }
    function review(): ChangeReview | undefined {
      if (!editor.profile || !editor.baseline) return;
      return { before: editor.baseline.clone(), after: editor.profile.clone(), indices: editor.changes, lights: editor.lightsChanged };
    }
    function stageImport(profile: Profile, label: Message) {
      const live = session.hasLiveBaseline;
      const baseline = live ? (session.lastRead?.profile ?? null) : null;
      const merged = mergeImported(profile, baseline);
      editor.load(merged, {
        baseline: baseline ?? merged,
        epoch: live ? session.epoch : null,
        source: 'import',
      });
      loadForm(true);
      const status = live ? msg('status.importLive') : msg('status.importOffline');
      set({ status, page: 'editor' });
      log(msg('status.importLabel', { label, status }));
    }
    function refreshTools() {
      unregisterTools();
      toolsModel = editor.model;
      unregisterTools = registerModelTools(
        modelContext,
        {
          editor,
          session,
          canStage: () => !isLocked(get()) && !get().draftIndices.length && !get().dialog,
          onStaged: () => {
            loadForm();
            log(msg('status.toolsStaged'));
          },
        },
        () => log(msg('status.toolsUnavailable')),
        get().locale,
      );
    }
    const actions: AppActions = {
      navigate(page) {
        if (disposed || isLocked(get()) || get().dialog) return;
        if (page === 'editor' && !get().profile && !get().session.connected) return;
        set({ page });
      },
      async configureDevice() {
        if (disposed || isLocked(get()) || get().dialog || !session.connected) return;
        if (!session.hasLiveBaseline || editor.boundEpoch !== session.epoch || editor.source === 'demo')
          await readConfiguration();
        if (disposed || isLocked(get()) || get().dialog || !session.connected || editor.boundEpoch !== session.epoch) return;
        set({ page: 'editor' });
      },
      setLocale(locale) {
        if (!isLocale(locale) || locale === get().locale || disposed || get().hardwareOperation) return;
        set((state) => ({
          locale,
          form:
            !state.formDirty && editor.profile
              ? {
                  ...state.form,
                  sequence: sequenceText(editor.profile.definition(editor.index), (code) =>
                    localizedKeyName(code, locale),
                  ),
                }
              : state.form,
        }));
        dependencies.onLocaleChange?.(locale);
        if (started) refreshTools();
      },
      async start(context) {
        if (started || disposed) return;
        started = true;
        session.addEventListener('change', onSessionChange);
        modelContext = context;
        refreshTools();
        void refreshBackups().catch((error) => log(protocolError(error).description, true));
        await session.start().catch(fail);
      },
      async stop() {
        disposed = true;
        unregisterTools();
        actions.confirm(false);
        session.removeEventListener('change', onSessionChange);
        await session.stop();
      },
      async connect() {
        if (!isLocked(get())) await session.authorize().catch(fail);
      },
      async disconnect() {
        if (!isLocked(get())) await session.disconnect().catch(fail);
      },
      async read() {
        await readConfiguration();
      },
      async demo() {
        if (isLocked(get()) || !(await discardIfNeeded(msg('confirm.loadDemo'))) || isLocked(get())) return;
        const profile = demoProfile(editor.model);
        if (profile.model.demoColor) {
          profile.lights = new Uint8Array(profile.model.keyCount * 3);
          for (let i = 0; i < profile.model.keyCount; i++) profile.lights.set(profile.model.demoColor, i * 3);
        }
        editor.load(profile, { source: 'demo' });
        loadForm(true);
        const status = msg('status.demo');
        set({ status, page: 'editor' });
        log(status);
        maybeAutoRead();
      },
      async importFile(file) {
        if (isLocked(get()) || !(await discardIfNeeded(msg('keyboard.import')))) return;
        await operation(msg('status.importing'), async () => {
          assert(file.size <= MAX_FILE_SIZE, msg('error.importSize'));
          const text = await file.text();
          const live = session.hasLiveBaseline;
          const profile = file.name.toLowerCase().endsWith('.pro')
            ? importWindowsProfile(text, live ? session.version : undefined, live ? session.identity : {})
            : Profile.fromJSON(text, session.models);
          stageImport(profile, file.name);
        });
      },
      exportProfile() {
        if (!isLocked(get()) && !get().draftIndices.length && editor.profile) {
          download(renderMessage(msg('download.profile'), get().locale), editor.profile.toJSON());
          log(msg('status.exported'));
        }
      },
      exportDiagnostic() {
        if (!isLocked(get()) && session.lastCapture)
          download(renderMessage(msg('download.diagnostic'), get().locale), session.lastCapture);
      },
      selectKey(key, layer = editor.layer) {
        if (isLocked(get())) return false;
        editor.select(key, layer);
        // Choosing the front-edge mapping explicitly returns to mapping view.
        if (layer === 1 && get().showCounts) set({ showCounts: false });
        loadForm();
        return true;
      },
      updateForm(patch) {
        if (isLocked(get()) || !editor.profile) return;
        set((state) => {
          const form = { ...state.form, ...patch };
          const formDirty = state.formDirty || Object.keys(patch).some((key) => key !== 'picker' && key !== 'color' && key !== 'view');
          return { form, formDirty, formError: '', drafts: formDirty ? { ...state.drafts, [editor.index]: form } : state.drafts };
        });
        syncEditor();
      },
      saveForm,
      assignKey(code) {
        if (isLocked(get()) || !editor.profile) return;
        try { applyDefinition({ type: 0, keys: [code] }); }
        catch (error) { set({ formError: protocolError(error).description }); }
      },
      discardForm() {
        if (isLocked(get())) return;
        const drafts = { ...get().drafts };
        delete drafts[editor.index];
        set({ drafts });
        loadForm();
      },
      undo() {
        if (isLocked(get())) return;
        editor.undo();
        loadForm();
        set({ status: msg('mapping.undone') });
      },
      redo() {
        if (isLocked(get())) return;
        editor.redo();
        loadForm();
        set({ status: msg('mapping.redone') });
      },
      showChanges() {
        if (isLocked(get())) return;
        const changes = review();
        if (changes) set({ dialog: { kind: 'changes', review: changes } });
      },
      resetKey() {
        if (isLocked(get()) || !editor.profile) return;
        try {
          assertNoRelatedDrafts(editor.hasFnAt(editor.key) || editor.hasFnAt(editor.key, editor.baseline));
          editor.resetKey();
          actions.discardForm();
          log(msg('status.resetKey'));
        } catch (error) { set({ formError: protocolError(error).description }); }
      },
      addKey() {
        if (isLocked(get()) || !editor.profile) return;
        try {
          const form = get().form,
            code = parseKey(form.picker),
            lines = form.sequence.trimEnd().split('\n').filter(Boolean);
          if (Number(form.type) >= 2 && form.customDelay && lines.length && !/\s+@/.test(lines.at(-1) ?? ''))
            lines[lines.length - 1] += ` @${form.interval || 30}`;
          lines.push(localizedKeyName(code, get().locale));
          actions.updateForm({ sequence: lines.join('\n'), picker: '' });
        } catch (error) {
          fail(error);
        }
      },
      applyColor(all = false) {
        if (isLocked(get())) return;
        try {
          editor.color(get().form.color, all);
          syncEditor();
          log(all ? msg('status.colorAll') : msg('status.colorKey'));
        } catch (error) {
          fail(error);
        }
      },
      setShowCounts(showCounts) {
        if (isLocked(get())) return;
        if (showCounts && editor.layer === 1 && editor.model.capabilities(editor.profile?.version ?? '').counters) {
          editor.select(editor.key, 0);
          loadForm();
        }
        set({ showCounts });
      },
      setShowKeyNumbers(showKeyNumbers) {
        if (isLocked(get())) return;
        set({ showKeyNumbers });
      },
      async showBackups() {
        if (isLocked(get())) return;
        set({ dialog: { kind: 'backups' } });
        try {
          await refreshBackups();
        } catch (error) {
          fail(error);
        }
      },
      async importBackup(id) {
        if (isLocked(get())) return;
        set({ dialog: null });
        if (!(await discardIfNeeded(msg('confirm.importBackup')))) return;
        await operation(msg('status.importingBackup'), async () => {
          stageImport(await backups.profile(id), msg('backup.title'));
        });
      },
      async downloadBackup(id) {
        try {
          download(renderMessage(msg('download.backup'), get().locale), (await backups.profile(id)).toJSON());
        } catch (error) {
          fail(error);
        }
      },
      showHelp() {
        if (isLocked(get())) return;
        set({ dialog: { kind: 'help' } });
      },
      showActivity() {
        if (isLocked(get())) return;
        set({ dialog: { kind: 'activity' } });
      },
      showDeviceDetails() {
        if (isLocked(get()) || !get().session.connected) return;
        set({ dialog: { kind: 'device' } });
      },
      closeDialog() {
        if (resolveConfirmation) actions.confirm(false);
        else {
          set({ dialog: null });
          maybeAutoRead();
        }
      },
      confirm(accepted) {
        const resolve = resolveConfirmation;
        resolveConfirmation = null;
        set({ dialog: null });
        resolve?.(accepted);
      },
      async write() {
        if (isLocked(get()) || get().dialog || get().draftIndices.length || !editor.canWrite(session) || !editor.profile) return;
        try {
          editor.profile.validateForWriting();
        } catch (error) {
          fail(error);
          return;
        }
        const target = editor.profile.clone(),
          epoch = session.epoch,
          changes = editor.changes;
        const summary = joinMessages(
          msg('confirm.keyLock'),
          '\n\n',
          msg(changes.length === 1 ? 'confirm.writeCount.one' : 'confirm.writeCount.other', {
            count: changes.length,
            lighting: editor.lightsChanged ? msg('confirm.lighting') : '',
          }),
          '\n\n',
          msg('confirm.writeBody'),
          '\n\n',
          msg('confirm.writeValidation'),
        );
        if (!(await confirm(msg('confirm.writeTitle'), summary, msg('confirm.writeAction'), review()))) {
          maybeAutoRead();
          return;
        }
        if (epoch !== session.epoch) {
          fail(new ProtocolError(msg('error.confirmConnection')));
          return;
        }
        await operation(msg('status.preparingWrite'), async () => {
          const result = await session.write(target, saveBackup, progress);
          editor.load(result.profile, { epoch: session.epoch, source: 'read' });
          loadForm(true);
          const status = msg('status.writeComplete');
          set({ status });
          log(status);
        }, 'write');
      },
    };
    return {
      page: 'devices',
      model: editor.model,
      locale: dependencies.locale ?? defaultLocale,
      profile: null,
      baseline: null,
      generation: 0,
      source: '',
      key: 0,
      layer: 0,
      changes: [],
      lightsChanged: false,
      stale: false,
      canWrite: false,
      form: emptyForm(),
      formDirty: false,
      drafts: {},
      draftIndices: [],
      formError: '',
      canUndo: false,
      canRedo: false,
      showCounts: false,
      showKeyNumbers: false,
      session: sessionView(),
      busy: '',
      hardwareOperation: null,
      reading: false,
      status: msg('status.initial'),
      progress: null,
      dialog: null,
      logs: [],
      backupRows: [],
      backupAvailable: true,
      actions,
    };
  });
}
export type AppStore = ReturnType<typeof createAppStore>;
