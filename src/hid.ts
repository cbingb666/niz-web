import { msg, renderMessage, type Message } from './i18n/core.ts';
import {
  defaultModel,
  supportedModels,
  deviceModels,
  deviceFilters,
  identifyModel,
  type KeyboardModel,
} from './devices/index';
import type { DeviceIdentity } from './protocol';
import {
  createCalibrationRun, calibrationPacket, calibrationRecorder, initialCalibration,
  type CalibrationAvailability, type CalibrationTarget, type CalibrationRun,
  type CalibrationSnapshot, type CalibrationCapture,
} from './calibration';
import type {
  ConfigDevice,
  HIDAccess,
  HIDCollection,
  HIDConnectionEvent,
  HIDInputReportEvent,
  ConnectionState,
  OperationProgress,
  TransferProgress,
  PacketObservation,
} from './types/hid';
import {
  MAX_REPORTS,
  Profile,
  ProtocolError,
  assert,
  command,
  equalBytes,
  makeCapture,
} from './protocol';

export function isConfigDevice(device: ConfigDevice, models = supportedModels) {
  return deviceModels(device, models).length > 0;
}
export function validateDescriptor(device: ConfigDevice, models = supportedModels) {
  const candidates = deviceModels(device, models);
  assert(candidates.length, msg('error.configDevice'));
  const collections: HIDCollection[] = [];
  function visit(c: HIDCollection) {
    collections.push(c);
    (c.children ?? []).forEach(visit);
  }
  const filters = deviceFilters(candidates).filter((filter) =>
    filter.vendorId === device.vendorId && filter.productId === device.productId,
  );
  device.collections.filter((c) => filters.some((filter) =>
    c.usagePage === filter.usagePage && c.usage === filter.usage,
  )).forEach(visit);
  for (const kind of ['inputReports', 'outputReports'] as const) {
    const reports = collections.flatMap((c) => c[kind] ?? []);
    const matching = reports.find(
      (r) =>
        r.reportId === 0 && (r.items ?? []).reduce((n, i) => n + i.reportSize * i.reportCount, 0) === 512,
    );
    assert(matching, msg('error.descriptor'));
  }
}
const calibrationCleanupToken = Symbol('calibration cleanup');
export class PacketChannel {
  device: ConfigDevice;
  timeout: number;
  private sendTimeout: number;
  private inFlight = 0;
  private observers = new Set<(event: PacketObservation) => void>();
  queue: Uint8Array[];
  waiter: {
    resolve: (bytes: Uint8Array) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    cleanup: () => void;
  } | null;
  failure: Error | null;
  listener: (event: Event) => void;
  constructor(device: ConfigDevice, { timeout = 2500, sendTimeout = 5000 } = {}) {
    this.device = device;
    this.timeout = timeout;
    this.sendTimeout = sendTimeout;
    this.queue = [];
    this.waiter = null;
    this.failure = null;
    this.listener = (rawEvent) => {
      const event = rawEvent as HIDInputReportEvent;
      if (event.device !== this.device) return;
      const bytes = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength).slice();
      this.observe({ event: 'rx', reportId: event.reportId, bytes });
      if (event.reportId !== 0) return;
      if (bytes.length !== 64) {
        this.fail(new ProtocolError(msg('error.inputLength', { length: bytes.length })));
        return;
      }
      if (this.waiter) {
        const waiter = this.waiter;
        this.waiter = null;
        clearTimeout(waiter.timer);
        waiter.cleanup();
        waiter.resolve(bytes);
      } else if (this.queue.length < MAX_REPORTS + 8) this.queue.push(bytes);
      else this.fail(new ProtocolError(msg('error.deviceOverflow')));
    };
    device.addEventListener('inputreport', this.listener);
  }
  reset() {
    if (this.failure) throw this.failure;
    assert(!this.waiter, msg('error.overlap'));
    this.queue.length = 0;
  }
  fail(error: Error) {
    this.failure = error;
    this.queue.length = 0;
    if (this.waiter) {
      clearTimeout(this.waiter.timer);
      this.waiter.cleanup();
      this.waiter.reject(error);
      this.waiter = null;
    }
  }
  close() {
    this.device.removeEventListener('inputreport', this.listener);
    this.fail(new ProtocolError(msg('error.disconnected')));
  }
  get sending() { return this.inFlight > 0; }
  watch(observer: (event: PacketObservation) => void) {
    this.observers.add(observer);
    return () => { this.observers.delete(observer); };
  }
  private observe(event: PacketObservation) {
    this.observers.forEach(observer => observer({ ...event, bytes: event.bytes.slice() }));
  }
  async send(bytes: Uint8Array) {
    if (this.failure) throw this.failure;
    await this.transmit(bytes);
  }
  // Only HIDSession's owned terminal cleanup can cross a failed channel.
  async unlockCalibration(token: typeof calibrationCleanupToken) {
    assert(token === calibrationCleanupToken && !this.sending, msg('calibration.unlockUncertain'));
    await this.transmit(calibrationPacket('unlock'));
  }
  private async transmit(bytes: Uint8Array) {
    assert(this.device.opened && bytes instanceof Uint8Array && bytes.length === 64, msg('error.output'));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      this.observe({ event: 'tx-start', reportId: 0, bytes });
      this.inFlight++;
      let raw: Promise<void>;
      try { raw = this.device.sendReport(0, bytes); }
      catch (error) {
        this.inFlight--;
        this.observe({ event: 'tx-rejected', reportId: 0, bytes });
        throw error;
      }
      const sending = raw.then(() => {
        this.inFlight--;
        this.observe({ event: 'tx-sent', reportId: 0, bytes });
      }, (error: unknown) => {
        this.inFlight--;
        this.observe({ event: 'tx-rejected', reportId: 0, bytes });
        throw error;
      });
      await Promise.race([
        sending,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            this.observe({ event: 'tx-timeout', reportId: 0, bytes });
            reject(new ProtocolError(msg('error.sendTimeout')));
          }, this.sendTimeout);
        }),
      ]);
    } catch (cause) {
      const error = protocolError(cause);
      this.fail(error);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  receive({ timeout = this.timeout, signal, timeoutMessage = msg('error.receiveTimeout') }: {
    timeout?: number; signal?: AbortSignal; timeoutMessage?: Message;
  } = {}): Promise<Uint8Array> {
    if (this.failure) return Promise.reject(this.failure);
    if (signal?.aborted) return Promise.reject(new ProtocolError(msg('calibration.interrupted')));
    if (this.queue.length) return Promise.resolve(this.queue.shift()!);
    assert(!this.waiter, msg('error.parallelRead'));
    return new Promise((resolve, reject) => {
      const cleanup = () => signal?.removeEventListener('abort', cancel);
      const cancel = () => {
        clearTimeout(timer);
        cleanup();
        this.waiter = null;
        reject(new ProtocolError(msg('calibration.interrupted')));
      };
      const timer = setTimeout(() => {
        this.waiter = null;
        cleanup();
        reject(new ProtocolError(timeoutMessage));
      }, timeout);
      this.waiter = { resolve, reject, timer, cleanup };
      signal?.addEventListener('abort', cancel, { once: true });
    });
  }
}
export async function readVersion(channel: PacketChannel, signal?: AbortSignal) {
  assert(!signal?.aborted, msg('calibration.interrupted'));
  channel.reset();
  await channel.send(command(0xf9));
  const r = await channel.receive({ signal });
  assert(r[0] === 0 && r[1] === 0xf9, msg('error.versionResponse'));
  const end = r.indexOf(0, 2),
    version = new TextDecoder().decode(r.slice(2, end === -1 ? 64 : end));
  assert(version.length > 0, msg('error.versionResponse'));
  return version;
}
export async function readKeyReports(
  channel: PacketChannel,
  onProgress: (packets: number) => void = () => {},
  model: KeyboardModel = defaultModel,
) {
  channel.reset();
  onProgress(0);
  await channel.send(command(0xf2));
  const reports = [],
    deadline = Date.now() + 30000;
  try {
    while (reports.length <= MAX_REPORTS && Date.now() < deadline) {
      const r = await channel.receive();
      if (r[0] === 0xf6) {
        onProgress(reports.length);
        return reports;
      }
      assert(reports.length < MAX_REPORTS, msg('error.streamLimit'));
      assert(r[0] === 0 && r[1] === 0xf0, msg('error.unknownPacket'));
      reports.push(r);
      if (reports.length === 1 || reports.length % model.keyCount === 0) onProgress(reports.length);
    }
    throw new ProtocolError(msg('error.streamEnd'));
  } catch (cause) {
    const error = protocolError(cause);
    error.rawReports = reports;
    throw error;
  }
}
export async function readBytes(
  channel: PacketChannel,
  op: number,
  type: number,
  expected: number,
  onProgress: (progress: TransferProgress) => void = () => {},
) {
  channel.reset();
  onProgress({ completed: 0, total: expected, unit: 'bytes' });
  await channel.send(command(op));
  const data = [];
  for (let i = 0; i < 64; i++) {
    const r = await channel.receive();
    if (r[1] === 0xe6) {
      assert(data.length === expected, msg('error.dataLength'));
      return Uint8Array.from(data);
    }
    assert(
      r[0] === 0 && r[1] === type && r[2] >= 1 && r[2] <= 61 && data.length + r[2] <= expected,
      msg('error.dataStructure'),
    );
    data.push(...r.slice(3, 3 + r[2]));
    onProgress({ completed: data.length, total: expected, unit: 'bytes' });
  }
  throw new ProtocolError(msg('error.dataEnd'));
}
export async function readCounters(
  channel: PacketChannel,
  model: KeyboardModel = defaultModel,
  onProgress: (progress: TransferProgress) => void = () => {},
) {
  const b = await readBytes(channel, 0xe3, 0xe3, model.keyCount * 4, onProgress);
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return Array.from({ length: model.keyCount }, (_, i) => view.getUint32(i * 4, true));
}
export async function writeKeyReports(
  channel: PacketChannel,
  reports: Uint8Array[],
  onProgress: (progress: TransferProgress) => void = () => {},
) {
  channel.reset();
  onProgress({ completed: 0, total: reports.length, unit: 'packets' });
  await channel.send(command(0xf1));
  for (let i = 0; i < reports.length; i++) {
    await channel.send(reports[i]);
    if (i === 0 || (i + 1) % 20 === 0 || i + 1 === reports.length)
      onProgress({ completed: i + 1, total: reports.length, unit: 'packets' });
    await new Promise((resolve) => setTimeout(resolve, 3));
  }
  const end = new Uint8Array(64).fill(0xf6);
  end[0] = 0;
  await channel.send(end);
  await new Promise((resolve) => setTimeout(resolve, 300));
}
export async function writeLights(
  channel: PacketChannel,
  data: Uint8Array,
  model: KeyboardModel = defaultModel,
  onProgress: (progress: TransferProgress) => void = () => {},
) {
  assert(data instanceof Uint8Array && data.length === model.keyCount * 3, msg('error.rgbLength'));
  channel.reset();
  onProgress({ completed: 0, total: data.length, unit: 'bytes' });
  await channel.send(command(0xe1));
  for (let offset = 0; offset < data.length; offset += 61) {
    const r = command(0xe0),
      part = data.slice(offset, offset + 61);
    r[2] = part.length;
    r.set(part, 3);
    await channel.send(r);
    onProgress({ completed: offset + part.length, total: data.length, unit: 'bytes' });
    await new Promise((resolve) => setTimeout(resolve, 3));
  }
  await channel.send(new Uint8Array(64).fill(0xe6));
  await new Promise((resolve) => setTimeout(resolve, 300));
}
interface DeviceConnection {
  device: ConfigDevice;
  channel: PacketChannel;
  model: KeyboardModel;
  connectionSource: 'automatic' | 'manual';
  version: string;
  identity: DeviceIdentity;
  epoch: number;
  lastRead: { profile: Profile; epoch: number; device: ConfigDevice } | null;
  lastCapture: ReturnType<typeof makeCapture> | null;
}
export interface ConnectedHIDDevice {
  id: string;
  epoch: number;
  number: number;
  vendorId: number;
  productId: number;
  model: KeyboardModel;
  product: string;
  version: string;
  hasLiveBaseline: boolean;
  calibration: CalibrationAvailability;
}
export class HIDSession extends EventTarget {
  activeDeviceId: string | null = null;
  private connections = new Map<string, DeviceConnection>();
  private deviceIds = new WeakMap<ConfigDevice, string>();
  private knownDeviceIds = new Set<string>();
  private ignoredDevices = new WeakSet<ConfigDevice>();
  private deviceSequence = 0;
  private epochSequence = 0;
  private openingChannel: PacketChannel | null = null;
  private calibrationTargets = new WeakMap<CalibrationTarget, DeviceConnection>();
  private calibrationCaptures = new Map<string, CalibrationCapture>();
  private calibrationOwner: {
    target: CalibrationTarget;
    record: DeviceConnection;
    engine: ReturnType<typeof createCalibrationRun>;
    run: CalibrationRun;
  } | null = null;
  private calibrationTimeout: number;
  private sendTimeout: number;
  readonly models: readonly KeyboardModel[];
  model: KeyboardModel | null = null;
  connectionSource: 'automatic' | 'manual' | null = null;
  hid: HIDAccess | null;
  timeout: number;
  retryMs: number;
  device: ConfigDevice | null;
  channel: PacketChannel | null;
  state: ConnectionState;
  version: string;
  identity: DeviceIdentity;
  pending: number;
  tail: Promise<unknown>;
  epoch: number;
  lastRead: { profile: Profile; epoch: number; device: ConfigDevice } | null;
  lastCapture: ReturnType<typeof makeCapture> | null;
  paused: boolean;
  stopped: boolean;
  authorizing: boolean;
  statusMessage: Message = '';
  get message(): string {
    return renderMessage(this.statusMessage);
  }
  timer?: ReturnType<typeof setInterval>;
  connectedListener: () => void;
  disconnectedListener: (event: Event) => void;
  private started = false;
  constructor(hid: HIDAccess | null, {
    timeout = 2500, retryMs = 2500, models = supportedModels,
    calibrationTimeout = 10000, sendTimeout = 5000,
  } = {}) {
    super();
    this.models = models;
    this.hid = hid;
    this.timeout = timeout;
    this.retryMs = retryMs;
    this.calibrationTimeout = calibrationTimeout;
    this.sendTimeout = sendTimeout;
    this.device = null;
    this.channel = null;
    this.state = 'waiting';
    this.version = '';
    this.identity = {};
    this.pending = 0;
    this.tail = Promise.resolve();
    this.epoch = 0;
    this.lastRead = null;
    this.lastCapture = null;
    this.paused = false;
    this.stopped = false;
    this.authorizing = false;
    this.connectedListener = () => {
      if (!this.paused) this.restore().catch(() => {});
    };
    this.disconnectedListener = (event) => {
      const device = (event as HIDConnectionEvent).device;
      if (this.calibrationOwner?.record.device === device) this.calibrationOwner.engine.interrupt();
      if (device === this.device) this.drop(msg('hid.unplugged'));
      else {
        const id = this.deviceIds.get(device);
        if (id) {
          this.connections.get(id)?.channel.close();
          this.connections.delete(id);
          this.notify();
        }
      }
    };
  }
  private rememberActive() {
    const record = this.activeDeviceId ? this.connections.get(this.activeDeviceId) : undefined;
    if (record && record.device === this.device) {
      record.lastRead = this.lastRead;
      record.lastCapture = this.lastCapture;
      record.epoch = this.epoch;
    }
  }
  get connectedDevices(): ConnectedHIDDevice[] {
    this.rememberActive();
    return [...this.connections].filter(([, record]) => record.device.opened).map(([id, record]) => ({
      id,
      epoch: record.epoch,
      number: Number(id.slice('device-'.length)),
      vendorId: record.device.vendorId,
      productId: record.device.productId,
      model: record.model,
      product: String(record.identity.Product ?? record.model.name),
      version: record.version,
      hasLiveBaseline: record.lastRead?.epoch === record.epoch && record.lastRead.device === record.device,
      calibration: this.calibrationAvailability(record),
    }));
  }
  private calibrationAvailability(record: DeviceConnection): CalibrationAvailability {
    const match = record.model.calibration?.find(candidate =>
      candidate.vendorId === record.device.vendorId && candidate.productId === record.device.productId &&
      candidate.version === record.version);
    if (!match) return 'unsupported';
    try { validateDescriptor(record.device, [record.model]); }
    catch { return 'unsupported'; }
    return 'available';
  }
  calibrationTarget(id: string): CalibrationTarget {
    const record = this.connections.get(id);
    assert(record?.device.opened && !this.stopped, msg('calibration.changed'));
    const availability = this.calibrationAvailability(record);
    assert(availability === 'available', msg('calibration.unsupported'));
    const target = Object.freeze({ id, number: Number(id.slice('device-'.length)),
      name: record.device.productName || record.model.name, model: record.model.id,
      version: record.version, epoch: record.epoch });
    this.calibrationTargets.set(target, record);
    return target;
  }
  calibrationCapture(id: string): CalibrationCapture | null {
    const capture = this.calibrationCaptures.get(id);
    return capture ? structuredClone(capture) : null;
  }
  beginCalibration(
    target: CalibrationTarget,
    onUpdate: (state: CalibrationSnapshot) => void,
    { recordTrace = false } = {},
  ): CalibrationRun {
    assert(!this.pending && !this.authorizing && !this.calibrationOwner && !this.stopped, msg('calibration.busy'));
    const record = this.calibrationTargets.get(target);
    assert(record && this.connections.get(target.id) === record, msg('calibration.changed'));
    const checkTarget = () => {
      assert(!this.stopped && this.connections.get(target.id) === record &&
        record.epoch === target.epoch && record.device.opened && record.version === target.version,
      msg('calibration.changed'));
      const availability = this.calibrationAvailability(record);
      assert(availability === 'available', msg('calibration.unsupported'));
    };
    checkTarget();
    // A confirmation target is single-use, even if a later attempt fails.
    this.calibrationTargets.delete(target);
    const channel = record.channel;
    let current = initialCalibration();
    const recorder = recordTrace ? calibrationRecorder(target, record.device) : null;
    this.calibrationCaptures.delete(target.id);
    const unwatch = channel.watch(event => {
      recorder?.record(event, current.phase);
      if (event.event === 'rx' && event.reportId === 0 && current.phase === 'awaiting-held-keys')
        engine.interrupt(msg('calibration.unexpectedReply'));
    });
    let unlockAttempted = false;
    const engine = createCalibrationRun({
      identify: async signal => {
        checkTarget();
        const version = await readVersion(channel, signal);
        checkTarget();
        assert(version === target.version && identifyModel(record.device, version, this.models)?.id === record.model.id,
          msg('calibration.changed'));
      },
      send: async bytes => {
        checkTarget();
        assert(!channel.queue.length && !channel.waiter, msg('calibration.unexpectedReply'));
        await channel.send(bytes);
      },
      receive: signal => channel.receive({ signal, timeout: this.calibrationTimeout, timeoutMessage: msg('calibration.timeout') }),
      changingCalibration: () => {
        checkTarget();
        record.lastRead = null;
        if (this.activeDeviceId === target.id && this.device === record.device) this.lastRead = null;
        this.notify();
      },
      unlock: async () => {
        if (unlockAttempted || this.connections.get(target.id) !== record || record.epoch !== target.epoch ||
          !record.device.opened || channel.sending) return 'unknown';
        unlockAttempted = true;
        try {
          await channel.unlockCalibration(calibrationCleanupToken);
          return this.connections.get(target.id) === record && record.epoch === target.epoch && record.device.opened ? 'sent' : 'unknown';
        } catch { return channel.sending ? 'unknown' : 'failed'; }
      },
    }, state => {
      current = state;
      if (state.phase === 'awaiting-held-keys' && (channel.failure || channel.queue.length))
        engine.interrupt(msg('calibration.unexpectedReply'));
      onUpdate(state);
    });
    // Install ownership before exclusive() notifies store subscribers.
    const owner = { target, record, engine, run: engine.run };
    this.calibrationOwner = owner;
    const done = this.exclusive(async () => {
      try {
        const result = await engine.execute();
        if (result.error) this.retireCalibrationConnection(target, record);
        recorder?.finish(result);
        if (recorder) this.calibrationCaptures.set(target.id, recorder.snapshot());
        return result;
      } finally {
        unwatch();
        if (this.calibrationOwner === owner) this.calibrationOwner = null;
      }
    });
    const run: CalibrationRun = {
      done,
      calibrateHeldKeys: () => engine.run.calibrateHeldKeys(),
      finish: async () => { await engine.run.finish(); return done; },
    };
    owner.run = run;
    return run;
  }
  private retireCalibrationConnection(target: CalibrationTarget, record: DeviceConnection) {
    this.ignoredDevices.add(record.device);
    record.lastRead = null;
    if (this.connections.get(target.id) === record) {
      if (this.activeDeviceId === target.id && this.device === record.device) this.drop(msg('calibration.interrupted'));
      else { this.connections.delete(target.id); record.channel.close(); this.notify(); }
    }
    if (record.device.opened) void record.device.close().catch(() => {});
  }
  selectDevice(id: string, allowDisconnected = false): boolean {
    if (this.pending || this.authorizing || this.stopped) return false;
    const record = this.connections.get(id);
    if (!record?.device.opened) {
      if (!allowDisconnected || !this.knownDeviceIds.has(id)) return false;
      this.rememberActive();
      this.activeDeviceId = id;
      this.device = null;
      this.channel = null;
      this.model = null;
      this.connectionSource = null;
      this.version = '';
      this.identity = {};
      this.lastRead = null;
      this.lastCapture = null;
      this.epochSequence = Math.max(this.epochSequence, this.epoch) + 1;
      this.epoch = this.epochSequence;
      this.setState('waiting', msg('hid.unplugged'));
      return true;
    }
    if (id !== this.activeDeviceId || !this.connected) this.activate(id, record);
    return true;
  }
  private activate(id: string, record: DeviceConnection) {
    this.rememberActive();
    this.activeDeviceId = id;
    Object.assign(this, record);
    this.setState('connected', msg('hid.connected'));
  }
  notify() {
    this.rememberActive();
    this.dispatchEvent(new Event('change'));
  }
  setState(state: ConnectionState, message: Message) {
    this.state = state;
    this.statusMessage = message;
    this.notify();
  }
  get connected() {
    return this.state === 'connected' && !!this.device?.opened;
  }
  get hasLiveBaseline() {
    return this.connected && this.lastRead?.epoch === this.epoch && this.lastRead.device === this.device;
  }
  async start() {
    if (this.started || this.stopped) return;
    this.started = true;
    if (!this.hid) {
      this.setState('unsupported', msg('hid.unsupported'));
      return;
    }
    this.hid.addEventListener('connect', this.connectedListener);
    this.hid.addEventListener('disconnect', this.disconnectedListener);
    await this.restore();
    if (!this.stopped)
      this.timer = setInterval(() => {
        if (!this.device && !this.connections.size && !this.paused) this.restore().catch(() => {});
      }, this.retryMs);
  }
  async stop() {
    this.stopped = true;
    clearInterval(this.timer);
    const calibration = this.calibrationOwner;
    if (calibration) {
      calibration.engine.interrupt();
      await calibration.run.done;
    }
    this.hid?.removeEventListener('connect', this.connectedListener);
    this.hid?.removeEventListener('disconnect', this.disconnectedListener);
    this.openingChannel?.close();
    const connections = [...this.connections.values()];
    this.drop(msg('hid.disconnected'));
    this.connections.clear();
    await Promise.all(connections.map(async ({ device, channel }) => {
      channel.close();
      if (device.opened) await device.close().catch(() => {});
    }));
    this.notify();
  }
  exclusive<T>(operation: () => Promise<T>): Promise<T> {
    this.pending++;
    this.notify();
    const task = this.tail.then(operation);
    this.tail = task.catch(() => {});
    return task.finally(() => {
      this.pending--;
      this.notify();
    });
  }
  async restore() {
    if (!this.hid || this.stopped || this.pending || this.paused || this.authorizing) return;
    const hid = this.hid;
    return this.exclusive(async () => {
      try {
        const devices = (await hid.getDevices()).filter((device) =>
          isConfigDevice(device, this.models) && !this.ignoredDevices.has(device));
        if (this.stopped || this.paused) return;
        for (const device of devices) {
          if (this.stopped || this.paused) return;
          try { await this.open(device, 'automatic'); }
          catch (error) {
            if (!this.connected) this.setState('error', protocolError(error).description);
          }
        }
        if (!devices.length && !this.connected) this.setState('waiting', msg('hid.unauthorized'));
      } catch (error) {
        if (!this.connected) this.setState('error', protocolError(error).description);
      }
    });
  }
  async authorize(): Promise<string | null> {
    assert(this.hid, msg('error.unsupportedHid'));
    assert(!this.stopped, msg('error.connectionInterrupted'));
    assert(!this.pending && !this.authorizing, msg('error.deviceBusy'));
    this.authorizing = true;
    this.setState(this.connected ? 'connected' : 'authorizing', msg('hid.authorizing'));
    try {
      // Called directly by the button handler, before yielding user activation.
      const selected = await this.hid.requestDevice({
        filters: deviceFilters(this.models),
      });
      assert(!this.stopped, msg('error.connectionInterrupted'));
      const devices = selected.filter((device) => isConfigDevice(device, this.models));
      if (!devices.length) {
        this.setState(this.connected ? 'connected' : 'waiting', msg('hid.cancelled'));
        return null;
      }
      assert(devices.length === 1, msg('error.multipleInterfaces'));
      this.paused = false;
      this.ignoredDevices.delete(devices[0]);
      const id = await this.exclusive(() => this.open(devices[0]));
      if (this.connected) this.setState('connected', msg('hid.connected'));
      return id;
    } catch (error) {
      this.setState(this.connected ? 'connected' : 'error', protocolError(error).description);
      throw error;
    } finally {
      this.authorizing = false;
      this.notify();
    }
  }
  async open(device: ConfigDevice, source: 'automatic' | 'manual' = 'manual'): Promise<string> {
    assert(!this.calibrationOwner, msg('calibration.busy'));
    validateDescriptor(device, this.models);
    let id = this.deviceIds.get(device);
    if (id && this.connections.has(id) && device.opened) return id;
    if (!id) {
      id = `device-${++this.deviceSequence}`;
      this.deviceIds.set(device, id);
      this.knownDeviceIds.add(id);
    }
    this.connections.get(id)?.channel.close();
    this.connections.delete(id);
    if (!this.connected) this.setState('connecting', msg('hid.connecting'));
    let channel: PacketChannel | null = null;
    try {
      if (!device.opened) await device.open();
      assert(!this.stopped, msg('error.connectionInterrupted'));
      channel = new PacketChannel(device, { timeout: this.timeout, sendTimeout: this.sendTimeout });
      this.openingChannel = channel;
      const version = await readVersion(channel);
      assert(device.opened && !this.stopped, msg('error.connectionChanged'));
      const model = identifyModel(device, version, this.models);
      assert(model, msg('error.model'));
      validateDescriptor(device, [model]);
      this.epochSequence = Math.max(this.epochSequence, this.epoch) + 1;
      const record: DeviceConnection = {
        device, channel, model, connectionSource: source, version,
        identity: {
          Product: device.productName || model.name,
          VendorID: device.vendorId,
          ProductID: device.productId,
        },
        epoch: this.epochSequence, lastRead: null, lastCapture: null,
      };
      this.connections.set(id, record);
      // Adding a keyboard must not switch the editor or close another keyboard.
      if (!this.activeDeviceId || this.activeDeviceId === id) this.activate(id, record);
      else if (!this.connected) this.setState('waiting', msg('hid.unplugged'));
      else this.notify();
      return id;
    } catch (error) {
      channel?.close();
      if (device.opened) await device.close().catch(() => {});
      if (!this.connected) this.setState('error', msg('error.closeNative', { error: protocolError(error).description }));
      throw error;
    } finally {
      this.openingChannel = null;
    }
  }
  drop(message: Message) {
    if (this.calibrationOwner?.record.device === this.device) this.calibrationOwner.engine.interrupt();
    this.epochSequence = Math.max(this.epochSequence, this.epoch) + 1;
    this.epoch = this.epochSequence;
    if (this.activeDeviceId) this.connections.delete(this.activeDeviceId);
    this.lastRead = null;
    this.channel?.close();
    this.channel = null;
    this.device = null;
    this.version = '';
    this.model = null;
    this.connectionSource = null;
    this.identity = {};
    this.setState('waiting', message);
  }
  async disconnect(manual = true, expectedEpoch?: number) {
    assert(!this.calibrationOwner, msg('calibration.busy'));
    const device = this.device;
    await this.exclusive(async () => {
      if (expectedEpoch !== undefined && (this.epoch !== expectedEpoch || this.device !== device)) return;
      if (manual && device) this.ignoredDevices.add(device);
      this.drop(manual ? msg('hid.disconnected') : msg('hid.switching'));
      if (manual) this.paused = this.connections.size === 0;
      if (device?.opened) await device.close().catch(() => {});
      // Closing the channel alone leaves a browser grant that survives reloads.
      if (manual && device) await this.forgetDevice(device);
    });
  }
  async disconnectDevice(id: string, expectedEpoch?: number) {
    assert(!this.calibrationOwner, msg('calibration.busy'));
    if (id === this.activeDeviceId) return this.disconnect(true, expectedEpoch);
    const record = this.connections.get(id);
    if (!record) return;
    await this.exclusive(async () => {
      if (this.connections.get(id) !== record || (expectedEpoch !== undefined && record.epoch !== expectedEpoch)) return;
      this.ignoredDevices.add(record.device);
      this.connections.delete(id);
      record.channel.close();
      if (record.device.opened) await record.device.close().catch(() => {});
      await this.forgetDevice(record.device);
    });
  }
  private async forgetDevice(device: ConfigDevice) {
    assert(device.forget, msg('error.forgetUnsupported'));
    try {
      await device.forget();
    } catch (error) {
      throw new ProtocolError(msg('error.forgetDevice', { error: protocolError(error).description }));
    }
  }
  assertReady(epoch = this.epoch): asserts this is this & {
    channel: PacketChannel; device: ConfigDevice; model: KeyboardModel;
  } {
    assert(this.connected && this.channel && this.model && this.epoch === epoch, msg('error.readRequired'));
  }
  async read(onProgress: (progress: OperationProgress) => void = () => {}) {
    assert(!this.calibrationOwner, msg('calibration.busy'));
    const epoch = this.epoch;
    return this.exclusive(async () => {
      this.assertReady(epoch);
      this.lastRead = null;
      const model = this.model,
        version = this.version,
        identity = { ...this.identity };
      let reports: Uint8Array[] = [];
      try {
        reports = await readKeyReports(this.channel, (completed) => onProgress({
          phase: 'read', transfer: { completed, total: null, unit: 'packets' },
        }), model);
        this.lastCapture = makeCapture(version, identity, reports, '', model);
        const profile = Profile.fromReports(reports, model);
        profile.version = version;
        profile.identity = identity;
        const notes = [];
        const capabilities = model.capabilities(version);
        if (capabilities.counters)
          try {
            profile.counters = await readCounters(this.channel, model, (transfer) =>
              onProgress({ phase: 'counters', transfer }),
            );
          } catch (error) {
            notes.push(msg('error.counterRead', { error: protocolError(error).description }));
          }
        if (capabilities.perKeyRGB)
          try {
            profile.lights = await readBytes(this.channel, 0xe2, 0xe0, model.keyCount * 3, (transfer) =>
              onProgress({ phase: 'readLights', transfer }),
            );
          } catch (error) {
            notes.push(msg('error.lightingRead', { error: protocolError(error).description }));
          }
        this.assertReady(epoch);
        this.lastRead = { profile: profile.clone(), epoch, device: this.device };
        return { profile, notes };
      } catch (error) {
        const details = protocolError(error);
        this.lastCapture = makeCapture(
          version,
          identity,
          details.rawReports ?? reports,
          details.message,
          model,
        );
        // Connection is intentionally independent of whether the keymap parses.
        throw error;
      }
    });
  }
  async write(
    desired: Profile,
    saveBackup: (profile: Profile, reason: string) => Promise<string>,
    onProgress: (progress: OperationProgress) => void = () => {},
  ) {
    assert(!this.calibrationOwner, msg('calibration.busy'));
    assert(this.hasLiveBaseline && this.lastRead, msg('error.readBeforeWrite'));
    assert(desired.model.id === this.model?.id, msg('error.modelMismatch'));
    const target = desired.clone(),
      baseline = this.lastRead.profile.clone(),
      epoch = this.epoch;
    target.validateForWriting();
    const targetReports = target.reports;
    const changed = target.differences(baseline),
      lightsChanged = !equalBytes(target.lights, baseline.lights);
    if (!changed.length && !lightsChanged) return { profile: baseline, backupId: null };
    return this.exclusive(async () => {
      this.assertReady(epoch);
      let beganWrite = false;
      let backupId: string | null = null;
      try {
        onProgress({ phase: 'verify' });
        const version = await readVersion(this.channel);
        assert(identifyModel(this.device, version, this.models)?.id === this.model.id, msg('error.model'));
        assert(version === baseline.version && target.version === version, msg('error.firmwareChanged'));
        const model = this.model;
        const current = Profile.fromReports(await readKeyReports(this.channel, (completed) =>
          onProgress({ phase: 'verify', transfer: { completed, total: null, unit: 'packets' } }),
        model), model);
        current.version = version;
        current.identity = { ...this.identity };
        const capabilities = model.capabilities(version);
        if (capabilities.perKeyRGB)
          current.lights = await readBytes(this.channel, 0xe2, 0xe0, model.keyCount * 3, (transfer) =>
            onProgress({ phase: 'readLights', transfer }),
          );
        assert(
          current.differences(baseline).length === 0 &&
            (!lightsChanged || equalBytes(current.lights, baseline.lights)),
          msg('error.externalChanges'),
        );
        assert(
          !lightsChanged || (capabilities.perKeyRGB && target.lights?.length === model.keyCount * 3),
          msg('error.unsupportedLights'),
        );
        if (!lightsChanged) target.lights = current.lights?.slice() ?? null;
        onProgress({ phase: 'backup' });
        backupId = await saveBackup(current, '写入前');
        assert(backupId, msg('error.backupRequired'));
        this.assertReady(epoch);
        beganWrite = true;
        if (changed.length)
          await writeKeyReports(this.channel, targetReports, (transfer) => {
            onProgress({ phase: 'write', transfer });
            if (transfer.completed === transfer.total) onProgress({ phase: 'settle' });
          });
        if (lightsChanged) {
          assert(target.lights, msg('error.missingRGB'));
          await writeLights(this.channel, target.lights, model, (transfer) => {
            onProgress({ phase: 'writeLights', transfer });
            if (transfer.completed === transfer.total) onProgress({ phase: 'settle' });
          });
        }
        this.assertReady(epoch);
        const readback = await readKeyReports(this.channel, (completed) => onProgress({
          phase: 'readback',
          transfer: {
            completed,
            // This is the target packet count being verified, not a duration
            // estimate. Unexpected extra packets invalidate that denominator.
            total: completed <= targetReports.length ? targetReports.length : null,
            unit: 'packets',
          },
        }), model);
        onProgress({ phase: 'validate' });
        const verified = Profile.fromReports(readback, model);
        assert(verified.differences(target).length === 0, msg('error.readback'));
        if (lightsChanged) {
          const lights = await readBytes(this.channel, 0xe2, 0xe0, model.keyCount * 3, (transfer) =>
            onProgress({ phase: 'readbackLights', transfer }),
          );
          onProgress({ phase: 'validate' });
          assert(equalBytes(lights, target.lights), msg('error.lightingReadback'));
        }
        this.lastRead = { profile: target.clone(), epoch, device: this.device };
        onProgress({ phase: 'done' });
        return { profile: target, backupId };
      } catch (cause) {
        const error = protocolError(cause);
        if (beganWrite) {
          this.lastRead = null;
          error.append(msg('error.partialWrite'));
        }
        error.backupId = backupId;
        error.beganWrite = beganWrite;
        throw error;
      }
    });
  }
}

export function protocolError(error: unknown): ProtocolError {
  return error instanceof ProtocolError
    ? error
    : new ProtocolError(error instanceof Error ? error.message : String(error));
}
