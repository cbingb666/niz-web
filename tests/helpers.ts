import type { ConfigDevice, HIDAccess, HIDCollection } from '../src/types/hid';
import type { HIDSession } from '../src/hid';
import type { KeyDefinition } from '../src/protocol';
import { Profile, demoProfile, encodeDefinition, command } from '../src/protocol';

export function fixture(groups = 3, rgb = false) {
  const profile = demoProfile();
  profile.version = rgb ? '66EC(XRGB);V1.4.4;V1.0;' : '66EC(S);V1.4.4;V1.0;';
  profile.identity = { Product: 'Test fixture', VendorID: 0x0483, ProductID: 0x522a };
  for (let index = 198; index < groups * 66; index++) {
    const bytes = encodeDefinition({ type: 0, keys: index % 66 < 4 ? [20 + (index % 30)] : [] }, index);
    bytes[0][63] = 0xa7;
    profile.records.push(bytes);
  }
  if (rgb) profile.lights = Uint8Array.from({ length: 198 }, (_, i) => i % 256);
  profile.counters = Array.from({ length: 66 }, (_, i) => i * 10000);
  return profile;
}
export const macro = (overrides: Partial<KeyDefinition> = {}) => ({
  type: 2,
  keys: [43, 44, 45],
  interval: 30,
  cycles: 3,
  customDelay: 0,
  delays: [],
  ...overrides,
});
export function inputEvent(device: ConfigDevice, bytes: Uint8Array, reportId = 0) {
  // Deliberately non-zero byteOffset to detect DataView copying regressions.
  const container = new Uint8Array(bytes.length + 13);
  container.set(bytes, 7);
  const event = new Event('inputreport');
  Object.assign(event, { device, reportId, data: new DataView(container.buffer, 7, bytes.length) });
  return event;
}
export class FakeDevice extends EventTarget implements ConfigDevice {
  profile: Profile;
  vendorId: number;
  productId: number;
  productName: string;
  opened: boolean;
  sent: Uint8Array[];
  openCount: number;
  collections: HIDCollection[];
  keyBuffer: Uint8Array[] | null;
  lightBuffer: number[] | null;
  omitResponses: Set<number>;
  corruptReadback: boolean;
  failOn?: number;
  readOverride?: Uint8Array[];
  constructor(profile = fixture()) {
    super();
    this.profile = profile.clone();
    const filter = profile.model.filters.at(-1)!;
    this.vendorId = filter.vendorId;
    this.productId = filter.productId;
    this.productName = `${profile.model.name} fixture`;
    this.opened = false;
    this.sent = [];
    this.openCount = 0;
    this.collections = [
      {
        usagePage: filter.usagePage,
        usage: filter.usage,
        children: [],
        inputReports: [{ reportId: 0, items: [{ reportSize: 8, reportCount: 64 }] }],
        outputReports: [{ reportId: 0, items: [{ reportSize: 8, reportCount: 64 }] }],
      },
    ];
    this.keyBuffer = null;
    this.lightBuffer = null;
    this.omitResponses = new Set();
    this.corruptReadback = false;
  }
  async open() {
    this.opened = true;
    this.openCount++;
  }
  async close() {
    this.opened = false;
  }
  emit(bytes: Uint8Array) {
    this.dispatchEvent(inputEvent(this, bytes));
  }
  bytes(data: Uint8Array, type: number) {
    for (let offset = 0; offset < data.length; offset += 61) {
      const part = data.slice(offset, offset + 61),
        r = command(type);
      r[2] = part.length;
      r.set(part, 3);
      this.emit(r);
    }
    this.emit(command(0xe6));
  }
  async sendReport(reportId: number, data: Uint8Array) {
    if (!this.opened) throw new Error('fake device closed');
    if (reportId !== 0 || data.length !== 64) throw new Error('bad WebHID report');
    const r = data.slice();
    this.sent.push(r);
    const op = r[1];
    if (this.failOn === op) throw new Error('injected I/O failure');
    if (this.omitResponses.has(op)) return;
    if (op === 0xf9) {
      const reply = command(0xf9);
      reply.set(new TextEncoder().encode(this.profile.version), 2);
      this.emit(reply);
    }
    if (op === 0xf2) {
      const reports = this.readOverride ?? this.profile.reports;
      reports.forEach((bytes) => this.emit(bytes));
      const end = command(0xf6);
      end[0] = 0xf6;
      this.emit(end);
    }
    if (op === 0xe3) {
      const bytes = new Uint8Array(this.profile.model.keyCount * 4),
        view = new DataView(bytes.buffer);
      this.profile.counters.forEach((n, i) => view.setUint32(i * 4, n, true));
      this.bytes(bytes, 0xe3);
    }
    if (op === 0xe2) this.bytes(this.profile.lights ?? new Uint8Array(this.profile.model.keyCount * 3), 0xe0);
    if (op === 0xf1) this.keyBuffer = [];
    if (op === 0xf0 && this.keyBuffer) this.keyBuffer.push(r);
    if (op === 0xf6 && this.keyBuffer) {
      const newProfile = Profile.fromReports(this.keyBuffer, this.profile.model);
      newProfile.version = this.profile.version;
      newProfile.identity = this.profile.identity;
      newProfile.counters = this.profile.counters;
      newProfile.lights = this.profile.lights;
      this.profile = newProfile;
      if (this.corruptReadback) this.profile.setDefinition(0, { type: 0, keys: [24] });
      this.keyBuffer = null;
    }
    if (op === 0xe1) this.lightBuffer = [];
    if (op === 0xe0 && this.lightBuffer) this.lightBuffer.push(...r.slice(3, 3 + r[2]));
    if (r.every((b) => b === 0xe6) && this.lightBuffer) {
      this.profile.lights = Uint8Array.from(this.lightBuffer);
      this.lightBuffer = null;
    }
  }
}
export class FakeHID extends EventTarget implements HIDAccess {
  devices: ConfigDevice[];
  selection: ConfigDevice[];
  requestCount: number;
  getCount: number;
  filters?: Parameters<HIDAccess['requestDevice']>[0]['filters'];
  constructor(devices: ConfigDevice[] = []) {
    super();
    this.devices = devices;
    this.selection = devices;
    this.requestCount = 0;
    this.getCount = 0;
  }
  async getDevices() {
    this.getCount++;
    return this.devices;
  }
  async requestDevice(options: Parameters<HIDAccess['requestDevice']>[0]) {
    this.requestCount++;
    this.filters = options.filters;
    return this.selection;
  }
  connect(device: ConfigDevice) {
    if (!this.devices.includes(device)) this.devices.push(device);
    const event = Object.assign(new Event('connect'), { device });
    this.dispatchEvent(event);
  }
  disconnect(device: ConfigDevice) {
    this.devices = this.devices.filter((x) => x !== device);
    device.opened = false;
    const event = Object.assign(new Event('disconnect'), { device });
    this.dispatchEvent(event);
  }
}
export async function settle(session: HIDSession) {
  await new Promise((resolve) => setImmediate(resolve));
  await session.tail;
  await new Promise((resolve) => setImmediate(resolve));
}
