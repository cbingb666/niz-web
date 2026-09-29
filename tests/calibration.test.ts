import { expect, test, vi } from 'vitest';
import {
  calibrationPacket, validateCalibrationReply,
  createCalibrationRun, calibrationRecorder, type CalibrationSnapshot,
} from '../src/calibration';
import { command } from '../src/protocol';
import { CalibrationDevice } from './calibration-helpers';

test('calibration output contains 64 bytes without a duplicated Windows report ID', () => {
  for (const [kind, prefix] of [
    ['lock', [0, 0xd9, 0]], ['release', [0, 0xdb, 0]], ['press', [0, 0xdd, 0]], ['unlock', [0, 0xd9, 1]],
  ] as const) {
    expect(Array.from(calibrationPacket(kind))).toEqual([...prefix, ...Array<number>(61).fill(0)]);
  }
});

test('completion validates framing and the expected stage; payload is not interpreted as sensor data', () => {
  const reply = command(0xda);
  reply[63] = 0xa7;
  expect(() => validateCalibrationReply(reply, 0xda)).not.toThrow();
  expect(() => validateCalibrationReply(reply, 0xde)).toThrow();
  expect(() => validateCalibrationReply(reply.slice(1), 0xda)).toThrow();
  reply[0] = 1;
  expect(() => validateCalibrationReply(reply, 0xda)).toThrow();
});

test('run waits for a user between stages, rejects overlapping actions, and finishes once', async t => {
  const updates: CalibrationSnapshot[] = [];
  let last = 0;
  const send = vi.fn(async (bytes: Uint8Array) => { last = bytes[1]; });
  const unlock = vi.fn(async () => 'sent' as const);
  const engine = createCalibrationRun({ identify: async () => {}, send,
    receive: async () => command(last === 0xdb ? 0xda : 0xde), unlock, changingCalibration: vi.fn(),
  }, state => updates.push(state));
  t.onTestFinished(() => engine.interrupt());
  const executing = engine.execute();
  await vi.waitFor(() => expect(updates.at(-1)?.phase).toBe('awaiting-held-keys'));
  expect(send).toHaveBeenCalledTimes(2);
  const press = engine.run.calibrateHeldKeys();
  await expect(engine.run.calibrateHeldKeys()).rejects.toThrow();
  await press;
  expect(updates.at(-1)?.batches).toBe(1);
  const finish = engine.run.finish();
  expect(engine.run.finish()).toBe(finish);
  expect(await finish).toMatchObject({ phase: 'testing', releaseCompleted: true, batches: 1, unlock: 'sent', error: null });
  await executing;
  expect(unlock).toHaveBeenCalledOnce();
  await expect(engine.run.calibrateHeldKeys()).rejects.toThrow();
});

test('opt-in capture is bounded, identifies truncation, and copies report data', () => {
  const device = new CalibrationDevice();
  const recorder = calibrationRecorder({ id: 'device-1', number: 1, name: 'test', model: 'atom66', version: 'test', epoch: 1 }, device);
  const bytes = command(0xdb);
  for (let index = 0; index < 260; index++) recorder.record({ event: 'tx-start', reportId: 0, bytes }, 'calibrating-release');
  bytes[1] = 0;
  const capture = recorder.snapshot();
  expect(capture).toMatchObject({ format: 'niz-calibration-capture', truncated: true, outcome: null });
  expect(capture.entries).toHaveLength(256);
  expect(capture.entries[0]).toMatchObject({ sequence: 5, event: 'tx-start', bytes: expect.stringContaining('00db') });
  capture.entries.length = 0;
  expect(recorder.snapshot().entries).toHaveLength(256);
});

test('a failing progress consumer cannot skip terminal unlock or leave done pending', async () => {
  const unlock = vi.fn(async () => 'sent' as const);
  const send = vi.fn(async () => {});
  const engine = createCalibrationRun({ identify: async () => {}, send, receive: async () => command(0xda),
    unlock, changingCalibration: () => {},
  }, state => { if (state.phase === 'calibrating-release') throw new Error('view failed'); });
  await engine.execute();
  expect(await engine.run.done).toMatchObject({ phase: 'failed', unlock: 'sent' });
  expect(send).toHaveBeenCalledOnce();
  expect(unlock).toHaveBeenCalledOnce();
});
