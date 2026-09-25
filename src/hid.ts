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
import type {
  ConfigDevice,
  HIDAccess,
  HIDCollection,
  HIDConnectionEvent,
  HIDInputReportEvent,
  ConnectionState,
  OperationProgress,
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
export class PacketChannel {
  device: ConfigDevice;
  timeout: number;
  queue: Uint8Array[];
  waiter: {
    resolve: (bytes: Uint8Array) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null;
  failure: Error | null;
  listener: (event: Event) => void;
  constructor(device: ConfigDevice, { timeout = 2500 } = {}) {
    this.device = device;
    this.timeout = timeout;
    this.queue = [];
    this.waiter = null;
    this.failure = null;
    this.listener = (rawEvent) => {
      const event = rawEvent as HIDInputReportEvent;
      if (event.reportId !== 0 || event.device !== this.device) return;
      const bytes = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength).slice();
      if (bytes.length !== 64) {
        this.fail(new ProtocolError(msg('error.inputLength', { length: bytes.length })));
        return;
      }
      if (this.waiter) {
        const waiter = this.waiter;
        this.waiter = null;
        clearTimeout(waiter.timer);
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
      this.waiter.reject(error);
      this.waiter = null;
    }
  }
  close() {
    this.device.removeEventListener('inputreport', this.listener);
    this.fail(new ProtocolError(msg('error.disconnected')));
  }
  async send(bytes: Uint8Array) {
    if (this.failure) throw this.failure;
    assert(this.device.opened && bytes instanceof Uint8Array && bytes.length === 64, msg('error.output'));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.device.sendReport(0, bytes),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new ProtocolError(msg('error.sendTimeout'))), 5000);
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
  receive(): Promise<Uint8Array> {
    if (this.failure) return Promise.reject(this.failure);
    if (this.queue.length) return Promise.resolve(this.queue.shift()!);
    assert(!this.waiter, msg('error.parallelRead'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        reject(new ProtocolError(msg('error.receiveTimeout')));
      }, this.timeout);
      this.waiter = { resolve, reject, timer };
    });
  }
}
export async function readVersion(channel: PacketChannel) {
  channel.reset();
  await channel.send(command(0xf9));
  const r = await channel.receive();
  assert(r[0] === 0 && r[1] === 0xf9, msg('error.versionResponse'));
  const end = r.indexOf(0, 2),
    version = new TextDecoder().decode(r.slice(2, end === -1 ? 64 : end));
  assert(version.length > 0, msg('error.versionResponse'));
  return version;
}
export async function readKeyReports(
  channel: PacketChannel,
  onProgress: (records: number) => void = () => {},
  model: KeyboardModel = defaultModel,
) {
  channel.reset();
  await channel.send(command(0xf2));
  const reports = [],
    deadline = Date.now() + 30000;
  try {
    while (reports.length <= MAX_REPORTS && Date.now() < deadline) {
      const r = await channel.receive();
      if (r[0] === 0xf6) return reports;
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
export async function readBytes(channel: PacketChannel, op: number, type: number, expected: number) {
  channel.reset();
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
  }
  throw new ProtocolError(msg('error.dataEnd'));
}
export async function readCounters(channel: PacketChannel, model: KeyboardModel = defaultModel) {
  const b = await readBytes(channel, 0xe3, 0xe3, model.keyCount * 4);
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return Array.from({ length: model.keyCount }, (_, i) => view.getUint32(i * 4, true));
}
export async function writeKeyReports(
  channel: PacketChannel,
  reports: Uint8Array[],
  onProgress: (value: number) => void = () => {},
) {
  channel.reset();
  await channel.send(command(0xf1));
  for (let i = 0; i < reports.length; i++) {
    await channel.send(reports[i]);
    await new Promise((resolve) => setTimeout(resolve, 3));
    if ((i + 1) % 20 === 0 || i + 1 === reports.length) onProgress((i + 1) / reports.length);
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
) {
  assert(data instanceof Uint8Array && data.length === model.keyCount * 3, msg('error.rgbLength'));
  channel.reset();
  await channel.send(command(0xe1));
  for (let offset = 0; offset < data.length; offset += 61) {
    const r = command(0xe0),
      part = data.slice(offset, offset + 61);
    r[2] = part.length;
    r.set(part, 3);
    await channel.send(r);
    await new Promise((resolve) => setTimeout(resolve, 3));
  }
  await channel.send(new Uint8Array(64).fill(0xe6));
  await new Promise((resolve) => setTimeout(resolve, 300));
}
export class HIDSession extends EventTarget {
  readonly models: readonly KeyboardModel[];
  model: KeyboardModel | null = null;
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
  constructor(hid: HIDAccess | null, { timeout = 2500, retryMs = 2500, models = supportedModels } = {}) {
    super();
    this.models = models;
    this.hid = hid;
    this.timeout = timeout;
    this.retryMs = retryMs;
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
      if ((event as HIDConnectionEvent).device === this.device) this.drop(msg('hid.unplugged'));
    };
  }
  notify() {
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
        if (!this.device && !this.paused) this.restore().catch(() => {});
      }, this.retryMs);
  }
  async stop() {
    this.stopped = true;
    clearInterval(this.timer);
    this.hid?.removeEventListener('connect', this.connectedListener);
    this.hid?.removeEventListener('disconnect', this.disconnectedListener);
    await this.disconnect();
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
    if (!this.hid || this.stopped || this.device || this.pending || this.paused || this.authorizing) return;
    const hid = this.hid;
    return this.exclusive(async () => {
      try {
        const devices = (await hid.getDevices()).filter((device) => isConfigDevice(device, this.models));
        if (this.stopped || this.paused) return;
        if (devices.length === 1) await this.open(devices[0]);
        else if (devices.length > 1) this.setState('waiting', msg('hid.multiple'));
        else this.setState('waiting', msg('hid.unauthorized'));
      } catch (error) {
        this.setState('error', protocolError(error).message);
      }
    });
  }
  async authorize() {
    assert(this.hid, msg('error.unsupportedHid'));
    assert(!this.pending && !this.authorizing, msg('error.deviceBusy'));
    if (this.connected) return;
    this.authorizing = true;
    this.setState('authorizing', msg('hid.authorizing'));
    try {
      // Called directly by the button handler, before yielding user activation.
      const selected = await this.hid.requestDevice({
        filters: deviceFilters(this.models),
      });
      const devices = selected.filter((device) => isConfigDevice(device, this.models));
      if (!devices.length) {
        this.setState('waiting', msg('hid.cancelled'));
        return;
      }
      assert(devices.length === 1, msg('error.multipleInterfaces'));
      this.paused = false;
      await this.exclusive(() => this.open(devices[0]));
    } catch (error) {
      this.setState('error', protocolError(error).message);
      throw error;
    } finally {
      this.authorizing = false;
      this.notify();
    }
  }
  async open(device: ConfigDevice) {
    validateDescriptor(device, this.models);
    if (this.device === device && this.connected) return;
    if (this.device) await this.disconnect(false);
    const generation = ++this.epoch;
    this.device = device;
    this.lastRead = null;
    this.setState('connecting', msg('hid.connecting'));
    try {
      if (!device.opened) await device.open();
      assert(generation === this.epoch && !this.stopped, msg('error.connectionInterrupted'));
      this.channel = new PacketChannel(device, { timeout: this.timeout });
      const version = await readVersion(this.channel);
      assert(generation === this.epoch, msg('error.connectionChanged'));
      const model = identifyModel(device, version, this.models);
      assert(model, msg('error.model'));
      validateDescriptor(device, [model]);
      this.model = model;
      this.version = version;
      this.identity = {
        Product: device.productName || model.name,
        VendorID: device.vendorId,
        ProductID: device.productId,
      };
      this.setState('connected', msg('hid.connected'));
    } catch (error) {
      this.channel?.close();
      this.channel = null;
      this.device = null;
      this.version = '';
      this.model = null;
      this.identity = {};
      if (device.opened) await device.close().catch(() => {});
      this.setState('error', msg('error.closeNative', { error: protocolError(error).description }));
      throw error;
    }
  }
  drop(message: Message) {
    this.epoch++;
    this.lastRead = null;
    this.channel?.close();
    this.channel = null;
    this.device = null;
    this.version = '';
    this.model = null;
    this.identity = {};
    this.setState('waiting', message);
  }
  async disconnect(manual = true) {
    if (manual) this.paused = true;
    const device = this.device;
    this.drop(manual ? msg('hid.disconnected') : msg('hid.switching'));
    if (device?.opened) await device.close().catch(() => {});
  }
  assertReady(epoch = this.epoch): asserts this is this & {
    channel: PacketChannel; device: ConfigDevice; model: KeyboardModel;
  } {
    assert(this.connected && this.channel && this.model && this.epoch === epoch, msg('error.readRequired'));
  }
  async read(onProgress: (progress: OperationProgress) => void = () => {}) {
    const epoch = this.epoch;
    return this.exclusive(async () => {
      this.assertReady(epoch);
      this.lastRead = null;
      const model = this.model,
        version = this.version,
        identity = { ...this.identity };
      let reports: Uint8Array[] = [];
      try {
        reports = await readKeyReports(this.channel, (n) => onProgress({ phase: 'read', records: n }), model);
        this.lastCapture = makeCapture(version, identity, reports, '', model);
        const profile = Profile.fromReports(reports, model);
        profile.version = version;
        profile.identity = identity;
        const notes = [];
        const capabilities = model.capabilities(version);
        if (capabilities.counters)
          try {
            profile.counters = await readCounters(this.channel, model);
          } catch (error) {
            notes.push(msg('error.counterRead', { error: protocolError(error).description }));
          }
        if (capabilities.perKeyRGB)
          try {
            profile.lights = await readBytes(this.channel, 0xe2, 0xe0, model.keyCount * 3);
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
    assert(this.hasLiveBaseline && this.lastRead, msg('error.readBeforeWrite'));
    assert(desired.model.id === this.model?.id, msg('error.modelMismatch'));
    const target = desired.clone(),
      baseline = this.lastRead.profile.clone(),
      epoch = this.epoch;
    target.validateForWriting();
    const changed = target.differences(baseline),
      lightsChanged = !equalBytes(target.lights, baseline.lights);
    if (!changed.length && !lightsChanged) return { profile: baseline, backupId: null };
    return this.exclusive(async () => {
      this.assertReady(epoch);
      let beganWrite = false;
      let backupId: string | null = null;
      try {
        onProgress({ phase: 'verify', value: 5 });
        const version = await readVersion(this.channel);
        assert(identifyModel(this.device, version, this.models)?.id === this.model.id, msg('error.model'));
        assert(version === baseline.version && target.version === version, msg('error.firmwareChanged'));
        const model = this.model;
        const current = Profile.fromReports(await readKeyReports(this.channel, undefined, model), model);
        current.version = version;
        current.identity = { ...this.identity };
        const capabilities = model.capabilities(version);
        if (capabilities.perKeyRGB)
          current.lights = await readBytes(this.channel, 0xe2, 0xe0, model.keyCount * 3);
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
        backupId = await saveBackup(current, '写入前');
        assert(backupId, msg('error.backupRequired'));
        this.assertReady(epoch);
        beganWrite = true;
        if (changed.length)
          await writeKeyReports(this.channel, target.reports, (value) =>
            onProgress({ phase: 'write', value: 15 + value * 65 }),
          );
        if (lightsChanged) {
          assert(target.lights, msg('error.missingRGB'));
          await writeLights(this.channel, target.lights, model);
        }
        this.assertReady(epoch);
        onProgress({ phase: 'readback', value: 85 });
        const verified = Profile.fromReports(await readKeyReports(this.channel, undefined, model), model);
        assert(verified.differences(target).length === 0, msg('error.readback'));
        if (lightsChanged)
          assert(
            equalBytes(await readBytes(this.channel, 0xe2, 0xe0, model.keyCount * 3), target.lights),
            msg('error.lightingReadback'),
          );
        this.lastRead = { profile: target.clone(), epoch, device: this.device };
        onProgress({ phase: 'done', value: 100 });
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
