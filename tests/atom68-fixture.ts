import { atom68 } from '../src/devices/atom68/model';
import { demoProfile, encodeDefinition } from '../src/protocol';

// Synthetic reports derived from the official client's addressing, never a
// hardware capture or evidence that reads/writes work on a real ATOM68.
export function atom68Fixture(groups = 6, rgb = false) {
  const profile = demoProfile(atom68);
  profile.version = rgb ? '68EC(XRGB)BLe;V1.4.1;V1.0;' : '68EC(S);V1.4.1;V1.0;';
  profile.identity = { Product: 'ATOM68 synthetic fixture', VendorID: 0x0483, ProductID: 0x5232 };
  for (let index = atom68.editableRecords; index < groups * atom68.keyCount; index++) {
    const packets = encodeDefinition({ type: 0, keys: [43 + index % 10] }, index, atom68);
    packets[0][63] = 0xa7;
    profile.records.push(packets);
  }
  profile.counters = Array.from({ length: 68 }, (_, key) => key * 100);
  if (rgb) profile.lights = Uint8Array.from({ length: 204 }, (_, index) => index % 256);
  return profile;
}

export function atom68WindowsProfile(root = '68EC(S)') {
  const keys = Array.from({ length: 408 }, (_, index) =>
    `<KEY ID="${index % 68 + 1}" Level="${Math.floor(index / 68)}" Mode="1" HWCode="${index % 68 === 63 ? 156 : 43}"/>`,
  ).join('');
  const lights = Array.from({ length: 68 }, (_, key) =>
    `<AREA ID="${key + 1}" Red="${key}" Green="20" Blue="30"/>`,
  ).join('');
  return `<${root}><CurrentSettings>${keys}</CurrentSettings><BackgroundLightSettings>${lights}</BackgroundLightSettings></${root}>`;
}
