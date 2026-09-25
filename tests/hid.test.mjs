import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  HIDSession,
  PacketChannel,
  isConfigDevice,
  validateDescriptor,
  readKeyReports,
  readBytes,
} from '../src/hid.ts';
import { command, MAX_REPORTS } from '../src/protocol.ts';
import { fixture, macro, FakeDevice, FakeHID, inputEvent, settle } from './helpers.ts';

async function connected(t, profile = fixture(), options = {}) {
  const device = new FakeDevice(profile),
    hid = new FakeHID([device]),
    session = new HIDSession(hid, { timeout: 50, retryMs: 60000, ...options });
  t.onTestFinished(() => session.stop());
  await session.start();
  return { device, hid, session };
}
function writes(device) {
  return device.sent.filter((b) => [0xf1, 0xf0, 0xf6, 0xe1, 0xe0, 0xe6].includes(b[1]));
}
function changed(profile) {
  const target = profile.clone();
  target.setDefinition(0, { type: 0, keys: [43] });
  return target;
}

test('strict USB filters exclude keyboard input collections and other devices', () => {
  const device = new FakeDevice();
  assert.equal(isConfigDevice(device), true);
  validateDescriptor(device);
  device.collections = [{ usagePage: 1, usage: 6 }];
  assert.equal(isConfigDevice(device), false);
  assert.throws(() => validateDescriptor(device));
  device.collections = [{ usagePage: 0x8c, usage: 1 }];
  assert.throws(() => validateDescriptor(device));
  device.vendorId = 0x1234;
  assert.equal(isConfigDevice(device), false);
});
test('descriptor accepts nested reports and rejects wrong IDs or lengths', () => {
  for (const field of ['inputReports', 'outputReports']) {
    const device = new FakeDevice();
    device.collections[0][field][0].reportId = 1;
    assert.throws(() => validateDescriptor(device));
    device.collections[0][field][0].reportId = 0;
    device.collections[0][field][0].items[0].reportCount = 63;
    assert.throws(() => validateDescriptor(device));
  }
  const device = new FakeDevice(),
    collection = device.collections[0];
  device.collections = [{ usagePage: 0x8c, usage: 1, children: [collection] }];
  validateDescriptor(device);
});
test('PacketChannel copies the DataView slice, not its enclosing buffer', async () => {
  const device = new FakeDevice();
  await device.open();
  const channel = new PacketChannel(device, { timeout: 30 });
  const report = command(0xf9);
  report[63] = 31;
  device.emit(report);
  assert.deepEqual(await channel.receive(), report);
  const received = channel.receive();
  device.emit(report);
  assert.deepEqual(await received, report);
  channel.close();
});
test('unrelated reports are ignored; wrong-size configuration reports fail closed', async () => {
  const device = new FakeDevice(),
    channel = new PacketChannel(device, { timeout: 30 });
  device.dispatchEvent(inputEvent(device, command(0xf0), 1));
  assert.equal(channel.queue.length, 0);
  device.dispatchEvent(inputEvent(new FakeDevice(), command(0xf0)));
  assert.equal(channel.queue.length, 0);
  device.emit(new Uint8Array(65));
  await assert.rejects(channel.receive(), /64/);
  assert.throws(() => channel.reset());
  channel.close();
});
test('close rejects pending receive and timeouts are surfaced', async () => {
  const device = new FakeDevice(),
    channel = new PacketChannel(device, { timeout: 15 });
  await assert.rejects(channel.receive(), /超时/);
  const pending = channel.receive(),
    rejected = assert.rejects(pending, /断开/);
  channel.close();
  await rejected;
});
test('report send errors permanently invalidate that packet channel', async () => {
  const device = new FakeDevice();
  await device.open();
  device.failOn = 0xf9;
  const channel = new PacketChannel(device);
  await assert.rejects(channel.send(command(0xf9)), /I\/O/);
  assert.throws(() => channel.reset(), /I\/O/);
  channel.close();
});
test('startup without permission never asks for authorization or sends commands', async (t) => {
  const hid = new FakeHID(),
    session = new HIDSession(hid, { retryMs: 60000 });
  t.onTestFinished(() => session.stop());
  await session.start();
  assert.equal(hid.requestCount, 0);
  assert.equal(session.connected, false);
  assert.equal(session.state, 'waiting');
});
test('authorized startup connects using F9 only, without reading or writing configuration', async (t) => {
  const { device, hid, session } = await connected(t);
  assert.equal(session.connected, true);
  assert.equal(session.hasLiveBaseline, false);
  assert.equal(hid.requestCount, 0);
  assert.deepEqual(
    device.sent.map((b) => b[1]),
    [0xf9],
  );
  assert.equal(writes(device).length, 0);
});
test('unsupported browser has an explicit state', async () => {
  const session = new HIDSession(null);
  await session.start();
  assert.equal(session.state, 'unsupported');
  await assert.rejects(session.authorize());
  await session.stop();
});
test('requestDevice runs synchronously in authorize, preserving a button user gesture', async (t) => {
  const device = new FakeDevice(),
    hid = new FakeHID(),
    session = new HIDSession(hid);
  t.onTestFinished(() => session.stop());
  hid.selection = [device];
  const promise = session.authorize();
  assert.equal(hid.requestCount, 1);
  assert.equal(hid.filters.length, 3);
  assert.equal(
    hid.filters.every((f) => f.vendorId === 0x0483 && f.usagePage === 0x8c && f.usage === 1),
    true,
  );
  await promise;
  assert.equal(session.connected, true);
});
test('cancelled authorization leaves no connection and can be retried', async (t) => {
  const hid = new FakeHID(),
    session = new HIDSession(hid);
  t.onTestFinished(() => session.stop());
  await session.authorize();
  assert.equal(session.state, 'waiting');
  assert.equal(session.authorizing, false);
  hid.selection = [new FakeDevice()];
  await session.authorize();
  assert.equal(session.connected, true);
  const count = hid.requestCount;
  await session.authorize();
  assert.equal(hid.requestCount, count);
  assert.equal(session.connected, true);
});
test('multiple authorized devices require explicit selection', async (t) => {
  const a = new FakeDevice(),
    b = new FakeDevice(),
    hid = new FakeHID([a, b]),
    session = new HIDSession(hid, { retryMs: 60000 });
  t.onTestFinished(() => session.stop());
  await session.start();
  assert.equal(session.connected, false);
  assert.equal(a.openCount + b.openCount, 0);
  assert.match(session.message, /多把/);
});
test('fresh read handles nine groups and uint32 little-endian counters without writes', async (t) => {
  const { device, session } = await connected(t, fixture(9));
  const { profile, notes } = await session.read();
  assert.equal(profile.groupCount, 9);
  assert.equal(profile.records.length, 594);
  assert.deepEqual(profile.counters, device.profile.counters);
  assert.deepEqual(notes, []);
  assert.equal(session.hasLiveBaseline, true);
  assert.equal(writes(device).length, 0);
  assert.equal(session.lastCapture.reports.length, 594);
});
test('RGB and key counters are optional separate reads', async (t) => {
  const { device, session } = await connected(t, fixture(3, true));
  const { profile } = await session.read();
  assert.deepEqual(profile.lights, device.profile.lights);
  device.omitResponses.add(0xe3);
  const next = await session.read();
  assert.equal(next.notes.length, 1);
  assert.deepEqual(next.profile.lights, device.profile.lights);
  assert.equal(session.connected, true);
});
test('configuration parsing failure does not falsely say that the keyboard is disconnected', async (t) => {
  const { device, session } = await connected(t);
  device.readOverride = device.profile.reports.slice(0, 10);
  await assert.rejects(session.read(), /完整/);
  assert.equal(session.connected, true);
  assert.equal(session.hasLiveBaseline, false);
  assert.equal(session.lastCapture.reports.length, 10);
  assert.match(session.lastCapture.error, /完整/);
  assert.equal(writes(device).length, 0);
});
test('disconnect interrupts a pending read, clears write authorization, then reconnects without F2', async (t) => {
  const { device, hid, session } = await connected(t);
  await session.read();
  device.omitResponses.add(0xf2);
  const pending = session.read(),
    rejection = assert.rejects(pending, /断开/);
  await new Promise((resolve) => setImmediate(resolve));
  hid.disconnect(device);
  await rejection;
  assert.equal(session.hasLiveBaseline, false);
  device.omitResponses.clear();
  const start = device.sent.length;
  hid.connect(device);
  await settle(session);
  assert.equal(session.connected, true);
  assert.equal(session.hasLiveBaseline, false);
  assert.deepEqual(
    device.sent.slice(start).map((b) => b[1]),
    [0xf9],
  );
});
test('manual disconnect pauses automatic reconnect until the user chooses again', async (t) => {
  const { device, hid, session } = await connected(t);
  await session.disconnect();
  hid.connect(device);
  await settle(session);
  assert.equal(session.connected, false);
  assert.equal(session.paused, true);
  await session.authorize();
  assert.equal(session.connected, true);
});
test('a read is mandatory before any hardware write', async (t) => {
  const { device, session } = await connected(t);
  let backups = 0;
  await assert.rejects(
    session.write(changed(device.profile), async () => ++backups),
    /先读取/,
  );
  assert.equal(backups, 0);
  assert.equal(writes(device).length, 0);
});
test('unchanged profiles never initiate a write or backup', async (t) => {
  const { device, session } = await connected(t);
  const { profile } = await session.read();
  const result = await session.write(profile, () => {
    throw new Error('must not save');
  });
  assert.equal(result.backupId, null);
  assert.equal(writes(device).length, 0);
});
test('changed device contents and firmware stop before the first write command', async (t) => {
  const { device, session } = await connected(t);
  const { profile } = await session.read(),
    target = changed(profile);
  device.profile.setDefinition(1, { type: 0, keys: [44] });
  await assert.rejects(
    session.write(target, async () => 'backup'),
    /配置已发生变化/,
  );
  assert.equal(writes(device).length, 0);
  device.profile = profile.clone();
  device.profile.version = '66EC(S);another';
  await assert.rejects(
    session.write(target, async () => 'backup'),
    /固件版本/,
  );
  assert.equal(writes(device).length, 0);
});
test('backup rejection or missing durable ID prevents every hardware write', async (t) => {
  const { device, session } = await connected(t);
  const { profile } = await session.read();
  await assert.rejects(
    session.write(changed(profile), async () => {
      throw new Error('quota exceeded');
    }),
    /quota/,
  );
  await assert.rejects(
    session.write(changed(profile), async () => null),
    /备份未保存/,
  );
  assert.equal(writes(device).length, 0);
});
test('unrecognized extension bytes are compared before any write', async (t) => {
  const { device, session } = await connected(t, fixture(9));
  const { profile } = await session.read();
  device.profile.records[250][0][63] ^= 1;
  await assert.rejects(
    session.write(changed(profile), async () => 'backup'),
    /配置已发生变化/,
  );
  assert.equal(writes(device).length, 0);
});
test('nine-group write awaits backup and preserves all extension bytes; readback completes it', async (t) => {
  const { device, session } = await connected(t, fixture(9));
  const { profile } = await session.read();
  const target = changed(profile);
  target.setDefinition(1, macro({ keys: Array(70).fill(43) }));
  let allowBackup, saved;
  const backupReady = new Promise((resolve) => {
    allowBackup = resolve;
  });
  const pending = session.write(target, async (original) => {
    saved = original;
    await backupReady;
    return 'durable-backup';
  });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(writes(device).length, 0);
  assert.ok(saved);
  allowBackup();
  const result = await pending;
  assert.equal(result.backupId, 'durable-backup');
  assert.deepEqual(saved.reports, profile.reports);
  assert.deepEqual(device.profile.records.slice(198), profile.records.slice(198));
  assert.deepEqual(device.profile.differences(target), []);
  assert.equal(device.sent.filter((b) => b[1] === 0xf0).length, 595);
  const commit = device.sent.find((b) => b[1] === 0xf6);
  assert.equal(commit[0], 0);
  assert.equal(
    commit.slice(1).every((b) => b === 0xf6),
    true,
  );
  assert.equal(session.hasLiveBaseline, true);
});
test('RGB-only write uses E1/E0/all-E6, never the key commit marker', async (t) => {
  const { device, session } = await connected(t, fixture(3, true));
  const { profile } = await session.read();
  profile.lights[0] ^= 255;
  await session.write(profile, async () => 'backup');
  assert.equal(
    device.sent.some((b) => b[1] === 0xf1),
    false,
  );
  const commit = device.sent.find((b) => b[1] === 0xe6);
  assert.equal(
    commit.every((b) => b === 0xe6),
    true,
  );
  assert.deepEqual(device.profile.lights, profile.lights);
});
test('readback mismatch invalidates the baseline and does not retry writing', async (t) => {
  const { device, session } = await connected(t);
  const { profile } = await session.read();
  device.corruptReadback = true;
  await assert.rejects(
    session.write(changed(profile), async () => 'backup'),
    (error) => error.beganWrite && /回读不一致/.test(error.message) && error.backupId === 'backup',
  );
  assert.equal(session.hasLiveBaseline, false);
  assert.equal(device.sent.filter((b) => b[1] === 0xf1).length, 1);
});
test('mid-write I/O failure retains backup identity and requires a new baseline', async (t) => {
  const { device, session } = await connected(t);
  const { profile } = await session.read();
  device.failOn = 0xf0;
  await assert.rejects(
    session.write(changed(profile), async () => 'backup'),
    (error) => error.beganWrite && error.backupId === 'backup' && /部分写入/.test(error.message),
  );
  assert.equal(session.hasLiveBaseline, false);
});
test('commands in two reads are serialized rather than interleaved', async (t) => {
  const { device, session } = await connected(t);
  const start = device.sent.length;
  await Promise.all([session.read(), session.read()]);
  assert.deepEqual(
    device.sent.slice(start).map((b) => b[1]),
    [0xf2, 0xe3, 0xf2, 0xe3],
  );
  assert.equal(session.pending, 0);
});
test('stream termination and size are checked, including byte-zero F6 distinction', async () => {
  const channel = {
    queue: [],
    reset() {},
    async send() {},
    async receive() {
      if (!this.queue.length) throw new Error('end');
      return this.queue.shift();
    },
  };
  channel.queue = [command(0xf6)];
  await assert.rejects(readKeyReports(channel), /未知报文/);
  const end = command(0xf6);
  end[0] = 0xf6;
  channel.queue = [end];
  assert.deepEqual(await readKeyReports(channel), []);
  channel.queue = [command(0xe6)];
  await assert.rejects(readBytes(channel, 0xe2, 0xe0, 198), /长度/);
  const bad = command(0xe0);
  bad[2] = 62;
  channel.queue = [bad];
  await assert.rejects(readBytes(channel, 0xe2, 0xe0, 198), /结构/);
});
test('the packet limit accepts a final terminator but rejects one extra payload', async () => {
  const packet = command(0xf0),
    end = command(0xf6);
  end[0] = 0xf6;
  const channel = {
    count: 0,
    extra: false,
    reset() {
      this.count = 0;
    },
    async send() {},
    async receive() {
      return this.count++ < MAX_REPORTS + (this.extra ? 1 : 0) ? packet : end;
    },
  };
  assert.equal((await readKeyReports(channel)).length, MAX_REPORTS);
  channel.extra = true;
  await assert.rejects(readKeyReports(channel), /数量/);
});
