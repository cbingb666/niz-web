import { vi } from 'vitest';
import { readFirmwareFile, stockFirmware } from '../src/firmware';
import { FakeDevice, fixture } from './helpers';

// Synthetic records, with a mocked hash decision. No physical USB/EEPROM/LDROM is exercised.
export function syntheticFirmwareFile() {
  const text = `:07${'00'.repeat(8)}\r\n` + `:15${'11'.repeat(24)}\r\n`.repeat(3349) +
    `:09${'22'.repeat(16)}\r\n:05${'33'.repeat(8)}\r\n`;
  const bytes = new TextEncoder().encode(text);
  return { name: 'synthetic.bin', size: bytes.length, arrayBuffer: async () => bytes.slice().buffer };
}
export async function syntheticFirmware() {
  const digest = Uint8Array.from(stockFirmware.sha256.match(/../g)!, byte => parseInt(byte, 16));
  vi.spyOn(crypto.subtle, 'digest').mockResolvedValueOnce(digest.buffer);
  return readFirmwareFile(syntheticFirmwareFile());
}
export function firmwareDevice(groups = 3) {
  const profile = fixture(groups, true);
  profile.version = stockFirmware.version;
  profile.identity = { Product: '66EC-RGB', VendorID: stockFirmware.vendorId, ProductID: stockFirmware.productId };
  return new FirmwareDevice(profile);
}
export class FirmwareDevice extends FakeDevice {
  flashCount = 0;
  firmwareSend?: (data: Uint8Array) => void | Promise<void>;
  override async sendReport(reportId: number, data: Uint8Array) {
    await super.sendReport(reportId, data);
    if (data[1] === 0x3a) { this.flashCount++; await this.firmwareSend?.(data); }
  }
}
