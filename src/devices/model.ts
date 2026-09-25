import type { Message } from '../i18n/core';
import type { HIDAccess } from '../types/hid';

export interface PhysicalKey {
  readonly label: string;
  readonly width: number;
}
export interface KeyboardCapabilities {
  readonly counters: boolean;
  readonly perKeyRGB: boolean;
}
interface ModelDefinition {
  readonly id: string;
  readonly name: string;
  // Only the existing NIZ EC wire protocol is implemented. A different protocol
  // needs its own implementation, not a new model with guessed parameters.
  readonly protocol: 'niz-ec';
  readonly filters: ReadonlyArray<Parameters<HIDAccess['requestDevice']>[0]['filters'][number]>;
  readonly matchesFirmware: (version: string) => boolean;
  readonly capabilities: (version: string) => KeyboardCapabilities;
  readonly rows: readonly (readonly PhysicalKey[])[];
  readonly layers: readonly Message[];
  readonly groupCounts: readonly number[];
  readonly fn: { readonly codes: readonly number[]; readonly required: boolean };
  readonly demoKeys: readonly (readonly number[])[];
  readonly demoColor?: readonly [number, number, number];
}
export interface KeyboardModel extends ModelDefinition {
  readonly keys: readonly PhysicalKey[];
  readonly keyCount: number;
  readonly editableRecords: number;
  readonly maxRecords: number;
}

export function defineModel(definition: ModelDefinition): KeyboardModel {
  const keys = definition.rows.flat();
  const layers = definition.layers.length;
  if (
    !definition.id ||
    !definition.filters.length ||
    !keys.length ||
    keys.length > 255 ||
    !layers ||
    !definition.groupCounts.includes(layers) ||
    definition.groupCounts.some((count) => !Number.isInteger(count) || count < layers || count > 255) ||
    definition.rows.some((row) => !row.length) ||
    keys.some((key) => !key.label || !Number.isFinite(key.width) || key.width <= 0) ||
    definition.fn.codes.some((code) => !Number.isInteger(code) || code < 0 || code > 255) ||
    (definition.fn.required && !definition.fn.codes.length) ||
    definition.demoKeys.length > layers ||
    definition.demoKeys.some((row) =>
      row.length > keys.length || row.some((code) => !Number.isInteger(code) || code < 0 || code > 255),
    )
  )
    throw new Error(`Invalid keyboard model: ${definition.id}`);
  return {
    ...definition,
    keys,
    keyCount: keys.length,
    editableRecords: keys.length * layers,
    maxRecords: keys.length * Math.max(...definition.groupCounts),
  };
}
