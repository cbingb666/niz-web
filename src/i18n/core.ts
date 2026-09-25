import { zhCN } from './zh-CN.ts';
import { en } from './en.ts';

export const locales = ['zh-CN', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'zh-CN';
export const localeNames: Record<Locale, string> = { 'zh-CN': '简体中文', en: 'English' };
export const dictionaries = { 'zh-CN': zhCN, en };
export type MessageKey = keyof typeof zhCN;
export type Message =
  string | { key: MessageKey; params?: Record<string, Message | number> } | { parts: Message[] };
type Placeholders<S extends string> = S extends `${string}{${infer Key}}${infer Rest}`
  ? Key | Placeholders<Rest>
  : never;
export type MessageArgs<K extends MessageKey> = [Placeholders<(typeof zhCN)[K]>] extends [never]
  ? []
  : [params: Record<Placeholders<(typeof zhCN)[K]>, Message | number>];
export type CountKey = {
  [K in MessageKey]: Placeholders<(typeof zhCN)[K]> extends 'count'
    ? 'count' extends Placeholders<(typeof zhCN)[K]>
      ? K
      : never
    : never;
}[MessageKey];

/** Store message identities, not rendered text, so history can change language too. */
export function msg<K extends MessageKey>(key: K, ...args: MessageArgs<K>): Message {
  return { key, params: args[0] };
}
export function joinMessages(...parts: Message[]): Message {
  return { parts };
}
export function countMessage(count: number, one: CountKey, other: CountKey): Message {
  return msg(count === 1 ? one : other, { count });
}
export function renderMessage(message: Message, locale: Locale = defaultLocale): string {
  if (typeof message === 'string') return message;
  if ('parts' in message) return message.parts.map((part) => renderMessage(part, locale)).join('');
  const template = dictionaries[locale][message.key];
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = message.params?.[key];
    return typeof value === 'number'
      ? String(value)
      : value === undefined
        ? `{${key}}`
        : renderMessage(value, locale);
  });
}
export function translate<K extends MessageKey>(locale: Locale, key: K, ...args: MessageArgs<K>): string {
  return renderMessage(msg(key, ...args), locale);
}
export function isLocale(value: unknown): value is Locale {
  return value === 'zh-CN' || value === 'en';
}
/** Historic backup reasons are stored strings. Unknown/custom reasons are never rewritten. */
export function backupReason(reason: string): Message {
  if (reason === zhCN['backup.read']) return msg('backup.read');
  if (reason === zhCN['backup.autoRead']) return msg('backup.autoRead');
  if (reason === zhCN['backup.beforeWrite']) return msg('backup.beforeWrite');
  return reason;
}
