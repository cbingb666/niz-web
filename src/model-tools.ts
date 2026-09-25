import { msg, translate, renderMessage, defaultLocale, type Locale } from './i18n/core.ts';
import type { EditorState } from './editor';
import type { HIDSession } from './hid';
import { isRecord, ProtocolError } from './protocol';
export interface ModelTool {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute(input: unknown): unknown;
}
export interface ModelContext {
  registerTool(tool: ModelTool, options: { signal: AbortSignal }): unknown;
}
export interface ModelDependencies {
  editor: EditorState;
  session: Pick<HIDSession, 'state' | 'version'> & Partial<Pick<HIDSession, 'model'>>;
  canStage(): boolean;
  onStaged(): void;
}
import { assert, integer, parseSequence } from './protocol';

function object(input: unknown, allowed: string[]): asserts input is Record<string, unknown> {
  assert(isRecord(input), msg('error.toolObject'));
  assert(
    Object.keys(input).every((key) => allowed.includes(key)),
    msg('error.toolFields'),
  );
}
// Optional, page-scoped tools. They can stage edits, never authorize USB or write hardware.
export function modelTools(
  { editor, session, canStage, onStaged }: ModelDependencies,
  locale: Locale = defaultLocale,
): ModelTool[] {
  const tools: ModelTool[] = [
    {
      name: 'atom66_read_status',
      title: translate(locale, 'tools.status'),
      description: translate(locale, 'tools.statusDescription'),
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        object(input, []);
        return {
          model: editor.model.id,
          deviceModel: session.model?.id ?? null,
          keyCount: editor.model.keyCount,
          layers: editor.model.layers.map((label) => renderMessage(label, locale)),
          connection: session.state,
          firmware: session.version,
          profileLoaded: !!editor.profile,
          groups: editor.profile?.groupCount ?? 0,
          source: editor.source,
          changedKeys: editor.changes.length,
          lightsChanged: editor.lightsChanged,
          requiresExplicitUserWrite: true,
        };
      },
    },
    {
      name: 'atom66_read_keys',
      title: translate(locale, 'tools.keys'),
      description: translate(locale, 'tools.keysDescription'),
      inputSchema: {
        type: 'object',
        properties: {
          layer: { type: 'integer', minimum: 0, maximum: editor.model.layers.length - 1 },
          keys: {
            type: 'array',
            items: { type: 'integer', minimum: 0, maximum: editor.model.keyCount - 1 },
            minItems: 1,
            maxItems: editor.model.keyCount,
          },
        },
        required: ['layer', 'keys'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        object(input, ['layer', 'keys']);
        const layer = integer(input.layer, editor.model.layers.length - 1, msg('field.toolLayer'));
        assert(editor.profile, msg('error.toolProfile'));
        assert(
          Array.isArray(input.keys) && input.keys.length > 0 && input.keys.length <= editor.model.keyCount,
          msg('error.toolKeys'),
        );
        const profile = editor.profile;
        return {
          layer,
          keys: input.keys.map((key: unknown) => {
            const position = integer(key, editor.model.keyCount - 1, msg('field.toolKey'));
            return { key: position, definition: profile.definition(layer * editor.model.keyCount + position) };
          }),
        };
      },
    },
    {
      name: 'atom66_stage_key_edits',
      title: translate(locale, 'tools.stage'),
      description: translate(locale, 'tools.stageDescription'),
      inputSchema: {
        type: 'object',
        properties: {
          edits: {
            type: 'array',
            minItems: 1,
            maxItems: editor.model.editableRecords,
            items: {
              type: 'object',
              properties: {
                layer: { type: 'integer', minimum: 0, maximum: editor.model.layers.length - 1 },
                key: { type: 'integer', minimum: 0, maximum: editor.model.keyCount - 1 },
                type: { type: 'integer', minimum: 0, maximum: 4 },
                sequence: { type: 'string', maxLength: 65536 },
                interval: { type: 'integer', minimum: 0, maximum: 65535 },
                cycles: { type: 'integer', minimum: 1, maximum: 255 },
                customDelay: { type: 'boolean' },
              },
              required: ['layer', 'key', 'type', 'sequence'],
              additionalProperties: false,
            },
          },
        },
        required: ['edits'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        object(input, ['edits']);
        assert(canStage(), msg('error.toolBusy'));
        assert(
          Array.isArray(input.edits) && input.edits.length > 0 && input.edits.length <= editor.model.editableRecords,
          msg('error.toolEdits'),
        );
        const edits = input.edits.map((edit: unknown) => {
          object(edit, ['layer', 'key', 'type', 'sequence', 'interval', 'cycles', 'customDelay']);
          const layer = integer(edit.layer, editor.model.layers.length - 1, msg('field.toolLayer')),
            key = integer(edit.key, editor.model.keyCount - 1, msg('field.toolKey')),
            type = integer(edit.type, 4, msg('field.toolType'));
          assert(
            typeof edit.sequence === 'string' && edit.sequence.length <= 65536,
            msg('error.toolSequence'),
          );
          if (edit.customDelay !== undefined)
            assert(typeof edit.customDelay === 'boolean', msg('error.toolDelay'));
          if (edit.interval !== undefined) integer(edit.interval, 65535, msg('field.interval'));
          if (edit.cycles !== undefined) integer(edit.cycles, 255, msg('field.cycles'), 1);
          return {
            index: layer * editor.model.keyCount + key,
            definition: parseSequence(edit.sequence, {
              type,
              interval:
                edit.interval === undefined ? 30 : integer(edit.interval, 65535, msg('field.interval')),
              cycles: edit.cycles === undefined ? 1 : integer(edit.cycles, 255, msg('field.cycles'), 1),
              customDelay: edit.customDelay ?? false,
            }),
          };
        });
        editor.applyDefinitions(edits);
        onStaged();
        return { staged: edits.length, changedRecords: editor.changes.length, hardwareWritten: false };
      },
    },
  ];
  return tools.map((tool) => ({
    ...tool,
    execute(input) {
      try {
        return tool.execute(input);
      } catch (error) {
        if (error instanceof ProtocolError) {
          error.message = renderMessage(error.description, locale);
        }
        throw error;
      }
    },
  }));
}
export function registerModelTools(
  context: ModelContext | undefined,
  dependencies: ModelDependencies,
  onError: (error: unknown) => void = () => {},
  locale: Locale = defaultLocale,
) {
  const lifecycle = new AbortController();
  if (context?.registerTool)
    for (const tool of modelTools(dependencies, locale)) {
      try {
        Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(onError);
      } catch (error) {
        onError(error);
      }
    }
  return () => lifecycle.abort();
}
