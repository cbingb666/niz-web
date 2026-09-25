import { expect, onTestFinished, test, vi } from 'vitest';
import { HIDSession, PacketChannel, writeKeyReports } from '../src/hid';
import type { OperationProgress, TransferProgress } from '../src/types/hid';
import { FakeDevice, FakeHID, fixture, macro } from './helpers';
import { modelFixture, test68 } from './model-fixtures';

test.each([fixture(9, true), modelFixture(test68, 4)])(
  'read progress counts actual macro packets and model-specific counter/RGB bytes',
  async (profile) => {
    profile.setDefinition(0, macro({ keys: Array(54).fill(43) }));
    const session = new HIDSession(new FakeHID([new FakeDevice(profile)]), {
      models: [profile.model], retryMs: 60_000,
    });
    onTestFinished(() => session.stop());
    await session.start();
    const events: OperationProgress[] = [];
    await session.read((progress) => events.push(progress));
    const packets = events.filter((progress) => progress.phase === 'read');
    expect(packets[0].transfer).toEqual({ completed: 0, total: null, unit: 'packets' });
    expect(packets.at(-1)?.transfer).toEqual({
      completed: profile.reports.length, total: null, unit: 'packets',
    });
    expect(profile.reports.length).toBeGreaterThan(profile.records.length);
    expect(packets.every((progress) => progress.transfer?.total === null)).toBe(true);
    for (const [phase, total] of [['counters', profile.model.keyCount * 4], ['readLights', profile.model.keyCount * 3]] as const) {
      const bytes = events.filter((progress) => progress.phase === phase).map((progress) => progress.transfer);
      expect(bytes[0]).toEqual({ completed: 0, total, unit: 'bytes' });
      expect(bytes[1]).toEqual({ completed: 61, total, unit: 'bytes' });
      expect(bytes.at(-1)).toEqual({ completed: total, total, unit: 'bytes' });
    }
  },
);

test('write and read-back progress use actual packet totals including macro continuation packets', async (t) => {
  const device = new FakeDevice();
  const session = new HIDSession(new FakeHID([device]), { retryMs: 60_000 });
  t.onTestFinished(() => session.stop());
  await session.start();
  const { profile } = await session.read();
  profile.setDefinition(0, macro({ keys: Array(54).fill(43) }));
  const total = profile.reports.length, events: OperationProgress[] = [];
  await session.write(profile, async () => 'saved', (progress) => {
    events.push(progress);
    if (progress.phase === 'write') expect(progress.transfer).toEqual({
      completed: device.sent.filter((packet) => packet[1] === 0xf0).length,
      total,
      unit: 'packets',
    });
  });
  expect(total).toBe(199);
  expect(events.filter((progress) => progress.phase === 'write').at(-1)?.transfer?.completed).toBe(total);
  expect(events.filter((progress) => progress.phase === 'readback').at(-1)?.transfer).toEqual({
    completed: total, total, unit: 'packets',
  });
  expect(events.filter((progress) => ['backup', 'settle', 'validate', 'done'].includes(progress.phase))
    .every((progress) => progress.transfer === undefined)).toBe(true);
  expect(events.at(-1)).toEqual({ phase: 'done' });
});

test('a stalled or failed send never advances the completed packet count', async (t) => {
  const device = new FakeDevice();
  await device.open();
  const channel = new PacketChannel(device);
  t.onTestFinished(() => channel.close());
  let started!: () => void, rejectSend!: (error: Error) => void;
  const waiting = new Promise<void>((resolve) => { started = resolve; });
  const held = new Promise<void>((_, reject) => { rejectSend = reject; });
  const send = device.sendReport.bind(device);
  vi.spyOn(device, 'sendReport').mockImplementation(async (id, packet) => {
    if (packet[1] === 0xf0 && packet[3] === 2) {
      started();
      await held;
    }
    await send(id, packet);
  });
  const events: TransferProgress[] = [];
  const result = writeKeyReports(channel, device.profile.reports.slice(0, 3), (progress) => events.push(progress))
    .catch((error: unknown) => error);
  await waiting;
  expect(events.at(-1)).toEqual({ completed: 1, total: 3, unit: 'packets' });
  rejectSend(new Error('send failed'));
  expect(await result).toBeInstanceOf(Error);
  expect(events.at(-1)).toEqual({ completed: 1, total: 3, unit: 'packets' });
});

test('an RGB-only write reports the actual short final chunk without an invented key-write stage', async (t) => {
  const device = new FakeDevice(fixture(3, true));
  const session = new HIDSession(new FakeHID([device]), { retryMs: 60_000 });
  t.onTestFinished(() => session.stop());
  await session.start();
  const { profile } = await session.read();
  profile.lights![0] ^= 1;
  const events: OperationProgress[] = [];
  await session.write(profile, async () => 'saved', (progress) => {
    events.push(progress);
    if (progress.phase === 'writeLights') expect(progress.transfer).toEqual({
      completed: device.sent.filter((packet) => packet[1] === 0xe0).reduce((sum, packet) => sum + packet[2], 0),
      total: 198,
      unit: 'bytes',
    });
  });
  expect(events.some((progress) => progress.phase === 'write')).toBe(false);
  expect(events.filter((progress) => progress.phase === 'writeLights').map((progress) => progress.transfer?.completed))
    .toEqual([0, 61, 122, 183, 198]);
  expect(events.filter((progress) => progress.phase === 'readbackLights').at(-1)?.transfer).toEqual({
    completed: 198, total: 198, unit: 'bytes',
  });
});

test('unexpected extra read-back packets discard the denominator and never report success', async (t) => {
  const device = new FakeDevice();
  const session = new HIDSession(new FakeHID([device]), { retryMs: 60_000 });
  t.onTestFinished(() => session.stop());
  await session.start();
  const { profile } = await session.read();
  profile.setDefinition(0, { type: 0, keys: [43] });
  const send = device.sendReport.bind(device);
  let reads = 0;
  vi.spyOn(device, 'sendReport').mockImplementation(async (id, packet) => {
    if (packet[1] === 0xf2 && ++reads === 2)
      device.readOverride = [...device.profile.reports, device.profile.reports[0]];
    await send(id, packet);
  });
  const events: OperationProgress[] = [];
  await expect(session.write(profile, async () => 'saved', (progress) => events.push(progress))).rejects.toThrow();
  expect(events.filter((progress) => progress.phase === 'readback').at(-1)?.transfer).toEqual({
    completed: 199, total: null, unit: 'packets',
  });
  expect(events.some((progress) => progress.phase === 'done')).toBe(false);
});
