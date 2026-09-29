import { msg, type Message } from './i18n/core';
import { assert, command, hex, ProtocolError } from './protocol';
import type { HIDCollection, PacketObservation } from './types/hid';

export type CalibrationAvailability = 'available' | 'unsupported';
export type CalibrationPhase =
  | 'preparing' | 'identifying' | 'locking' | 'calibrating-release'
  | 'awaiting-held-keys' | 'calibrating-press' | 'unlocking' | 'testing' | 'failed';
export type CalibrationUnlock = 'not-needed' | 'sent' | 'failed' | 'unknown';
export interface CalibrationTarget {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly model: string;
  readonly version: string;
  readonly epoch: number;
}
export interface CalibrationSnapshot {
  phase: CalibrationPhase;
  releaseCompleted: boolean;
  batches: number;
  unlock: CalibrationUnlock;
  error: Message | null;
}
export interface CalibrationRun {
  readonly done: Promise<CalibrationSnapshot>;
  calibrateHeldKeys(): Promise<void>;
  finish(): Promise<CalibrationSnapshot>;
}
export interface CalibrationTransport {
  identify(signal: AbortSignal): Promise<void>;
  send(bytes: Uint8Array): Promise<void>;
  receive(signal: AbortSignal): Promise<Uint8Array>;
  unlock(): Promise<CalibrationUnlock>;
  changingCalibration(): void;
}

export const initialCalibration = (): CalibrationSnapshot => ({
  phase: 'preparing', releaseCompleted: false, batches: 0, unlock: 'not-needed', error: null,
});

export function calibrationPacket(action: 'lock' | 'release' | 'press' | 'unlock') {
  const bytes = command(action === 'release' ? 0xdb : action === 'press' ? 0xdd : 0xd9);
  if (action === 'unlock') bytes[2] = 1;
  return bytes;
}

export function validateCalibrationReply(bytes: Uint8Array, expected: 0xda | 0xde) {
  assert(bytes.length === 64 && bytes[0] === 0 && bytes[1] === expected, msg('calibration.unexpectedReply'));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** Owns command ordering and user waits. The host owns the device and exclusivity. */
export function createCalibrationRun(transport: CalibrationTransport, publish: (state: CalibrationSnapshot) => void) {
  const completion = deferred<CalibrationSnapshot>();
  const controller = new AbortController();
  let state = initialCalibration();
  let interruption: Message | null = null;
  let possiblyLocked = false;
  let started = false;
  let ended = false;
  let finishRequested = false;
  let wake: (() => void) | null = null;
  type Action = { kind: 'press'; result: ReturnType<typeof deferred<void>> } | { kind: 'finish' };
  let action: Action | null = null;
  let executing: Action | null = null;
  const update = (patch: Partial<CalibrationSnapshot>) => {
    state = { ...state, ...patch };
    try { publish({ ...state }); }
    catch (error) {
      // A view/subscriber failure must never skip hardware cleanup or strand done.
      interruption ??= msg('calibration.ioError', { detail: error instanceof Error ? error.message : String(error) });
      controller.abort();
    }
  };
  const interrupted = () => new ProtocolError(interruption ?? msg('calibration.interrupted'));
  function check() { if (controller.signal.aborted) throw interrupted(); }
  async function abortable<T>(task: Promise<T>): Promise<T> {
    // Attach handlers even if interruption raced the start of the task.
    let cancel: () => void = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      cancel = () => reject(interrupted());
      controller.signal.addEventListener('abort', cancel, { once: true });
      if (controller.signal.aborted) cancel();
    });
    try {
      const value = await Promise.race([task, cancelled]);
      check();
      return value;
    } finally { controller.signal.removeEventListener('abort', cancel); }
  }
  async function send(kind: 'lock' | 'release' | 'press') {
    check();
    await abortable(transport.send(calibrationPacket(kind)));
  }
  async function calibrate(kind: 'release' | 'press') {
    check();
    transport.changingCalibration();
    await send(kind);
    const reply = await abortable(transport.receive(controller.signal));
    validateCalibrationReply(reply, kind === 'release' ? 0xda : 0xde);
  }
  const run: CalibrationRun = {
    done: completion.promise,
    calibrateHeldKeys() {
      if (ended || controller.signal.aborted || state.phase !== 'awaiting-held-keys' || action || finishRequested)
        return Promise.reject(new ProtocolError(msg('calibration.busy')));
      const result = deferred<void>();
      action = { kind: 'press', result };
      update({ phase: 'calibrating-press' });
      wake?.();
      return result.promise;
    },
    finish() {
      if (ended || finishRequested || controller.signal.aborted) return completion.promise;
      if (state.phase !== 'awaiting-held-keys' || action)
        return Promise.reject(new ProtocolError(msg('calibration.busy')));
      finishRequested = true;
      action = { kind: 'finish' };
      update({ phase: 'unlocking' });
      wake?.();
      return completion.promise;
    },
  };
  return {
    run,
    interrupt(reason: Message = msg('calibration.interrupted')) {
      if (ended || controller.signal.aborted) return;
      interruption = reason;
      controller.abort();
      wake?.();
    },
    async execute(): Promise<CalibrationSnapshot> {
      assert(!started, msg('calibration.busy'));
      started = true;
      try {
        check();
        update({ phase: 'identifying' });
        await abortable(transport.identify(controller.signal));
        update({ phase: 'locking' });
        possiblyLocked = true;
        await send('lock');
        update({ phase: 'calibrating-release' });
        await calibrate('release');
        update({ releaseCompleted: true, phase: 'awaiting-held-keys' });
        while (true) {
          check();
          if (!action) await abortable(new Promise<void>((resolve) => { wake = resolve; }));
          wake = null;
          check();
          executing = action;
          action = null;
          if (!executing || executing.kind === 'finish') break;
          await calibrate('press');
          const finished = executing;
          executing = null;
          update({ batches: state.batches + 1, phase: 'awaiting-held-keys' });
          finished.result.resolve();
        }
      } catch (error) {
        const description = interruption ?? (error instanceof ProtocolError ? error.description :
          msg('calibration.ioError', { detail: error instanceof Error ? error.message : String(error) }));
        update({ error: description });
        if (executing?.kind === 'press') executing.result.reject(new ProtocolError(description));
        if (action?.kind === 'press') action.result.reject(new ProtocolError(description));
        action = null;
      } finally {
        if (possiblyLocked) {
          update({ phase: 'unlocking' });
          let unlock: CalibrationUnlock;
          try { unlock = await transport.unlock(); }
          catch { unlock = 'unknown'; }
          update({ unlock, error: state.error ?? (unlock === 'sent' ? null : msg('calibration.unlockUncertain')) });
        }
        // Interruption during terminal cleanup must not turn into a successful run.
        if (interruption && !state.error) update({ error: interruption });
        ended = true;
        update({ phase: state.error ? 'failed' : 'testing' });
        completion.resolve({ ...state });
      }
      return { ...state };
    },
  };
}

export interface CalibrationCapture {
  format: 'niz-calibration-capture';
  schema: 1;
  model: string;
  target: CalibrationTarget;
  vendorId: number;
  productId: number;
  descriptor: HIDCollection[];
  createdAt: string;
  truncated: boolean;
  entries: { sequence: number; elapsedMs: number; phase: CalibrationPhase; event: PacketObservation['event']; reportId: number; bytes: string }[];
  outcome: CalibrationSnapshot | null;
}

/** Explicit opt-in, bounded, and independent of keymap diagnostic formats. */
export function calibrationRecorder(
  target: CalibrationTarget,
  device: { vendorId: number; productId: number; collections: HIDCollection[] },
) {
  const start = performance.now();
  let sequence = 0;
  const capture: CalibrationCapture = {
    format: 'niz-calibration-capture', schema: 1, model: target.model, target: { ...target },
    vendorId: device.vendorId, productId: device.productId,
    descriptor: structuredClone(device.collections), createdAt: new Date().toISOString(),
    truncated: false, entries: [], outcome: null,
  };
  return {
    record(observation: PacketObservation, phase: CalibrationPhase) {
      if (capture.entries.length === 256) { capture.entries.shift(); capture.truncated = true; }
      capture.entries.push({ sequence: ++sequence, elapsedMs: performance.now() - start, phase,
        event: observation.event, reportId: observation.reportId, bytes: hex(observation.bytes) });
    },
    finish(outcome: CalibrationSnapshot) { capture.outcome = { ...outcome }; },
    snapshot(): CalibrationCapture { return structuredClone(capture); },
  };
}
