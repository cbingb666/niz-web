import { msg, type Message } from './i18n/core';
import { assert, hex, ProtocolError } from './protocol';
import { MAC_NATIVE_VERSION } from './mac-keycodes';

// This is an exact package allowlist, not a filename or VID-based compatibility guess.
// Evidence: niz-firmware/firmware/mac_updater_compatibility.json and the recovered image.
export const stockFirmware = Object.freeze({
  model: 'atom66', vendorId: 0x0483, productId: 0x542a,
  version: '66EC(RGB)BLe;V1.5.1;V1.0;',
  sha256: 'b5dca0a3de1f36778c4ce5deb41d019d95221f654ef783ff6b837553092397fa',
  size: 177576, records: 3352,
});
// This single experimental build has passed descriptor/package and ARM report checks.
// Hardware flashing, macOS effects and the external BLE module remain unverified.
export const macNativeFirmware = Object.freeze({
  ...stockFirmware,
  version: MAC_NATIVE_VERSION,
  sha256: 'a3add2fd899bc4c2f8c04855bfe6c2920cfe4909752698a99930992385a9e561',
  size: 179378, records: 3386,
});
const allowedFirmware = [stockFirmware, macNativeFirmware];
export function supportedFirmwareVersion(version: string): boolean {
  return allowedFirmware.some(candidate => candidate.version === version);
}

export interface FirmwarePackage {
  readonly fileName: string;
  readonly sha256: string;
  readonly version: string;
  readonly size: number;
  readonly records: number;
}
export interface FirmwareTarget {
  readonly id: string;
  readonly epoch: number;
  readonly version: string;
}
export type FirmwarePhase = 'preparing' | 'checking-file' | 'ready' | 'identifying' | 'verifying' | 'backup' |
  'sending' | 'awaiting-restart' | 'awaiting-reconnect' | 'unconfirmed' | 'checking-version' | 'version-confirmed' | 'failed';
export interface FirmwareSnapshot {
  phase: FirmwarePhase;
  completed: number;
  total: number;
  attempted: boolean;
  backupId?: string;
  error?: Message;
}
export const initialFirmware = (): FirmwareSnapshot => ({ phase: 'preparing', completed: 0, total: 0, attempted: false });

const validatedPackages = new WeakMap<FirmwarePackage, readonly Uint8Array[]>();
export function firmwarePackets(file: FirmwarePackage): readonly Uint8Array[] {
  const packets = validatedPackages.get(file);
  assert(packets, msg('firmware.invalidPackage'));
  // Neither callers nor a file-picker race can mutate the validated payloads.
  return packets.map(packet => packet.slice());
}
export async function readFirmwareFile(file: Pick<File, 'name' | 'size' | 'arrayBuffer'>): Promise<FirmwarePackage> {
  assert(/\.bin$/i.test(file.name) && allowedFirmware.some(candidate => candidate.size === file.size), msg('firmware.invalidPackage'));
  const bytes = new Uint8Array(await file.arrayBuffer()).slice();
  assert(bytes.length === file.size && globalThis.crypto?.subtle, msg('firmware.invalidPackage'));
  const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
  const firmware = allowedFirmware.find(candidate => candidate.sha256 === digest && candidate.size === bytes.length);
  assert(firmware, msg('firmware.unknownPackage'));
  assert(bytes.every(byte => byte < 128), msg('firmware.invalidPackage'));
  const lines = new TextDecoder().decode(bytes).split('\r\n');
  assert(lines.pop() === '' && lines.length === firmware.records, msg('firmware.invalidPackage'));
  const packets = lines.map(line => {
    assert(/^:[0-9A-F]+$/.test(line) && line.length % 2 === 1, msg('firmware.invalidPackage'));
    const wrapped = Uint8Array.from(line.slice(1).match(/../g) ?? [], pair => Number.parseInt(pair, 16));
    const size = wrapped[0];
    assert(size >= 5 && size <= 53 && wrapped.length === 1 + Math.ceil(size / 8) * 8, msg('firmware.invalidPackage'));
    const packet = new Uint8Array(64);
    packet[1] = 0x3a;
    packet.set(wrapped, 2);
    return packet;
  });
  const result = Object.freeze({ fileName: file.name, sha256: digest, version: firmware.version,
    size: bytes.length, records: packets.length });
  validatedPackages.set(result, packets);
  return result;
}

/** A bounded wait can observe a reboot, but cannot prove that APROM was written. */
export function firmwareDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new ProtocolError(msg('firmware.interrupted'))); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}
