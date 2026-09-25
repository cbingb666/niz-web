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
    await this.transaction('readwrite', (store) => store.add(row));
    return row.id;
  }
  async list(): Promise<BackupRow[]> {
    return (await this.transaction<BackupRow[]>('readonly', (store) => store.getAll())).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }
  async profile(id: string): Promise<Profile> {
    const row = await this.transaction<BackupRow | undefined>('readonly', (store) => store.get(id));
    if (!row) throw new ProtocolError(msg('error.backupMissing'));
    return Profile.fromJSON(row.profile);
  }
}
