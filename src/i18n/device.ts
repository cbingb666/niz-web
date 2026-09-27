import type { ConnectedHIDDevice } from '../hid';
import { msg, type Message } from './core';

export function formatUsbId(value: number | undefined): string {
  return value === undefined ? '—' : `0x${value.toString(16).toUpperCase().padStart(4, '0')}`;
}

export function deviceName(device: ConnectedHIDDevice, devices: readonly ConnectedHIDDevice[]): Message {
  const name = device.product.trim() || device.model.name;
  const duplicate = devices.some(other => other.id !== device.id &&
    (other.product.trim() || other.model.name) === name);
  return duplicate ? msg('devices.numberedName', { name, number: device.number }) : name;
}
