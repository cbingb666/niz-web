import { msg, type Message } from '../i18n/core';
import type { HIDAccess } from '../types/hid';
import type { ModelContext } from '../model-tools';

declare global {
  interface Navigator {
    readonly hid?: HIDAccess;
  }
  interface Document {
    readonly permissionsPolicy?: { allowsFeature(feature: string): boolean };
    readonly featurePolicy?: { allowsFeature(feature: string): boolean };
    readonly modelContext?: ModelContext;
  }
}

export function browserEnvironment() {
  const notices: Message[] = [];
  const policy = document.permissionsPolicy ?? document.featurePolicy;
  const allowed = !policy || policy.allowsFeature('hid');
  if (!globalThis.isSecureContext) notices.push(msg('environment.secure'));
  if (!navigator.hid) notices.push(msg('environment.unsupported'));
  if (!allowed) notices.push(msg('environment.policy'));
  if (window.top !== window.self) notices.push(msg('environment.embedded'));
  if (location.protocol === 'file:') notices.push(msg('environment.file'));
  return { notices, hid: globalThis.isSecureContext && allowed ? (navigator.hid ?? null) : null };
}
export function downloadJSON(label: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `ATOM66-${label}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
