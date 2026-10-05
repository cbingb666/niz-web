// Internal NIZ codes, not raw HID usage numbers. Exact firmware evidence only.
export const MAC_NATIVE_VERSION = '66EC(RGB)BLe;V1.5.1-F.1;V1.0;';
export const MAC_STOCK_VERSION = '66EC(RGB)BLe;V1.5.1;V1.0;';
export const macNativeCodes = [222, 223, 224, 225, 226, 227, 228, 229, 230] as const;
export const macFunctionRowCodes: readonly number[] = [208, 209, 222, 224, 225, 226, 109, 111, 108, 112, 114, 113];
// Current Mac F1–F12 row, followed by older/alternate actions and Fn.
export const macSystemKeyOrder: readonly number[] = [
  ...macFunctionRowCodes,
  223, 227, 228, 229, 230, 207,
];
export function isMacCode(code: number): boolean {
  return code === 207 || code === 208 || code === 209 || macNativeCodes.some(value => value === code);
}
export function macCodeAvailable(code: number, model: string, version: string): boolean {
  if (!isMacCode(code)) return true;
  if (model !== 'atom66') return false;
  if (version === MAC_NATIVE_VERSION) return true;
  return version === MAC_STOCK_VERSION && code >= 207 && code <= 209;
}
