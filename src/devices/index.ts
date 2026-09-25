import type { ConfigDevice } from '../types/hid';
import type { KeyboardModel } from './model';
import { atom66 } from './atom66/model.ts';

// Register only models backed by verified protocol information. Test fixtures
// are injected into sessions and never added to this production allowlist.
export const supportedModels: readonly KeyboardModel[] = [atom66];
export const defaultModel = atom66;
export type { KeyboardModel } from './model';

export function deviceModels(device: ConfigDevice, models = supportedModels) {
  return models.filter((model) =>
    model.filters.some((filter) =>
      device.vendorId === filter.vendorId &&
      device.productId === filter.productId &&
      (device.collections ?? []).some((collection) =>
        collection.usagePage === filter.usagePage && collection.usage === filter.usage,
      ),
    ),
  );
}
export function identifyModel(device: ConfigDevice, version: string, models = supportedModels) {
  const matches = deviceModels(device, models).filter((model) => model.matchesFirmware(version));
  // Shared USB IDs alone are not sufficient, and ambiguous firmware is rejected.
  return matches.length === 1 ? matches[0] : null;
}
export function deviceFilters(models = supportedModels) {
  const filters = models.flatMap((model) => model.filters);
  return filters.filter((filter, index) =>
    filters.findIndex((candidate) =>
      candidate.vendorId === filter.vendorId &&
      candidate.productId === filter.productId &&
      candidate.usagePage === filter.usagePage && candidate.usage === filter.usage,
    ) === index,
  );
}
