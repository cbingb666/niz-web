import { useAppStore } from '../store/context';
import {
  countMessage,
  renderMessage,
  translate,
  type CountKey,
  type Message,
  type MessageArgs,
  type MessageKey,
} from './core';

export function useI18n() {
  const locale = useAppStore((state) => state.locale);
  return {
    locale,
    t: <K extends MessageKey>(key: K, ...args: MessageArgs<K>) => translate(locale, key, ...args),
    text: (message: Message) => renderMessage(message, locale),
    count: (value: number, one: CountKey, other: CountKey) =>
      renderMessage(countMessage(value, one, other), locale),
  };
}
