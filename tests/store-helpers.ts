import { onTestFinished, expect, vi } from 'vitest';
import { HIDSession } from '../src/hid';
import { createAppStore, type AppStore, type AppDependencies } from '../src/store/app-store';
import type { Backups, BackupRow } from '../src/storage';
import { Profile } from '../src/protocol';
import { FakeHID } from './helpers';
import { supportedModels } from '../src/devices';

export function memoryBackups(models = supportedModels): Backups {
  const rows: BackupRow[] = [];
  return {
    save: vi.fn(async (profile, reason = '读取备份') => {
      const row = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        reason,
        version: profile.version,
        records: profile.records.length,
        profile: profile.toJSON(),
      };
      rows.push(row);
      return row.id;
    }),
    list: vi.fn(async () => rows.slice()),
    profile: vi.fn(async (id: string) => {
      const row = rows.find((row) => row.id === id);
      if (!row) throw new Error('备份不存在');
      return Profile.fromJSON(row.profile, models);
    }),
  };
}
export function application(
  hid: FakeHID | null = null,
  backups: Backups = memoryBackups(),
  preferences: Pick<AppDependencies, 'locale' | 'onLocaleChange'> = {},
  sessionOptions: ConstructorParameters<typeof HIDSession>[1] = {},
) {
  const session = new HIDSession(hid, { timeout: 50, retryMs: 60_000, ...sessionOptions });
  const download = vi.fn();
  const store = createAppStore({ session, backups, download, ...preferences });
  onTestFinished(() => store.getState().actions.stop());
  return { store, session, backups, download, actions: store.getState().actions };
}
export async function ready(store: AppStore) {
  await vi.waitFor(() => {
    expect(store.getState().busy).toBe('');
    expect(store.getState().session.pending).toBe(0);
  });
}
export function profileFile(profile: Profile) {
  const text = JSON.stringify(profile.toJSON());
  return { name: 'config.json', size: text.length, text: async () => text };
}
