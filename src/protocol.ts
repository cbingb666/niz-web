import { KEY_NAMES, ENGLISH_KEY_NAMES } from './i18n/key-names.ts';
import { msg, renderMessage, joinMessages, type Message } from './i18n/core.ts';
import { defaultModel, supportedModels, type KeyboardModel } from './devices/index.ts';
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
export type ProfileJSON = {
  schema: 1;
  version: string;
  identity: DeviceIdentity;
  reports: string[];
  counters: number[];
  lights?: string;
  legacyXML?: string;
} & ({ format: 'atom66-macos'; model?: 'atom66' } | { format: 'niz-web'; model: string });
export interface SequenceOptions {
  type: number;
  interval?: number;
  cycles?: number;
  customDelay?: boolean;
}
export function isRecord(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}
// NIZ EC wire format ported from the local macOS implementation and original DLL.
// All byte offsets exclude Windows' extra Report ID byte; WebHID uses reportId=0.
export const MAX_REPORTS = 8192;
export const MAX_FILE_SIZE = 4 * 1024 * 1024;
export { KEY_NAMES } from './i18n/key-names.ts';
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
export function encodeDefinition(def: KeyDefinition, index: number, model: KeyboardModel = defaultModel) {
  integer(index, model.maxRecords - 1, msg('field.record'));
  const type = integer(def.type, 4, msg('field.type'));
  assert(Array.isArray(def.keys) && (type === 0 || def.keys.length > 0), msg('error.sequenceRequired'));
  const max = type === 0 ? 58 : type === 1 ? 56 : 2048;
  assert(def.keys.length <= max, msg('error.sequenceLength', { max }));
  def.keys.forEach((key) => integer(key, 255, msg('field.keyCode')));
  const header = command(0xf0);
  header[2] = Math.floor(index / model.keyCount) + 1;
  header[3] = (index % model.keyCount) + 1;
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
  readonly model: KeyboardModel;
  records: Uint8Array[][];
  version: string;
  identity: DeviceIdentity;
  counters: number[];
  lights: Uint8Array | null;
  legacyXML: string | null;
  constructor(records: Uint8Array[][], model: KeyboardModel = defaultModel) {
    this.model = model;
    this.records = records;
    this.version = '';
    this.identity = {};
    this.counters = [];
    this.lights = null;
    this.legacyXML = null;
  }
  static fromReports(reports: Uint8Array[], model: KeyboardModel = defaultModel) {
    assert(
      Array.isArray(reports) && reports.length >= model.editableRecords && reports.length <= MAX_REPORTS,
      msg('error.completeGroups'),
    );
    reports.forEach((r) => assert(r instanceof Uint8Array && r.length === 64, msg('error.reportSize')));
    const groups = Math.max(model.layers.length, ...reports.map((r) => r[2]));
    assert(model.groupCounts.includes(groups), msg('error.groupCount'));
    const records: (Uint8Array[] | null)[] = Array.from({ length: groups * model.keyCount }, () => null);
    for (let i = 0; i < reports.length;) {
      const b = reports[i];
      assert(
        b[0] === 0 && b[1] === 0xf0 && b[2] >= 1 && b[2] <= groups && b[3] >= 1 && b[3] <= model.keyCount && b[4] <= 4,
        msg('error.packetFormat', { packet: i + 1, group: b[2], key: b[3], type: b[4] }),
        { packet: i, header: hex(b.slice(0, 16)) },
      );
      const index = (b[2] - 1) * model.keyCount + b[3] - 1;
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
    return new Profile(records, model);
  }
  get groupCount() {
    return this.records.length / this.model.keyCount;
  }
  get reports() {
    return this.records.flatMap((group) => group.map((r) => r.slice()));
  }
  definition(index: number) {
    integer(index, this.records.length - 1, msg('field.position'));
    return decodeDefinition(this.records[index]);
  }
  setDefinition(index: number, def: KeyDefinition, { syncFn = true } = {}) {
    const { keyCount, editableRecords, layers, fn } = this.model;
    integer(index, editableRecords - 1, msg('field.editablePosition'));
    const reports = encodeDefinition(def, index, this.model);
    this.records[index] = reports;
    if (syncFn && def.type === 0 && def.keys.length === 1 && fn.codes.includes(def.keys[0]))
      for (let layer = 0; layer < layers.length; layer++) {
        const position = layer * keyCount + (index % keyCount);
        this.records[position] = encodeDefinition(def, position, this.model);
      }
  }
  summary(index: number) {
    const def = this.definition(index);
    if (!def.keys.length) return index >= this.model.keyCount ? '未设置' : '无功能';
    if (def.type >= 2) return `宏 · ${def.keys.length} 步`;
    return def.keys.map(keyName).join(' + ');
  }
  differences(other: Profile) {
    assert(this.model.id === other.model.id, msg('error.modelMismatch'));
    assert(this.records.length === other.records.length, msg('error.groupMismatch'));
    const changed = [];
    for (let i = 0; i < this.records.length; i++) {
      // Non-editable groups are opaque. Check every byte, not only decoded fields.
      const same =
        i < this.model.editableRecords
          ? JSON.stringify(this.definition(i)) === JSON.stringify(other.definition(i))
          : this.records[i].length === other.records[i].length &&
            this.records[i].every((r, j) => equalBytes(r, other.records[i][j]));
      if (!same) changed.push(i);
    }
    return changed;
  }
  validateForWriting() {
    Profile.fromReports(this.reports, this.model);
    const { keyCount, layers, fn: fnRules } = this.model;
    let hasFn = false;
    for (let key = 0; key < keyCount; key++) {
      const d = this.definition(key);
      if (d.type === 0 && d.keys.length === 1 && fnRules.codes.includes(d.keys[0])) {
        hasFn = true;
        for (let layer = 1; layer < layers.length; layer++) {
          const fn = this.definition(layer * keyCount + key);
          assert(
            fn.type === 0 && fn.keys.length === 1 && fn.keys[0] === d.keys[0],
            msg('error.fnConsistency'),
          );
        }
      }
    }
    assert(!fnRules.required || hasFn, msg('error.fnRequired'));
  }
  toJSON() {
    const data: ProfileJSON = {
      ...(this.model.id === 'atom66'
        ? { format: 'atom66-macos' as const }
        : { format: 'niz-web' as const, model: this.model.id }),
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
  static fromJSON(input: unknown, models = supportedModels) {
    if (typeof input === 'string') {
      assert(input.length <= MAX_FILE_SIZE, msg('error.fileSize'));
      input = JSON.parse(input);
    }
    assert(
      isRecord(input) &&
        (input.format === 'atom66-macos' || input.format === 'niz-web') &&
        input.schema === 1 &&
        Array.isArray(input.reports),
      msg('error.profileFormat'),
    );
    const modelId = input.format === 'atom66-macos' ? 'atom66' : input.model;
    assert(input.model === undefined || input.model === modelId, msg('error.modelMismatch'));
    const model = models.find((candidate) => candidate.id === modelId);
    assert(model, msg('error.profileModel'));
    assert(input.reports.length <= MAX_REPORTS, msg('error.reportLimit'));
    const p = Profile.fromReports(input.reports.map(unhex), model);
    assert(typeof input.version === 'string' && isRecord(input.identity), msg('error.identity'));
    assert(
      Array.isArray(input.counters) && [0, model.keyCount].includes(input.counters.length),
      msg('error.counters'),
    );
    input.counters.forEach((n) => integer(n, 0xffffffff, msg('field.counter')));
    p.version = input.version;
    p.identity = { ...input.identity };
    p.counters = [...input.counters];
    if (input.lights != null) {
      p.lights = unhex(input.lights);
      assert(p.lights.length === model.keyCount * 3, msg('error.lightsLength'));
    }
    if (input.legacyXML != null) {
      assert(typeof input.legacyXML === 'string', msg('error.legacyAttachment'));
      p.legacyXML = input.legacyXML;
    }
    return p;
  }
  clone() {
    return Profile.fromJSON(this.toJSON(), [this.model]);
  }
}
export function mergeImported(imported: Profile, baseline: Profile | null) {
  const p = imported.clone();
  if (!baseline) return p;
  assert(p.model.id === baseline.model.id, msg('error.modelMismatch'));
  assert(p.version === baseline.version, msg('error.firmwareImport'));
  const editable = p.model.editableRecords;
  if (p.records.length === editable && baseline.records.length > editable)
    p.records.push(...baseline.records.slice(editable).map((g) => g.map((r) => r.slice())));
  assert(p.records.length === baseline.records.length, msg('error.importGroups'));
  p.identity = { ...baseline.identity };
  p.counters = [...baseline.counters];
  if (!p.lights || !baseline.model.capabilities(baseline.version).perKeyRGB)
    p.lights = baseline.lights?.slice() ?? null;
  return p;
}
export function demoProfile(model: KeyboardModel = defaultModel) {
  const records = Array.from({ length: model.editableRecords }, (_, i) =>
    encodeDefinition({ type: 0, keys: [] }, i, model),
  );
  const p = new Profile(records, model);
  p.version = '离线演示 · 非设备当前配置';
  model.demoKeys.forEach((keys, layer) =>
    keys.forEach((code, key) => {
      if (code) p.setDefinition(layer * model.keyCount + key, { type: 0, keys: [code] });
    }),
  );
  return p;
}
export function makeCapture(
  version: string,
  identity: DeviceIdentity,
  reports: Uint8Array[],
  error = '',
  model: KeyboardModel = defaultModel,
) {
  return {
    ...(model.id === 'atom66'
      ? { format: 'atom66-read-capture' }
      : { format: 'niz-read-capture', model: model.id }),
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
