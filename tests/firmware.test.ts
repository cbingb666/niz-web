import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { expect, test, vi } from 'vitest';
import { firmwarePackets, readFirmwareFile, stockFirmware } from '../src/firmware';
import { syntheticFirmware, syntheticFirmwareFile } from './firmware-helpers';

test('only the exact package digest can authorize immutable 64-byte firmware reports', async () => {
  const file = syntheticFirmwareFile();
  await expect(readFirmwareFile(file)).rejects.toThrow(/SHA-256/);
  const parsed = await syntheticFirmware();
  expect(parsed).toMatchObject({ records: 3352, size: 177576, sha256: stockFirmware.sha256 });
  expect(Object.isFrozen(parsed)).toBe(true);
  const packets = firmwarePackets(parsed);
  expect(packets).toHaveLength(3352);
  expect(packets.every(packet => packet.length === 64 && packet[0] === 0 && packet[1] === 0x3a)).toBe(true);
  expect(packets[0].slice(0, 4)).toEqual(Uint8Array.from([0, 0x3a, 7, 0]));
  expect(packets.at(-1)?.[2]).toBe(5);
  packets[0].fill(99);
  expect(firmwarePackets(parsed)[0][0]).toBe(0);
  expect(() => firmwarePackets({ ...parsed })).toThrow();
});

test.each([{ name: 'raw.hex', size: 177576 }, { name: 'firmware.bin', size: 53584 },
  { name: 'large.bin', size: 200000 }, { name: 'empty.bin', size: 0 }])('rejects $name / $size before reading', async metadata => {
  const arrayBuffer = vi.fn();
  await expect(readFirmwareFile({ ...metadata, arrayBuffer })).rejects.toThrow();
  expect(arrayBuffer).not.toHaveBeenCalled();
});

const vendorPackage = 'niz-firmware/66EC(RGB)BLe_V1.5.1_20230520.bin';
test.skipIf(!existsSync(vendorPackage))('the optional submodule’s real vendor package matches the production allowlist and codec', async () => {
  const path = vendorPackage;
  const bytes = new Uint8Array(await readFile(path));
  const parsed = await readFirmwareFile({ name: 'vendor.bin', size: bytes.length, arrayBuffer: async () => bytes.slice().buffer });
  const packets = firmwarePackets(parsed);
  const first = new TextDecoder().decode(bytes).split('\r\n')[0].slice(1);
  expect(Buffer.from(packets[0].slice(2, 2 + first.length / 2)).toString('hex').toUpperCase()).toBe(first);
  expect(parsed.sha256).toBe(stockFirmware.sha256);
});

const macPackagePath = 'niz-firmware/firmware/build/mac_native/66EC_RGB_BLE_V1.5.1-F.1.bin';
test.skipIf(!existsSync(macPackagePath))('the experimental Mac package requires its own digest and target version', async () => {
  const { macNativeFirmware } = await import('../src/firmware');
  const bytes = new Uint8Array(await readFile(macPackagePath));
  const file = { name: 'renamed.bin', size: bytes.length, arrayBuffer: async () => bytes.slice().buffer };
  const parsed = await readFirmwareFile(file);
  expect(parsed).toMatchObject({ version: macNativeFirmware.version, sha256: macNativeFirmware.sha256,
    size: macNativeFirmware.size, records: macNativeFirmware.records });
  expect(firmwarePackets(parsed)).toHaveLength(macNativeFirmware.records);
  bytes[30] ^= 1;
  await expect(readFirmwareFile(file)).rejects.toThrow(/SHA-256/);
});
