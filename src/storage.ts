import { msg } from './i18n/core.ts';
import { Profile, ProtocolError, type ProfileJSON } from './protocol';

export interface BackupRow {
  id: string;
  createdAt: number;
  reason: string;
  version: string;
  records: number;
  profile: ProfileJSON;
}
export interface Backups {
  save(profile: Profile, reason?: string): Promise<string>;
  list(): Promise<BackupRow[]>;
  profile(id: string): Promise<Profile>;
}

function orderedIdentity(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(orderedIdentity);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, orderedIdentity(entry)]),
    );
  return value;
}

function configurationKey(profile: ProfileJSON): string {
  // Counters change while typing; compare every configuration byte, including opaque groups.
  return JSON.stringify([
    profile.schema,
    profile.format === 'atom66-macos' ? 'atom66' : profile.model,
    profile.version,
    orderedIdentity(profile.identity),
    profile.reports.map(report => report.toLowerCase()),
    profile.lights?.toLowerCase() ?? null,
    profile.legacyXML ?? null,
  ]);
}

function latestConfigurations(rows: BackupRow[]): BackupRow[] {
  const keys = new Set<string>();
  return rows.sort((a, b) => b.createdAt - a.createdAt).filter(row => {
    const key = configurationKey(row.profile);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

export class BackupStore implements Backups {
  database: Promise<IDBDatabase> | null = null;
  constructor(readonly indexedDB: IDBFactory | null | undefined = globalThis.indexedDB) {}
  open(): Promise<IDBDatabase> {
    if (!this.indexedDB) return Promise.reject(new ProtocolError(msg('error.storageUnavailable')));
    if (this.database) return this.database;
    this.database = new Promise((resolve, reject) => {
      const request = this.indexedDB!.open('atom66-web-backups', 1);
      let blocked = false;
      request.onupgradeneeded = () => {
        request.result.createObjectStore('backups', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        if (blocked) {
          request.result.close();
          return;
        }
        request.result.onversionchange = () => {
          request.result.close();
          this.database = null;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        this.database = null;
        reject(new ProtocolError(msg('error.storageOpen')));
      };
      request.onblocked = () => {
        blocked = true;
        this.database = null;
        reject(new ProtocolError(msg('error.storageBlocked')));
      };
    });
    return this.database;
  }
  async transaction<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('backups', mode);
      let result: T;
      const request = operation(transaction.objectStore('backups'));
      request.onsuccess = () => {
        result = request.result;
      };
      // Request success is insufficient: only transaction completion is durable.
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = transaction.onabort = () =>
        reject(new ProtocolError(msg('error.storageTransaction')));
    });
  }
  async save(profile: Profile, reason = '读取备份'): Promise<string> {
    const row: BackupRow = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      reason,
      version: profile.version,
      records: profile.records.length,
      profile: profile.toJSON(),
    };
    const key = configurationKey(row.profile);
    await this.transaction('readwrite', store => {
      const request = store.getAll() as IDBRequest<BackupRow[]>;
      request.addEventListener('success', () => {
        const matches = request.result.filter(candidate => configurationKey(candidate.profile) === key)
          .sort((a, b) => b.createdAt - a.createdAt);
        const existing = matches[0];
        if (existing) row.id = existing.id;
        // Pre-write checks omit counters. Keep the most recent available counts in that case.
        if (!row.profile.counters.length) {
          const counted = matches.find(candidate => candidate.profile.counters.length);
          if (counted) row.profile.counters = [...counted.profile.counters];
        }
        // Compare and save in one transaction so simultaneous pages cannot add duplicates.
        // Refresh the snapshot even when reusing its ID.
        store.put(row);
      });
      return request;
    });
    return row.id;
  }
  async list(): Promise<BackupRow[]> {
    // Keep old IDs available for downloads and in-page firmware results.
    return latestConfigurations(await this.transaction<BackupRow[]>('readonly', (store) => store.getAll()));
  }
  async profile(id: string): Promise<Profile> {
    const row = await this.transaction<BackupRow | undefined>('readonly', (store) => store.get(id));
    if (!row) throw new ProtocolError(msg('error.backupMissing'));
    return Profile.fromJSON(row.profile);
  }
}
