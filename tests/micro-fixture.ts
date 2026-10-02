import { micro82 } from '../src/devices/micro82/model';
import { micro84 } from '../src/devices/micro84/model';
import type { KeyboardModel } from '../src/devices';
import { demoProfile } from '../src/protocol';

export const microModels = [micro82, micro84];

// Synthetic protocol fixtures, never real device captures or factory keymaps.
export function microFixture(model: KeyboardModel, rgb = false) {
  const profile = demoProfile(model);
  const prefix = model === micro82 ? '82' : '84';
  profile.version = `${prefix}EC(${rgb ? 'XRGB)BLe' : 'S)'};V1.4.1;V1.0;`;
  profile.identity = { Product: `${model.name} synthetic fixture`, VendorID: 0x0483, ProductID: model.filters[0].productId };
  profile.counters = Array.from({ length: model.keyCount }, (_, key) => key * 100);
  if (rgb) profile.lights = Uint8Array.from({ length: model.keyCount * 3 }, (_, index) => index % 256);
  return profile;
}

export function microWindowsProfile(model: KeyboardModel, root = model.legacyRoots![0]) {
  const fnKey = model === micro82 ? 78 : 76;
  const keys = Array.from({ length: model.editableRecords }, (_, index) =>
    `<KEY ID="${index % model.keyCount + 1}" Level="${Math.floor(index / model.keyCount)}" Mode="1" HWCode="${index % model.keyCount + 1 === fnKey ? 166 : 43}"/>`,
  ).join('');
  const lights = Array.from({ length: model.keyCount }, (_, key) =>
    `<AREA ID="${key + 1}" Red="${key}" Green="20" Blue="30"/>`,
  ).join('');
  return `<${root}><CurrentSettings>${keys}</CurrentSettings><BackgroundLightSettings>${lights}</BackgroundLightSettings></${root}>`;
}
