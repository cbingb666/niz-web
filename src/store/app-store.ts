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
import { deviceName } from '../i18n/device';
import { initialCalibration, type CalibrationTarget, type CalibrationSnapshot, type CalibrationRun } from '../calibration';
import { createStore } from 'zustand/vanilla';
import { EditorState, type EditorSource } from '../editor';
import { HIDSession, protocolError, type ConnectedHIDDevice } from '../hid';
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
interface ConfirmationDetails {
  locksKeyboard?: boolean;
  notice?: Message;
  warning?: Message;
  review?: ChangeReview;
}
export type AppDialog =
  | ({ kind: 'confirm'; title: Message; body: Message; label: Message } & ConfirmationDetails)
  | { kind: 'message'; title: Message; body: Message }
  | { kind: 'backups' | 'help' | 'activity' | 'device' | 'calibration' }
  | { kind: 'changes'; review: ChangeReview };
export interface SessionView {
  id: string | null;
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
interface EditingSession {
  editor: EditorState;
  form: EditorForm;
  formDirty: boolean;
  formError: Message;
  drafts: Record<number, EditorForm>;
  showCounts: boolean;
  showKeyNumbers: boolean;
}
export interface DeviceView extends ConnectedHIDDevice {
  hasEdits: boolean;
}
export interface CalibrationView {
  target: CalibrationTarget;
  name: Message;
  state: CalibrationSnapshot;
  recordTrace: boolean;
  hasCapture: boolean;
}
export interface AppState {
  page: AppPage;
  model: KeyboardModel;
  locale: Locale;
  profile: Profile | null;
  editorName: Message;
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
  connectedDevices: DeviceView[];
  disconnectedEditors: { id: string; number: number; model: string; name: Message }[];
  hasUnsavedChanges: boolean;
  busy: Message;
  hardwareOperation: 'read' | 'write' | 'calibrate' | null;
  calibration: CalibrationView | null;
  calibrationResults: Record<string, CalibrationView>;
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
  navigate(page: AppPage): Promise<void>;
  configureDevice(id?: string): Promise<void>;
  resumeEditor(id: string): void;
  setLocale(locale: Locale): void;
  start(context?: ModelContext): Promise<void>;
  stop(): Promise<void>;
  connect(): Promise<string | null>;
  disconnect(id?: string): Promise<void>;
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
  openCalibration(id: string): void;
  setCalibrationTrace(record: boolean): void;
  startCalibration(): Promise<void>;
  calibrateHeldKeys(): Promise<void>;
  finishCalibration(): Promise<void>;
  closeCalibration(): void;
  reviewCalibration(id: string): void;
  exportCalibration(): void;
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
  !!state.busy || state.session.pending > 0 || state.session.authorizing || state.dialog?.kind === 'confirm' ||
    (state.dialog?.kind === 'calibration' && state.calibration?.state.phase === 'preparing');

export function createAppStore(dependencies: AppDependencies) {
  const session: HIDSession = dependencies.session;
  const { backups, download } = dependencies;
  let editor = new EditorState();
  let editorDeviceId = session.activeDeviceId;
  const editingSessions = new Map<string, EditingSession>();
  const knownDevices = new Map<string, { name: string; number: number }>();
  let lastConnection = '';
  let logId = 0;
  let started = false;
  let disposed = false;
  let calibrationRun: CalibrationRun | null = null;
  let resolveConfirmation: ((accepted: boolean) => void) | null = null;
  let unregisterTools = () => {};
  let modelContext: ModelContext | undefined;
  let toolsModel: KeyboardModel | null = null;
  let toolsEditor: EditorState | null = null;
  const sessionView = (): SessionView => ({
    id: session.activeDeviceId,
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
    function activateEditor() {
      const id = session.activeDeviceId;
      if (!id || id === editorDeviceId) return;
      // The first connection retains any offline work already in the editor.
      if (editorDeviceId) {
        const { form, formDirty, formError, drafts, showCounts, showKeyNumbers } = get();
        editingSessions.set(editorDeviceId, { editor, form, formDirty, formError, drafts, showCounts, showKeyNumbers });
        const cached = editingSessions.get(id);
        editor = cached?.editor ?? new EditorState();
        const nextForm = cached?.form ?? emptyForm();
        set({
          form: cached && !cached.formDirty && editor.profile
            ? { ...nextForm, sequence: sequenceText(editor.profile.definition(editor.index), code => localizedKeyName(code, get().locale)) }
            : nextForm,
          formDirty: cached?.formDirty ?? false,
          formError: cached?.formError ?? '',
          drafts: cached?.drafts ?? {},
          showCounts: cached?.showCounts ?? false,
          showKeyNumbers: cached?.showKeyNumbers ?? false,
          status: msg('status.initial'),
        });
      }
      editorDeviceId = id;
    }
    function syncEditor() {
      const activeDirty = editor.dirty || Object.keys(get().drafts).length > 0;
      for (const device of session.connectedDevices)
        knownDevices.set(device.id, { name: device.product.trim() || device.model.name, number: device.number });
      const savedDeviceName = (id: string, model: string): Message => msg('devices.numberedName', {
        name: knownDevices.get(id)?.name ?? model,
        number: knownDevices.get(id)?.number ?? Number(id.slice('device-'.length)),
      });
      const connectedDevices = session.connectedDevices.map(device => {
        const saved = editingSessions.get(device.id);
        return { ...device, hasEdits: device.id === editorDeviceId ? activeDirty :
          !!saved && (saved.editor.dirty || Object.keys(saved.drafts).length > 0) };
      });
      const currentDevice = connectedDevices.find(device => device.id === editorDeviceId);
      set({
        model: editor.model,
        profile: editor.profile?.clone() ?? null,
        editorName: currentDevice ? deviceName(currentDevice, connectedDevices)
          : editorDeviceId ? savedDeviceName(editorDeviceId, editor.model.name) : editor.model.name,
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
        connectedDevices,
        disconnectedEditors: [...editingSessions].filter(([id, saved]) =>
          id !== editorDeviceId && !!saved.editor.profile && !connectedDevices.some(device => device.id === id))
          .map(([id, saved]) => ({ id, number: Number(id.slice('device-'.length)), model: saved.editor.model.name,
            name: savedDeviceName(id, saved.editor.model.name) })),
        hasUnsavedChanges: activeDirty || [...editingSessions].some(([id, saved]) =>
          id !== editorDeviceId && (saved.editor.dirty || Object.keys(saved.drafts).length > 0)),
        canWrite:
          editor.source !== 'demo' &&
          editor.boundEpoch === session.epoch &&
          session.hasLiveBaseline &&
          editor.dirty && !Object.keys(get().drafts).length,
      });
      if (started && (toolsModel !== editor.model || toolsEditor !== editor)) refreshTools();
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
      details: ConfirmationDetails = {},
    ): Promise<boolean> {
      if (resolveConfirmation || disposed) return Promise.resolve(false);
      return new Promise((resolve) => {
        resolveConfirmation = resolve;
        set({ dialog: { kind: 'confirm', title, body, label, ...details } });
      });
    }
    async function discardIfNeeded(action: Message) {
      if (!editor.dirty && !get().draftIndices.length) return true;
      const accepted = await confirm(
        msg('confirm.replaceTitle', { action }),
        msg('confirm.replaceBody'),
        msg('confirm.replace'),
      );
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
    async function readConfiguration() {
      if (disposed || !session.connected || isLocked(get()) || get().dialog) return;
      const epoch = session.epoch;
      // Connecting only identifies a device. Reading is an explicit action, and
      // its confirmation is valid only for this connection epoch.
      set({ status: msg('status.readConfirmation') });
      const title = msg('confirm.readTitle');
      if (!(await confirm(title, msg('confirm.readBody'), msg('confirm.readAction'), {
        locksKeyboard: true,
        notice: msg('operation.keepConnected'),
        warning: editor.dirty || get().draftIndices.length ? msg('confirm.replaceBody') : undefined,
      }))) {
        if (!disposed && epoch === session.epoch) set({ status: msg('status.readCancelled') });
        return;
      }
      if (disposed) return;
      if (!session.connected || epoch !== session.epoch) {
        fail(new ProtocolError(msg('error.confirmReadConnection')));
        return;
      }
      await operation(msg('status.read'), async () => {
        set({ reading: true });
        const { profile, notes } = await session.read(progress);
        session.assertReady(epoch);
        editor.load(profile, { epoch, source: 'read' });
        loadForm(true);
        log(
          msg('status.readSuccess', {
            groups: profile.groupCount,
            records: profile.records.length,
          }),
        );
        notes.forEach((note) => log(note, true));
        let saved = false;
        try {
          progress({ phase: 'backup' });
          await saveBackup(profile, '读取备份');
          saved = true;
        } catch (error) {
          log(protocolError(error).description, true);
        }
        const suffix = saved ? msg('status.backupSaved') : msg('status.backupFailed');
        set({
          status:
            !session.connected || session.epoch !== epoch
              ? msg('status.readStale', { backup: suffix })
              : msg('status.readReady', { backup: suffix }),
        });
      }, 'read');
    }
    function onSessionChange() {
      const disconnected = get().session.connected && !session.connected && get().session.id === session.activeDeviceId;
      activateEditor();
      const state = `${session.activeDeviceId}:${session.state}:${session.version}:${session.message}`;
      if (state !== lastConnection) {
        lastConnection = state;
        log(
          session.connected && !session.authorizing
            ? msg('status.connected', { version: session.version })
            : session.statusMessage || msg('status.waiting'),
          session.state === 'error',
        );
      }
      syncEditor();
      if (disconnected && get().page === 'editor') {
        set({ page: 'devices' });
        const dialog = get().dialog;
        if (dialog?.kind === 'device') set({ dialog: null });
        if (dialog?.kind === 'confirm' && typeof dialog.title !== 'string' && 'key' in dialog.title && dialog.title.key === 'confirm.leaveEditorTitle')
          actions.confirm(false);
      }
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
      toolsEditor = editor;
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
      openCalibration(id) {
        if (disposed || isLocked(get()) || get().dialog) return;
        try {
          const target = session.calibrationTarget(id);
          const devices = session.connectedDevices;
          const device = devices.find(device => device.id === id)!;
          set({ calibration: { target, name: deviceName(device, devices), state: initialCalibration(),
            recordTrace: false, hasCapture: false }, dialog: { kind: 'calibration' } });
        } catch (error) { fail(error); }
      },
      setCalibrationTrace(recordTrace) {
        const calibration = get().calibration;
        if (!disposed && calibration?.state.phase === 'preparing') set({ calibration: { ...calibration, recordTrace } });
      },
      async startCalibration() {
        const view = get().calibration;
        if (disposed || calibrationRun || view?.state.phase !== 'preparing' || get().hardwareOperation) return;
        let outcome: CalibrationSnapshot = { ...view.state, phase: 'identifying' };
        let runStarted = false;
        set({ busy: msg('calibration.phase.identifying'), hardwareOperation: 'calibrate',
          calibration: { ...view, state: outcome } });
        try {
          calibrationRun = session.beginCalibration(view.target, state => {
            outcome = state;
            if (!disposed) set({ calibration: { ...view, state } });
          }, { recordTrace: view.recordTrace });
          runStarted = true;
          outcome = await calibrationRun.done;
        } catch (error) {
          outcome = { ...outcome, phase: 'failed', error: protocolError(error).description };
        } finally {
          calibrationRun = null;
          const result = { ...view, state: outcome, hasCapture: runStarted && !!session.calibrationCapture(view.target.id) };
          set(state => ({ busy: '', hardwareOperation: null, calibration: result,
            calibrationResults: { ...state.calibrationResults, [view.target.id]: result } }));
          if (!disposed) {
            log(joinMessages(view.name, ' · ', outcome.error ?? msg('calibration.unlockSent')), !!outcome.error);
            syncEditor();
          }
        }
      },
      async calibrateHeldKeys() {
        if (disposed || get().calibration?.state.phase !== 'awaiting-held-keys' || !calibrationRun) return;
        // The owning run publishes failures after bounded cleanup, preserving the wizard.
        await calibrationRun.calibrateHeldKeys().catch(() => {});
      },
      async finishCalibration() {
        if (disposed || get().calibration?.state.phase !== 'awaiting-held-keys' || !calibrationRun) return;
        await calibrationRun.finish().catch(() => {});
      },
      closeCalibration() {
        if (calibrationRun || get().hardwareOperation === 'calibrate') return;
        set({ calibration: null, dialog: null });
      },
      reviewCalibration(id) {
        if (disposed || isLocked(get()) || get().dialog) return;
        const result = get().calibrationResults[id];
        if (result) set({ calibration: result, dialog: { kind: 'calibration' } });
      },
      exportCalibration() {
        const view = get().calibration;
        if (disposed || !view?.hasCapture || calibrationRun) return;
        const capture = session.calibrationCapture(view.target.id);
        if (capture) download(renderMessage(msg('calibration.download'), get().locale), capture);
      },
      resumeEditor(id) {
        if (disposed || isLocked(get()) || get().dialog || !editingSessions.get(id)?.editor.profile) return;
        if (session.selectDevice(id, true)) set({ page: 'editor' });
      },
      async navigate(page) {
        if (disposed || isLocked(get()) || get().dialog || page === get().page) return;
        if (page === 'editor' && !get().profile && !get().session.connected) return;
        if (get().page === 'editor' && page === 'devices' && (editor.dirty || get().draftIndices.length)) {
          if (!(await confirm(msg('confirm.leaveEditorTitle'), msg('confirm.leaveEditorBody'), msg('confirm.leaveEditorAction')))) return;
          if (disposed || isLocked(get()) || get().dialog || get().page !== 'editor') return;
        }
        set({ page });
      },
      async configureDevice(id = session.activeDeviceId ?? undefined) {
        if (disposed || isLocked(get()) || get().dialog) return;
        if (id && !session.selectDevice(id)) return;
        if (!session.connected) return;
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
        if (disposed || isLocked(get())) return null;
        try { return await session.authorize(); }
        catch (error) { if (!disposed) fail(error); return null; }
      },
      async disconnect(id = session.activeDeviceId ?? undefined) {
        if (!isLocked(get())) {
          if (id) await session.disconnectDevice(id).catch(fail);
          else await session.disconnect().catch(fail);
        }
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
        if (get().dialog?.kind === 'calibration') actions.closeCalibration();
        else if (resolveConfirmation) actions.confirm(false);
        else set({ dialog: null });
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
        );
        if (!(await confirm(msg('confirm.writeTitle'), summary, msg('confirm.writeAction'), {
          locksKeyboard: true,
          notice: msg('operation.keepConnected'),
          warning: msg('confirm.writeValidation'),
          review: review(),
        }))) {
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
      editorName: '',
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
      connectedDevices: session.connectedDevices.map(device => ({ ...device, hasEdits: false })),
      disconnectedEditors: [],
      hasUnsavedChanges: false,
      busy: '',
      hardwareOperation: null,
      calibration: null,
      calibrationResults: {},
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
