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
  mergeImported,
  parseKey,
  parseSequence,
  sequenceText,
} from '../protocol';
import type { BackupRow, Backups } from '../storage';
import type { ConnectionState, OperationProgress } from '../types/hid';

export interface EditorForm {
  type: string;
  sequence: string;
  interval: string;
  cycles: string;
  customDelay: boolean;
  picker: string;
  color: string;
}
export type AppDialog =
  | { kind: 'confirm'; title: Message; body: Message; label: Message }
  | { kind: 'message'; title: Message; body: Message }
  | { kind: 'backups' | 'help' };
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
export interface AppState {
  model: KeyboardModel;
  locale: Locale;
  profile: Profile | null;
  source: EditorSource;
  key: number;
  layer: number;
  changes: number[];
  lightsChanged: boolean;
  stale: boolean;
  canWrite: boolean;
  form: EditorForm;
  formDirty: boolean;
  showCounts: boolean;
  session: SessionView;
  busy: Message;
  reading: boolean;
  status: Message;
  progress: number | null | undefined;
  dialog: AppDialog | null;
  logs: Activity[];
  backupRows: BackupRow[];
  backupAvailable: boolean;
  actions: AppActions;
}
export interface AppActions {
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
  resetKey(): void;
  addKey(): void;
  applyColor(all?: boolean): void;
  setShowCounts(show: boolean): void;
  showBackups(): Promise<void>;
  importBackup(id: string): Promise<void>;
  downloadBackup(id: string): Promise<void>;
  showHelp(): void;
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
  !!state.busy || state.session.pending > 0 || state.session.authorizing;

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
          (editor.dirty || get().formDirty),
      });
      if (started && toolsModel !== editor.model) refreshTools();
    }
    function loadForm() {
      const definition = editor.profile?.definition(editor.index);
      set({
        formDirty: false,
        form: definition
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
          : emptyForm(),
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
    ): Promise<boolean> {
      if (resolveConfirmation || disposed) return Promise.resolve(false);
      set({ dialog: { kind: 'confirm', title, body, label } });
      return new Promise((resolve) => {
        resolveConfirmation = resolve;
      });
    }
    async function discardIfNeeded(action: Message) {
      if (!editor.dirty && !get().formDirty) return true;
      return confirm(
        msg('confirm.replaceTitle', { action }),
        msg('confirm.replaceBody'),
        msg('confirm.replace'),
      );
    }
    async function operation(label: Message, execute: () => Promise<void>) {
      if (disposed || isLocked(get())) return;
      set({ busy: label, status: label });
      try {
        await execute();
      } catch (error) {
        fail(error);
      } finally {
        set({ busy: '', reading: false, progress: undefined });
        syncEditor();
        maybeAutoRead();
      }
    }
    function progress(value: OperationProgress) {
      const labels = {
        read: msg('status.readPackets', { count: value.phase === 'read' ? value.records : 0 }),
        verify: msg('status.verify'),
        write: msg('status.write'),
        readback: msg('status.readback'),
        done: msg('status.done'),
      };
      set({ status: labels[value.phase], progress: value.phase === 'read' ? null : value.value });
    }
    async function readConfiguration(automatic = false) {
      await operation(automatic ? msg('status.autoRead') : msg('status.read'), async () => {
        const epoch = session.epoch;
        const preserve =
          automatic && (get().formDirty || editor.dirty || (!!editor.profile && editor.source !== 'read'));
        set({ reading: true });
        const { profile, notes } = await session.read(progress);
        session.assertReady(epoch);
        if (preserve) {
          editor.boundEpoch = null;
          syncEditor();
        } else {
          editor.load(profile, { epoch, source: 'read' });
          loadForm();
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
      });
    }
    function maybeAutoRead() {
      if (disposed || !session.connected || isLocked(get()) || autoReadEpoch === session.epoch) return;
      autoReadEpoch = session.epoch;
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
          interval: Number(form.interval),
          cycles: Number(form.cycles),
          customDelay: form.customDelay,
        });
        editor.applyDefinitions([{ index: editor.index, definition }]);
        set({ formDirty: false });
        if (announce)
          log(msg('status.keySaved', {
            layer: editor.model.layers[editor.layer], key: editor.model.keys[editor.key].label,
          }));
        syncEditor();
        return true;
      } catch (error) {
        fail(error);
        return false;
      }
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
      loadForm();
      const status = live ? msg('status.importLive') : msg('status.importOffline');
      set({ status });
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
          canStage: () => !isLocked(get()) && !get().formDirty && !get().dialog,
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
      setLocale(locale) {
        if (!isLocale(locale) || locale === get().locale || disposed) return;
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
        if (!isLocked(get()) && (await discardIfNeeded(msg('keyboard.read')))) await readConfiguration();
      },
      async demo() {
        if (isLocked(get()) || !(await discardIfNeeded(msg('confirm.loadDemo'))) || isLocked(get())) return;
        const profile = demoProfile(editor.model);
        if (profile.model.demoColor) {
          profile.lights = new Uint8Array(profile.model.keyCount * 3);
          for (let i = 0; i < profile.model.keyCount; i++) profile.lights.set(profile.model.demoColor, i * 3);
        }
        editor.load(profile, { source: 'demo' });
        loadForm();
        const status = msg('status.demo');
        set({ status });
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
        if (!isLocked(get()) && saveForm() && editor.profile) {
          download(renderMessage(msg('download.profile'), get().locale), editor.profile.toJSON());
          log(msg('status.exported'));
        }
      },
      exportDiagnostic() {
        if (!isLocked(get()) && session.lastCapture)
          download(renderMessage(msg('download.diagnostic'), get().locale), session.lastCapture);
      },
      selectKey(key, layer = editor.layer) {
        if (isLocked(get()) || !saveForm()) return false;
        editor.select(key, layer);
        loadForm();
        return true;
      },
      updateForm(patch) {
        if (isLocked(get()) || !editor.profile) return;
        set((state) => ({
          form: { ...state.form, ...patch },
          formDirty: state.formDirty || Object.keys(patch).some((key) => key !== 'picker' && key !== 'color'),
        }));
        syncEditor();
      },
      saveForm,
      resetKey() {
        if (isLocked(get()) || !editor.profile) return;
        editor.resetKey();
        loadForm();
        log(msg('status.resetKey'));
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
        set({ showCounts });
      },
      async showBackups() {
        if (isLocked(get())) return;
        try {
          await refreshBackups();
          set({ dialog: { kind: 'backups' } });
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
        set({ dialog: { kind: 'help' } });
      },
      closeDialog() {
        if (resolveConfirmation) actions.confirm(false);
        else set({ dialog: null });
      },
      confirm(accepted) {
        const resolve = resolveConfirmation;
        resolveConfirmation = null;
        set({ dialog: null });
        resolve?.(accepted);
      },
      async write() {
        if (isLocked(get()) || !saveForm() || !editor.canWrite(session) || !editor.profile) return;
        try {
          editor.profile.validateForWriting();
        } catch (error) {
          fail(error);
          return;
        }
        const target = editor.profile.clone(),
          epoch = session.epoch,
          changes = editor.changes;
        const { keyCount, editableRecords, layers, keys } = target.model;
        const labels = changes
          .slice(0, 12)
          .map((index) =>
            index < editableRecords
              ? joinMessages(layers[Math.floor(index / keyCount)], ' · ', keys[index % keyCount].label)
              : msg('confirm.extendedKey', { group: Math.floor(index / keyCount) + 1, key: (index % keyCount) + 1 }),
          );
        const summary = joinMessages(
          msg(changes.length === 1 ? 'confirm.writeCount.one' : 'confirm.writeCount.other', {
            count: changes.length,
            lighting: editor.lightsChanged ? msg('confirm.lighting') : '',
          }),
          '\n',
          joinMessages(...labels.flatMap((label, index) => (index ? ['\n', label] : [label]))),
          changes.length > 12 ? '…' : '',
          '\n\n',
          msg('confirm.writeBody'),
          '\n\n',
          msg('confirm.writeValidation'),
        );
        if (!(await confirm(msg('confirm.writeTitle'), summary, msg('confirm.writeAction')))) return;
        if (epoch !== session.epoch) {
          fail(new ProtocolError(msg('error.confirmConnection')));
          return;
        }
        await operation(msg('status.preparingWrite'), async () => {
          const result = await session.write(target, saveBackup, progress);
          editor.load(result.profile, { epoch: session.epoch, source: 'read' });
          loadForm();
          const status = msg('status.writeComplete');
          set({ status });
          log(status);
        });
      },
    };
    return {
      model: editor.model,
      locale: dependencies.locale ?? defaultLocale,
      profile: null,
      source: '',
      key: 0,
      layer: 0,
      changes: [],
      lightsChanged: false,
      stale: false,
      canWrite: false,
      form: emptyForm(),
      formDirty: false,
      showCounts: false,
      session: sessionView(),
      busy: '',
      reading: false,
      status: msg('status.initial'),
      progress: undefined,
      dialog: null,
      logs: [],
      backupRows: [],
      backupAvailable: true,
      actions,
    };
  });
}
export type AppStore = ReturnType<typeof createAppStore>;
