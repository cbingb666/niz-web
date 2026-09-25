import { test } from 'vitest';
import assert from 'node:assert/strict';
import { BackupStore } from '../src/storage.ts';
import { fixture } from './helpers.ts';

function mockDatabase() {
  const rows = new Map(),
    transactions = [];
  const database = {
    closed: false,
    close() {
      this.closed = true;
    },
    createObjectStore(name, options) {
      assert.equal(name, 'backups');
      assert.equal(options.keyPath, 'id');
    },
    transaction(name, mode) {
      assert.equal(name, 'backups');
      const transaction = { mode, request: null, action: null };
      transaction.objectStore = () => ({
        add(row) {
          const request = {};
          transaction.request = request;
          transaction.action = () => {
            rows.set(row.id, structuredClone(row));
            return row.id;
          };
          return request;
        },
        getAll() {
          const request = {};
          transaction.request = request;
          transaction.action = () => [...rows.values()].map((row) => structuredClone(row));
          return request;
        },
        get(id) {
          const request = {};
          transaction.request = request;
          transaction.action = () => structuredClone(rows.get(id));
          return request;
        },
      });
      transactions.push(transaction);
      return transaction;
    },
  };
  const requests = [];
  const factory = {
    open(name, version) {
      assert.equal(name, 'atom66-web-backups');
      assert.equal(version, 1);
      const request = { result: database };
      requests.push(request);
      return request;
    },
  };
  return { factory, database, rows, requests, transactions };
}
async function pendingTick() {
  await new Promise((resolve) => setImmediate(resolve));
}
function requestSuccess(transaction) {
  transaction.request.result = transaction.action();
  transaction.request.onsuccess();
}
async function openStore() {
  const mock = mockDatabase(),
    store = new BackupStore(mock.factory),
    pending = store.open();
  mock.requests[0].onupgradeneeded();
  mock.requests[0].onsuccess();
  await pending;
  return { ...mock, store };
}

test('backup ID is not returned until the IndexedDB transaction completes', async () => {
  const { store, transactions, rows } = await openStore();
  let done = false;
  const pending = store.save(fixture(9), '写入前').then((id) => {
    done = true;
    return id;
  });
  await pendingTick();
  assert.equal(transactions[0].mode, 'readwrite');
  requestSuccess(transactions[0]);
  await pendingTick();
  assert.equal(done, false);
  transactions[0].oncomplete();
  const id = await pending;
  assert.equal(done, true);
  assert.equal(rows.get(id).records, 594);
  assert.equal(rows.get(id).reason, '写入前');
});
test('transaction abort after request success still rejects the backup', async () => {
  const { store, transactions } = await openStore();
  const pending = store.save(fixture()),
    rejected = assert.rejects(pending, /失败/);
  await pendingTick();
  requestSuccess(transactions[0]);
  transactions[0].onabort();
  await rejected;
});
test('local backup list and profile retrieval retain raw records', async () => {
  const { store, transactions } = await openStore(),
    profile = fixture(9);
  const saved = store.save(profile);
  await pendingTick();
  requestSuccess(transactions[0]);
  transactions[0].oncomplete();
  const id = await saved;
  const listed = store.list();
  await pendingTick();
  requestSuccess(transactions[1]);
  transactions[1].oncomplete();
  assert.equal((await listed).length, 1);
  const loaded = store.profile(id);
  await pendingTick();
  requestSuccess(transactions[2]);
  transactions[2].oncomplete();
  assert.deepEqual((await loaded).toJSON(), profile.toJSON());
  const missing = store.profile('missing'),
    rejected = assert.rejects(missing, /不存在/);
  await pendingTick();
  requestSuccess(transactions[3]);
  transactions[3].oncomplete();
  await rejected;
});
test('missing, failed or blocked storage never pretends to save a backup', async () => {
  await assert.rejects(new BackupStore(null).save(fixture()), /未提供/);
  const mock = mockDatabase(),
    store = new BackupStore(mock.factory),
    pending = store.open(),
    rejected = assert.rejects(pending, /无法打开/);
  mock.requests[0].onerror();
  await rejected;
  assert.equal(store.database, null);
  const again = store.open(),
    blocked = assert.rejects(again, /占用/);
  mock.requests[1].onblocked();
  await blocked;
  assert.equal(store.database, null);
  mock.requests[1].onsuccess();
  assert.equal(mock.database.closed, true);
});
test('version change closes cached database handles', async () => {
  const { store, database } = await openStore();
  assert.ok(store.database);
  database.onversionchange();
  assert.equal(database.closed, true);
  assert.equal(store.database, null);
});
