import { msg } from '../i18n/core.ts';
import type { DecodedDefinition, DeviceIdentity } from '../protocol';
import { Profile, parseKey, assert, integer, MAX_FILE_SIZE, encodeDefinition } from '../protocol';
import { supportedModels } from './index';

function attribute(node: Element | undefined, name: string, max: number, fallback?: number) {
  const raw = node?.getAttribute(name);
  if (raw == null && fallback != null) return fallback;
  assert(typeof raw === 'string' && /^\d+$/.test(raw), msg('error.legacyAttribute', { name }));
  return integer(Number(raw), max, name);
}
function children(node: Element | undefined, name: string) {
  return Array.from(node?.children ?? []).filter((child) => child.tagName === name);
}
function legacyKey(text: string) {
  assert(typeof text === 'string', msg('error.legacyName'));
  const value = text.trim().replace(/ (?:up|down)$/i, '');
  const aliases: Record<string, number> = {
    'l-ctrl': 67,
    'r-ctrl': 74,
    'l-win': 68,
    'r-win': 72,
    'l-alt': 69,
    'r-alt': 71,
    'l-shift': 55,
    'r-shift': 66,
    'l-fn': 166,
    'r-fn': 156,
    lctrl: 67,
    rctrl: 74,
    lwin: 68,
    rwin: 72,
    lalt: 69,
    ralt: 71,
    lshift: 55,
    rshift: 66,
    bs: 27,
    ret: 54,
    caps: 42,
    capslock: 42,
    prisc: 78,
    printscreen: 78,
    scllk: 79,
    scrolllock: 79,
    pgup: 83,
    pgdn: 86,
    'up arrow': 87,
    'left arrow': 88,
    'down arrow': 89,
    'right arrow': 90,
    'mouse key left': 130,
    'mouse key right': 131,
    'mouse key middle': 132,
    'mouse wheel up': 133,
    'mouse wheel dn': 134,
    'adjust trigger point': 149,
    'programmable keyboard': 159,
  };
  Object.assign(aliases, {
    'media next': 108,
    'media previous': 109,
    'media stop': 110,
    'media play/pause': 111,
    'media mute': 112,
    'media volume up': 113,
    'media volume down': 114,
    'backlight switch': 135,
  });
  return Object.hasOwn(aliases, value.toLowerCase()) ? aliases[value.toLowerCase()] : parseKey(value);
}
export function importWindowsProfile(
  text: string,
  version = 'Windows .pro（离线导入）',
  identity: DeviceIdentity = {},
  Parser: typeof DOMParser = globalThis.DOMParser,
  models = supportedModels,
) {
  assert(typeof text === 'string' && text.length <= MAX_FILE_SIZE, msg('error.legacyFile'));
  assert(!/<!DOCTYPE|<!ENTITY/i.test(text), msg('error.legacyDTD'));
  const matches = models.flatMap((model) =>
    (model.legacyRoots ?? []).filter((root) => text.includes(`<${root}>`)).map((root) => ({ model, root })),
  );
  assert(matches.length === 1, msg('error.legacyModel'));
  const { model, root } = matches[0];
  const tag = model.id.toUpperCase();
  assert(Parser, msg('error.xmlUnavailable'));
  const normalized = text.replaceAll(`<${root}>`, `<${tag}>`).replaceAll(`</${root}>`, `</${tag}>`);
  const document = new Parser().parseFromString(normalized, 'application/xml');
  assert(
    !document.querySelector('parsererror') && document.documentElement.tagName === tag,
    msg('error.legacyXML'),
  );
  const settings = children(document.documentElement, 'CurrentSettings')[0],
    nodes = children(settings, 'KEY');
  const groups = model.legacyGroupCount ?? model.layers.length;
  assert(nodes.length === model.keyCount * groups, msg('error.legacyKeys', { keys: model.keyCount, layers: groups }));
  const records: Uint8Array[][] = Array.from({ length: model.keyCount * groups }, () => []);
  for (const node of nodes) {
    const key = attribute(node, 'ID', model.keyCount),
      layer = attribute(node, 'Level', groups - 1),
      mode = attribute(node, 'Mode', 255);
    assert(key >= 1, msg('error.legacyIndex'));
    const index = layer * model.keyCount + key - 1;
    assert(!records[index].length, msg('error.legacyDuplicate'));
    const def: DecodedDefinition = { type: 0, keys: [], interval: 0, cycles: 1, customDelay: 0, delays: [] };
    if (mode === 1 || mode > 4) {
      const code = attribute(node, 'HWCode', 255);
      def.keys = code === 199 ? [130, 130] : [code];
    } else if (mode >= 2) {
      const list = children(children(node, 'ComboKey')[0], 'List')[0];
      assert(list, msg('error.legacyList'));
      const items = children(list, 'x');
      assert(items.length <= 4095, msg('error.legacyMacroLength'));
      const indexed: (string | null)[] = Array.from({ length: items.length }, () => null);
      for (const item of items) {
        const id = attribute(item, 'ID', 4094);
        assert(id < items.length && indexed[id] === null, msg('error.legacyMacroIndex'));
        assert(children(children(item, 'List')[0], 'x').length === 0, msg('error.legacyNested'));
        indexed[id] = item.getAttribute('t1');
        assert(indexed[id] !== null, msg('error.legacyMacroName'));
      }
      const custom = mode === 3 && !attribute(list, 'IsAutoInterval', 1, 0);
      if (custom) assert(indexed.length % 2 === 1, msg('error.legacyLastKey'));
      indexed.forEach((entry, i) => {
        assert(entry !== null, msg('error.legacyMacroIncomplete'));
        if (custom && i % 2) {
          const match = /^<(\d+) ms>$/.exec(entry);
          assert(match, msg('error.legacyDelay'));
          def.delays.push(integer(Number(match[1]), 65535, msg('field.delay')));
        } else def.keys.push(legacyKey(entry));
      });
      if (mode === 4) {
        def.type = 1;
        def.interval = attribute(list, 'Delay', 65535, 30);
      }
      if (mode === 3) {
        const play = attribute(list, 'PlayMode', 2, 0);
        def.type = play + 2;
        def.cycles = play ? 0 : attribute(list, 'Cycles', 255, 1);
        def.customDelay = custom ? 1 : 0;
        def.interval = custom ? 0 : attribute(list, 'Delay', 65535, 30);
      }
    }
    records[index] = encodeDefinition(def, index, model);
  }
  const profile = Profile.fromReports(records.flat(), model);
  profile.version = version;
  profile.identity = { ...identity };
  profile.legacyXML = text;
  const areas = children(children(document.documentElement, 'BackgroundLightSettings')[0], 'AREA');
  if (areas.length) {
    assert(areas.length === model.keyCount, msg('error.legacyLights'));
    const seen = new Set(),
      bytes = new Uint8Array(model.keyCount * 3);
    for (const area of areas) {
      const key = attribute(area, 'ID', model.keyCount);
      assert(key >= 1 && !seen.has(key), msg('error.legacyLightIndex'));
      seen.add(key);
      ['Red', 'Green', 'Blue'].forEach((name, i) => {
        bytes[(key - 1) * 3 + i] = attribute(area, name, 255);
      });
    }
    profile.lights = bytes;
  }
  return profile;
}
