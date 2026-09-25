import { KEY_NAMES, ENGLISH_KEY_NAMES } from './i18n/key-names.ts';
import { msg, renderMessage, joinMessages, type Message } from './i18n/core.ts';
export interface KeyDefinition {
  type: number;
  keys: number[];
  interval?: number;
  cycles?: number;
  customDelay?: number;
  delays?: number[];
}
export type DecodedDefinition = Required<KeyDefinition>;
export type DeviceIdentity = Record<string, unknown>;
export interface ProfileJSON {
  format: 'atom66-macos';
  schema: 1;
  version: string;
  identity: DeviceIdentity;
  reports: string[];
  counters: number[];
  lights?: string;
  legacyXML?: string;
}
export interface SequenceOptions {
  type: number;
  interval?: number;
  cycles?: number;
  customDelay?: boolean;
}
export function isRecord(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}
// NIZ wire format ported from the local macOS implementation and original DLL.
// All byte offsets exclude Windows' extra Report ID byte; WebHID uses reportId=0.
export const VENDOR_ID = 0x0483;
export const PRODUCT_IDS = [0x502a, 0x512a, 0x522a];
export const USAGE_PAGE = 0x8c;
export const USAGE = 1;
export const KEYS_PER_GROUP = 66;
export const EDITABLE_RECORDS = 198;
export const MAX_REPORTS = 8192;
export const MAX_FILE_SIZE = 4 * 1024 * 1024;
export const LAYERS = ['普通层', '右 Fn', '左 Fn'];
export { KEY_NAMES } from './i18n/key-names.ts';
export const PHYSICAL_KEYS =
  "Esc|1|2|3|4|5|6|7|8|9|0|-|=|\\|`|Tab|Q|W|E|R|T|Y|U|I|O|P|[|]|⌫|Caps|A|S|D|F|G|H|J|K|L|;|'|Return|Shift|Z|X|C|V|B|N|M|,|.|/|Shift / ↑|R Fn|Ctrl|Win|Alt|L Fn|Space|Alt|Menu|Ctrl|←|↓|→".split(
    '|',
  );
export const ROW_WIDTHS: number[][] = [
  Array(15).fill(1),
  [1.5, ...Array(12).fill(1), 1.5],
  [1.75, ...Array(11).fill(1), 2.25],
  [2.25, ...Array(10).fill(1), 1.75, 1],
  [1.25, 1.25, 1.25, 1.25, 4, 1, 1, 1, 1, 1, 1],
];
export class ProtocolError extends Error {
  details: Record<string, unknown>;
  rawReports?: Uint8Array[];
  backupId?: string | null;
  beganWrite?: boolean;
  description: Message;
  constructor(message: Message, details: Record<string, unknown> = {}) {
    super(renderMessage(message));
    this.description = message;
    this.name = 'ProtocolError';
    this.details = details;
  }
  append(message: Message) {
    this.description = joinMessages(this.description, '\n', message);
    this.message = renderMessage(this.description);
  }
}
export function assert(
  condition: unknown,
  message: Message,
  details?: Record<string, unknown>,
): asserts condition {
  if (!condition) throw new ProtocolError(message, details);
}
export function integer(value: unknown, max: number, label = msg('field.argument'), min = 0): number {
  assert(
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max,
    msg('error.integer', { label, min, max }),
  );
  return value;
}
export function hex(bytes: Uint8Array | number[]) {
  return Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('');
}
export function unhex(text: unknown) {
  assert(typeof text === 'string' && text.length % 2 === 0 && /^[0-9a-f]*$/i.test(text), msg('error.hex'));
  return Uint8Array.from(text.match(/../g) ?? [], (x) => parseInt(x, 16));
}
export function equalBytes(a: Uint8Array | null | undefined, b: Uint8Array | null | undefined) {
  return a?.length === b?.length && (a == null || a.every((v, i) => v === b?.[i]));
}
export function keyName(code: number) {
  return KEY_NAMES[code] ?? `未知代码 ${code}`;
}
export function parseKey(text: string) {
  const value = String(text).split(' · ')[0].trim();
  const match = KEY_NAMES.findIndex((x) => x.toLowerCase() === value.toLowerCase());
  if (match >= 0) return match;
  const english = ENGLISH_KEY_NAMES.findIndex((name) => name.toLowerCase() === value.toLowerCase());
  if (english >= 0) return english;
  const aliases: Record<string, number> = {
    cmd: 68,
    command: 68,
    lcmd: 68,
    rcmd: 72,
    ctrl: 67,
    control: 67,
    alt: 69,
    option: 69,
    shift: 55,
    enter: 54,
    lfn: 166,
    rfn: 156,
    none: 0,
    up: 87,
    left: 88,
    down: 89,
    right: 90,
  };
  if (Object.hasOwn(aliases, value.toLowerCase())) return aliases[value.toLowerCase()];
  if (/^#\d+$/.test(value)) return integer(Number(value.slice(1)), 255, msg('field.keyCode'));
  if (/^0x[0-9a-f]+$/i.test(value)) return integer(parseInt(value.slice(2), 16), 255, msg('field.keyCode'));
  throw new ProtocolError(msg('error.keyName', { value }));
}
export function command(op: number) {
  const bytes = new Uint8Array(64);
  bytes[1] = op;
  return bytes;
}
export function encodeDefinition(def: KeyDefinition, index: number) {
  integer(index, 593, msg('field.record'));
  const type = integer(def.type, 4, msg('field.type'));
  assert(Array.isArray(def.keys) && (type === 0 || def.keys.length > 0), msg('error.sequenceRequired'));
  const max = type === 0 ? 58 : type === 1 ? 56 : 2048;
  assert(def.keys.length <= max, msg('error.sequenceLength', { max }));
  def.keys.forEach((key) => integer(key, 255, msg('field.keyCode')));
  const header = command(0xf0);
  header[2] = Math.floor(index / 66) + 1;
  header[3] = (index % 66) + 1;
  header[4] = type;
  if (type < 2) {
    if (type === 0) header[5] = def.keys.length;
    else {
      const interval = integer(def.interval, 65535, msg('field.interval'));
      header[5] = interval >> 8;
      header[6] = interval & 255;
      header[7] = def.keys.length;
    }
    header.set(def.keys, type === 0 ? 6 : 8);
    return [header];
  }
  const cycles = integer(def.cycles, 255, msg('field.cycles'), type === 2 ? 1 : 0);
  const custom = integer(def.customDelay, 1, msg('field.delayMode'));
  const interval = integer(def.interval, 65535, msg('field.interval'));
  if (custom)
    assert(
      Array.isArray(def.delays) && def.delays.length === def.keys.length - 1,
      msg('error.delaysRequired'),
    );
  const payload: number[] = [];
  def.keys.forEach((key, i) => {
    payload.push(key);
    if (custom && i + 1 < def.keys.length) {
      const ms = integer(def.delays?.[i], 65535, msg('field.delay'));
      payload.push(200, ms >> 8, ms & 255);
    }
  });
  header[5] = cycles;
  header[6] = custom;
  header[7] = interval >> 8;
  header[8] = interval & 255;
  header[9] = payload.length >> 8;
  header[10] = payload.length & 255;
  const reports = [];
  for (let offset = 0; offset < payload.length; offset += 53) {
    const report = header.slice();
    report.set(payload.slice(offset, offset + 53), 11);
    reports.push(report);
  }
  return reports;
}
export function decodeDefinition(reports: Uint8Array[]): DecodedDefinition {
  const b = reports[0];
  const type = b[4];
  const def: DecodedDefinition = { type, keys: [], interval: 0, cycles: 1, customDelay: 0, delays: [] };
  if (type < 2) {
    const count = b[type === 0 ? 5 : 7],
      offset = type === 0 ? 6 : 8;
    assert(count <= 64 - offset, msg('error.chordLength'));
    def.keys = Array.from(b.slice(offset, offset + count));
    if (type === 1) def.interval = b[5] * 256 + b[6];
    return def;
  }
  assert(type <= 4, msg('error.keyType'));
  const size = b[9] * 256 + b[10];
  assert(size > 0 && size <= reports.length * 53 && b[6] <= 1, msg('error.macroIncomplete'));
  const bytes = Uint8Array.from(reports.flatMap((r) => Array.from(r.slice(11)))).slice(0, size);
  for (let i = 0; i < size;) {
    def.keys.push(bytes[i++]);
    if (b[6] && i < size) {
      assert(i + 3 < size && bytes[i] === 200, msg('error.delayMarker'));
      def.delays.push(bytes[i + 1] * 256 + bytes[i + 2]);
      i += 3;
    }
  }
  def.cycles = b[5];
  def.customDelay = b[6];
  def.interval = b[7] * 256 + b[8];
  return def;
}
export class Profile {
  records: Uint8Array[][];
  version: string;
  identity: DeviceIdentity;
  counters: number[];
  lights: Uint8Array | null;
  legacyXML: string | null;
  constructor(records: Uint8Array[][]) {
    this.records = records;
    this.version = '';
    this.identity = {};
    this.counters = [];
    this.lights = null;
    this.legacyXML = null;
  }
  static fromReports(reports: Uint8Array[]) {
    assert(
      Array.isArray(reports) && reports.length >= 198 && reports.length <= MAX_REPORTS,
      msg('error.completeGroups'),
    );
    reports.forEach((r) => assert(r instanceof Uint8Array && r.length === 64, msg('error.reportSize')));
    const groups = Math.max(3, ...reports.map((r) => r[2]));
    assert(groups === 3 || groups === 9, msg('error.groupCount'));
    const records: (Uint8Array[] | null)[] = Array.from({ length: groups * 66 }, () => null);
    for (let i = 0; i < reports.length;) {
      const b = reports[i];
      assert(
        b[0] === 0 && b[1] === 0xf0 && b[2] >= 1 && b[2] <= groups && b[3] >= 1 && b[3] <= 66 && b[4] <= 4,
        msg('error.packetFormat', { packet: i + 1, group: b[2], key: b[3], type: b[4] }),
        { packet: i, header: hex(b.slice(0, 16)) },
      );
      const index = (b[2] - 1) * 66 + b[3] - 1;
      assert(records[index] === null, msg('error.duplicateRecord'));
      const size = b[9] * 256 + b[10],
        count = b[4] < 2 ? 1 : Math.ceil(size / 53);
      assert(count > 0 && count <= 155 && i + count <= reports.length, msg('error.macroPackets'));
      const group = reports.slice(i, i + count).map((r) => r.slice());
      if (b[4] >= 2)
        group.forEach((r) => assert(equalBytes(r.slice(0, 11), b.slice(0, 11)), msg('error.macroHeaders')));
      decodeDefinition(group);
      records[index] = group;
      i += count;
    }
    assert(
      records.every((record) => record !== null),
      msg('error.missingRecords'),
    );
    return new Profile(records);
  }
  get groupCount() {
    return this.records.length / 66;
  }
  get reports() {
    return this.records.flatMap((group) => group.map((r) => r.slice()));
  }
  definition(index: number) {
    integer(index, this.records.length - 1, msg('field.position'));
    return decodeDefinition(this.records[index]);
  }
  setDefinition(index: number, def: KeyDefinition, { syncFn = true } = {}) {
    integer(index, 197, msg('field.editablePosition'));
    const reports = encodeDefinition(def, index);
    this.records[index] = reports;
    if (syncFn && def.type === 0 && def.keys.length === 1 && [156, 166].includes(def.keys[0]))
      for (let layer = 0; layer < 3; layer++)
        this.records[layer * 66 + (index % 66)] = encodeDefinition(def, layer * 66 + (index % 66));
  }
  summary(index: number) {
    const def = this.definition(index);
    if (!def.keys.length) return index >= 66 ? '未设置' : '无功能';
    if (def.type >= 2) return `宏 · ${def.keys.length} 步`;
    return def.keys.map(keyName).join(' + ');
  }
  differences(other: Profile) {
    assert(this.records.length === other.records.length, msg('error.groupMismatch'));
    const changed = [];
    for (let i = 0; i < this.records.length; i++) {
      // The extra six groups are opaque. Check every byte, not only decoded fields.
      const same =
        i < EDITABLE_RECORDS
          ? JSON.stringify(this.definition(i)) === JSON.stringify(other.definition(i))
          : this.records[i].length === other.records[i].length &&
            this.records[i].every((r, j) => equalBytes(r, other.records[i][j]));
      if (!same) changed.push(i);
    }
    return changed;
  }
  validateForWriting() {
    Profile.fromReports(this.reports);
    let hasFn = false;
    for (let key = 0; key < 66; key++) {
      const d = this.definition(key);
      if (d.type === 0 && d.keys.length === 1 && [156, 166].includes(d.keys[0])) {
        hasFn = true;
        for (let layer = 1; layer < 3; layer++) {
          const fn = this.definition(layer * 66 + key);
          assert(
            fn.type === 0 && fn.keys.length === 1 && fn.keys[0] === d.keys[0],
            msg('error.fnConsistency'),
          );
        }
      }
    }
    assert(hasFn, msg('error.fnRequired'));
  }
  toJSON() {
    const data: ProfileJSON = {
      format: 'atom66-macos',
      schema: 1,
      version: this.version,
      identity: this.identity,
      reports: this.reports.map(hex),
      counters: [...this.counters],
    };
    if (this.lights) data.lights = hex(this.lights);
    if (this.legacyXML) data.legacyXML = this.legacyXML;
    return data;
  }
  static fromJSON(input: unknown) {
    if (typeof input === 'string') {
      assert(input.length <= MAX_FILE_SIZE, msg('error.fileSize'));
      input = JSON.parse(input);
    }
    assert(
      isRecord(input) &&
        input.format === 'atom66-macos' &&
        input.schema === 1 &&
        Array.isArray(input.reports),
      msg('error.profileFormat'),
    );
    assert(input.reports.length <= MAX_REPORTS, msg('error.reportLimit'));
    const p = Profile.fromReports(input.reports.map(unhex));
    assert(typeof input.version === 'string' && isRecord(input.identity), msg('error.identity'));
    assert(Array.isArray(input.counters) && [0, 66].includes(input.counters.length), msg('error.counters'));
    input.counters.forEach((n) => integer(n, 0xffffffff, msg('field.counter')));
    p.version = input.version;
    p.identity = { ...input.identity };
    p.counters = [...input.counters];
    if (input.lights != null) {
      p.lights = unhex(input.lights);
      assert(p.lights.length === 198, msg('error.lightsLength'));
    }
    if (input.legacyXML != null) {
      assert(typeof input.legacyXML === 'string', msg('error.legacyAttachment'));
      p.legacyXML = input.legacyXML;
    }
    return p;
  }
  clone() {
    return Profile.fromJSON(this.toJSON());
  }
}
export function mergeImported(imported: Profile, baseline: Profile | null) {
  const p = imported.clone();
  if (!baseline) return p;
  assert(p.version === baseline.version, msg('error.firmwareImport'));
  if (p.records.length === 198 && baseline.records.length === 594)
    p.records.push(...baseline.records.slice(198).map((g) => g.map((r) => r.slice())));
  assert(p.records.length === baseline.records.length, msg('error.importGroups'));
  p.identity = { ...baseline.identity };
  p.counters = [...baseline.counters];
  if (!p.lights || !baseline.version.includes('RGB')) p.lights = baseline.lights?.slice() ?? null;
  return p;
}
export function demoProfile() {
  const records = Array.from({ length: 198 }, (_, i) => encodeDefinition({ type: 0, keys: [] }, i));
  const p = new Profile(records);
  p.version = '离线演示 · 非设备当前配置';
  const keys = [
    1, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 41, 14, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
    40, 27, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65,
    66, 156, 67, 68, 69, 166, 70, 71, 73, 74, 88, 89, 90,
  ];
  keys.forEach((code, i) => p.setDefinition(i, { type: 0, keys: [code] }));
  for (let layer = 1; layer < 3; layer++)
    for (let key = 1; key <= 12; key++) p.setDefinition(layer * 66 + key, { type: 0, keys: [key + 1] });
  return p;
}
export function makeCapture(version: string, identity: DeviceIdentity, reports: Uint8Array[], error = '') {
  return {
    format: 'atom66-read-capture',
    schema: 1,
    capturedAt: Date.now() / 1000,
    version,
    identity,
    reports: reports.map(hex),
    error,
  };
}
export function parseSequence(
  text: string,
  { type, interval = 0, cycles = 1, customDelay = false }: SequenceOptions,
): DecodedDefinition {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const keys: number[] = [],
    delays: number[] = [];
  const custom = type >= 2 && customDelay;
  lines.forEach((line, i) => {
    const parts = line.split(/\s+@/);
    assert(parts.length <= 2, msg('error.oneDelay'));
    keys.push(parseKey(parts[0]));
    if (custom && i + 1 < lines.length) {
      assert(parts.length === 2 && /^\d+$/.test(parts[1]), msg('error.stepDelay'));
      delays.push(integer(Number(parts[1]), 65535, msg('field.delay')));
    } else assert(parts.length === 1, msg('error.lastDelay'));
  });
  return {
    type,
    keys,
    interval: type ? interval : 0,
    cycles: type === 2 ? cycles : type > 2 ? 0 : 1,
    customDelay: custom ? 1 : 0,
    delays,
  };
}
export function sequenceText(def: DecodedDefinition, formatKey: (code: number) => string = keyName) {
  return def.keys
    .map((key, i) => formatKey(key) + (def.customDelay && i < def.delays.length ? ` @${def.delays[i]}` : ''))
    .join('\n');
}
