import type { KeyDefinition, Profile } from './protocol';
import { macCodeAvailable, macFunctionRowCodes } from './mac-keycodes';

export interface MacFunctionKeyPlan {
  supported: boolean;
  edits: { index: number; definition: KeyDefinition }[];
  protectedIndices: number[];
}

/** Convert existing single F-key mappings, regardless of their physical position. */
export function planMacFunctionKeys(profile: Profile): MacFunctionKeyPlan {
  const { model } = profile;
  const plan: MacFunctionKeyPlan = {
    supported: macFunctionRowCodes.every(code => macCodeAvailable(code, model.id, profile.version)),
    edits: [], protectedIndices: [],
  };
  if (!plan.supported) return plan;
  const definitions = Array.from({ length: model.editableRecords }, (_, index) => profile.definition(index));
  const fnKeys = new Set(definitions.flatMap((definition, index) =>
    definition.type === 0 && definition.keys.length === 1 && model.fn.codes.includes(definition.keys[0])
      ? [index % model.keyCount] : []));
  definitions.forEach((definition, index) => {
    if (definition.type !== 0 || definition.keys.length !== 1) return;
    const code = definition.keys[0];
    if (code < 2 || code > 13) return;
    // applyDefinitions synchronizes linked Fn positions. Preserve them wholesale.
    if (fnKeys.has(index % model.keyCount)) plan.protectedIndices.push(index);
    else plan.edits.push({ index, definition: { type: 0, keys: [macFunctionRowCodes[code - 2]] } });
  });
  return plan;
}
