import { FakeDevice, fixture } from './helpers';
import { command } from '../src/protocol';

/** Synthetic protocol adapter, not a capture or a claim of hardware support. */
export class CalibrationDevice extends FakeDevice {
  calibrationSend?: (bytes: Uint8Array) => Promise<void>;
  releaseReply = command(0xda);
  pressReply = command(0xde);
  override async sendReport(reportId: number, data: Uint8Array) {
    await super.sendReport(reportId, data);
    if (![0xd9, 0xdb, 0xdd].includes(data[1])) return;
    await this.calibrationSend?.(data);
    if (this.omitResponses.has(data[1])) return;
    if (data[1] === 0xdb) this.emit(this.releaseReply);
    if (data[1] === 0xdd) this.emit(this.pressReply);
  }
}

/** User-reported USB identity; all configuration and replies remain synthetic. */
export function rgbCalibrationDevice() {
  const profile = fixture(3, true);
  profile.version = '66EC(XRGB)BLe;V1.2.5;V1.0;';
  profile.identity = { Product: '66EC-XRGB', VendorID: 0x0483, ProductID: 0x502a };
  const device = new CalibrationDevice(profile);
  device.productId = 0x502a;
  device.productName = '66EC-XRGB';
  return device;
}

export function calibrationTraffic(device: FakeDevice) {
  return device.sent.filter(bytes => [0xd9, 0xdb, 0xdd].includes(bytes[1])).map(bytes => Array.from(bytes.slice(0, 3)));
}

export function promiseGate() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
