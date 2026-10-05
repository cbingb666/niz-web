import { onTestFinished, test, vi } from 'vitest';
import assert from 'node:assert/strict';
import { BackupStore } from '../src/storage.ts';
import { Profile } from '../src/protocol.ts';
import { HIDSession } from '../src/hid.ts';
import { fixture, FakeDevice, FakeHID } from './helpers.ts';

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
      let snapshot;
      const transaction = {
        mode,
        requests: [],
        data() {
          snapshot ??= new Map(rows);
          return snapshot;
        },
        commit() {
          if (mode !== 'readwrite') return;
          rows.clear();
          for (const [id, row] of transaction.data()) rows.set(id, row);
        },
      };
      function enqueue(action) {
        const listeners = [];
        const request = {
          addEventListener(type, listener) {
            assert.equal(type, 'success');
            listeners.push(listener);
          },
        };
        transaction.requests.push({ request, action, listeners });
        return request;
      }
      transaction.objectStore = () => ({
        add(row) {
          return enqueue(() => {
            assert.equal(transaction.data().has(row.id), false);
            transaction.data().set(row.id, structuredClone(row));
            return row.id;
          });
        },
        put(row) {
          return enqueue(() => {
            transaction.data().set(row.id, structuredClone(row));
            return row.id;
          });
        },
        getAll() {
          return enqueue(() => [...transaction.data().values()].map(row => structuredClone(row)));
        },
        get(id) {
          return enqueue(() => structuredClone(transaction.data().get(id)));
        },
        delete(id) {
          return enqueue(() => { transaction.data().delete(id); });
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
  while (transaction.requests.length) {
    const { request, action, listeners } = transaction.requests.shift();
    request.result = action();
    listeners.forEach(listener => listener());
    request.onsuccess?.();
  }
}
function completeTransaction(transaction) {
  transaction.commit();
  transaction.oncomplete();
}
async function completeOperation(context, operation) {
  const index = context.transactions.length;
  const pending = operation();
  await pendingTick();
  const transaction = context.transactions[index];
  requestSuccess(transaction);
  completeTransaction(transaction);
  return pending;
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
  completeTransaction(transactions[0]);
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
  completeTransaction(transactions[0]);
  const id = await saved;
  const listed = store.list();
  await pendingTick();
  requestSuccess(transactions[1]);
  completeTransaction(transactions[1]);
  assert.equal((await listed).length, 1);
  const loaded = store.profile(id);
  await pendingTick();
  requestSuccess(transactions[2]);
  completeTransaction(transactions[2]);
  assert.deepEqual((await loaded).toJSON(), profile.toJSON());
  const missing = store.profile('missing'),
    rejected = assert.rejects(missing, /不存在/);
  await pendingTick();
  requestSuccess(transactions[3]);
  completeTransaction(transactions[3]);
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

test.each([false, true])('deleting a backup and its hidden duplicates waits for commit (abort: %s)', async abort => {
  const context = await openStore();
  const profile = fixture(9, true);
  const id = await completeOperation(context, () => context.store.save(profile));
  const duplicate = structuredClone(context.rows.get(id));
  duplicate.id = 'old-copy';
  duplicate.createdAt = 1;
  duplicate.profile.counters[0]++;
  context.rows.set(duplicate.id, duplicate);
  const other = structuredClone(duplicate);
  other.id = 'other-version';
  other.profile.version += 'different';
  context.rows.set(other.id, other);

  let done = false;
  const pending = context.store.remove(id).then(() => { done = true; });
  const rejected = abort ? assert.rejects(pending, /失败/) : null;
  await pendingTick();
  const transaction = context.transactions.at(-1);
  assert.equal(transaction.mode, 'readwrite');
  requestSuccess(transaction);
  await pendingTick();
  assert.equal(done, false);
  assert.equal(context.rows.size, 3);
  if (abort) {
    transaction.onabort();
    await rejected;
    assert.equal(context.rows.size, 3);
  } else {
    completeTransaction(transaction);
    await pending;
    assert.deepEqual([...context.rows.keys()], ['other-version']);
    const listed = await completeOperation(context, () => context.store.list());
    assert.deepEqual(listed.map(row => row.id), ['other-version']);
    await completeOperation(context, () => context.store.remove(id));
    assert.equal(context.rows.size, 1);
  }
});

test('repeated reads and pre-write backups reuse an identical saved configuration', async () => {
  const { store, transactions, rows } = await openStore();
  const profile = fixture();
  const first = store.save(profile, '读取备份');
  await pendingTick();
  requestSuccess(transactions[0]);
  completeTransaction(transactions[0]);
  const firstId = await first;

  const repeated = store.save(profile.clone(), '写入前');
  await pendingTick();
  requestSuccess(transactions[1]);
  completeTransaction(transactions[1]);
  const repeatedId = await repeated;

  assert.equal(rows.size, 1);
  assert.equal(repeatedId, firstId);
});

test('a reused backup refreshes its full snapshot and time without adding a version for counts', async () => {
  const context = await openStore();
  const profile = fixture(9, true);
  const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
  const id = await completeOperation(context, () => context.store.save(profile));
  profile.counters[0] = 123456;
  now.mockReturnValue(2000);
  const updatedId = await completeOperation(context, () => context.store.save(profile, '固件刷写前'));

  assert.equal(updatedId, id);
  assert.equal(context.rows.size, 1);
  assert.equal(context.rows.get(id).createdAt, 2000);
  assert.equal(context.rows.get(id).reason, '固件刷写前');
  const loaded = await completeOperation(context, () => context.store.profile(id));
  assert.deepEqual(loaded.toJSON(), profile.toJSON());
});

test('a read without counters keeps the latest available counts for the same configuration', async () => {
  const context = await openStore();
  const complete = fixture();
  complete.counters[0] = 123456;
  const id = await completeOperation(context, () => context.store.save(complete));
  const withoutCounts = complete.clone();
  withoutCounts.counters = [];
  assert.equal(await completeOperation(context, () => context.store.save(withoutCounts, '写入前')), id);
  assert.deepEqual(context.rows.get(id).profile.counters, complete.counters);
  assert.deepEqual(withoutCounts.counters, []);
});

test('returning to an earlier configuration reuses its backup across different intervening versions', async () => {
  const context = await openStore();
  const original = fixture();
  const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
  const originalId = await completeOperation(context, () => context.store.save(original));
  const edited = original.clone();
  edited.setDefinition(0, { type: 0, keys: [44] });
  now.mockReturnValue(2000);
  const editedId = await completeOperation(context, () => context.store.save(edited));
  now.mockReturnValue(3000);
  const restoredId = await completeOperation(context, () => context.store.save(original));
  const listed = await completeOperation(context, () => context.store.list());

  assert.equal(restoredId, originalId);
  assert.notEqual(editedId, originalId);
  assert.equal(context.rows.size, 2);
  assert.deepEqual(listed.map(row => row.id), [originalId, editedId]);
});

test('matching raw reports never merge configurations belonging to different models', async () => {
  const context = await openStore();
  const original = fixture();
  // A virtual model isolates ownership from report length and device metadata.
  const other = Object.assign(new Profile(original.records, { ...original.model, id: 'backup-test-model' }), {
    version: original.version, identity: original.identity, counters: original.counters,
  });
  const id = await completeOperation(context, () => context.store.save(original));
  const otherId = await completeOperation(context, () => context.store.save(other));
  assert.notEqual(otherId, id);
  assert.equal((await completeOperation(context, () => context.store.list())).length, 2);
});

test('three-group and nine-group backups retain distinct full snapshots', async () => {
  const context = await openStore();
  const shortId = await completeOperation(context, () => context.store.save(fixture(3)));
  const fullId = await completeOperation(context, () => context.store.save(fixture(9)));
  assert.notEqual(shortId, fullId);
  assert.equal((await completeOperation(context, () => context.store.profile(shortId))).groupCount, 3);
  assert.equal((await completeOperation(context, () => context.store.profile(fullId))).groupCount, 9);
});

test.each([
  ['keys', profile => profile.setDefinition(0, { type: 0, keys: [44] })],
  ['macro continuation bytes', profile => { profile.records[0][1][63] ^= 1; }],
  ['opaque extended group bytes', profile => { profile.records[198][0][63] ^= 1; }],
  ['lighting', profile => { profile.lights[0] ^= 1; }],
  ['firmware', profile => { profile.version += 'different'; }],
  ['device identity', profile => { profile.identity.ProductID += 1; }],
  ['legacy attachment', profile => { profile.legacyXML = '<backup />'; }],
])('different %s retain a separate complete recovery snapshot', async (_label, change) => {
  const context = await openStore();
  const original = fixture(9, true);
  original.setDefinition(0, { type: 2, keys: Array(100).fill(43), interval: 30, cycles: 1, customDelay: 0 });
  const originalId = await completeOperation(context, () => context.store.save(original));
  const edited = original.clone();
  change(edited);
  const editedId = await completeOperation(context, () => context.store.save(edited));
  assert.notEqual(originalId, editedId);
  assert.equal((await completeOperation(context, () => context.store.list())).length, 2);
  assert.deepEqual((await completeOperation(context, () => context.store.profile(originalId))).toJSON(), original.toJSON());
  assert.deepEqual((await completeOperation(context, () => context.store.profile(editedId))).toJSON(), edited.toJSON());
});

test('legacy duplicate rows show only the latest snapshot and keep old IDs downloadable', async () => {
  const context = await openStore();
  const profile = fixture(9, true);
  const old = { id: 'old', createdAt: 1000, reason: '读取备份', version: profile.version, records: 594, profile: profile.toJSON() };
  const latest = structuredClone(old);
  latest.id = 'latest';
  latest.createdAt = 3000;
  latest.profile.model = 'atom66';
  latest.profile.reports = latest.profile.reports.map(report => report.toUpperCase());
  latest.profile.lights = latest.profile.lights.toUpperCase();
  latest.profile.identity = Object.fromEntries(Object.entries(latest.profile.identity).reverse());
  latest.profile.counters[0] += 100;
  const different = structuredClone(old);
  different.id = 'different-firmware';
  different.createdAt = 2000;
  different.profile.version += 'different';
  context.rows.set(old.id, old);
  context.rows.set(latest.id, latest);
  context.rows.set(different.id, different);

  const listed = await completeOperation(context, () => context.store.list());
  assert.deepEqual(listed.map(row => row.id), ['latest', 'different-firmware']);
  assert.equal(listed[0].profile.counters[0], latest.profile.counters[0]);
  assert.equal(context.rows.size, 3);
  const loaded = await completeOperation(context, () => context.store.profile('old'));
  assert.deepEqual(loaded.toJSON(), profile.toJSON());
  assert.equal(await completeOperation(context, () => context.store.save(profile)), 'latest');
  assert.equal(context.rows.size, 3);
});

test('reusing an existing backup still waits for commit and rejects an aborted update', async () => {
  const context = await openStore();
  const profile = fixture();
  const id = await completeOperation(context, () => context.store.save(profile));
  const original = structuredClone(context.rows.get(id));
  profile.counters[0]++;
  let done = false;
  const pending = context.store.save(profile, '写入前').then(updatedId => {
    done = true;
    return updatedId;
  });
  const rejected = assert.rejects(pending, /失败/);
  await pendingTick();
  const transaction = context.transactions[1];
  assert.equal(transaction.mode, 'readwrite');
  requestSuccess(transaction);
  await pendingTick();
  assert.equal(done, false);
  assert.deepEqual(context.rows.get(id), original);
  transaction.onabort();
  await rejected;
  assert.equal(context.rows.size, 1);
  assert.deepEqual(context.rows.get(id), original);
});

test.each([false, true])('configuration writes wait for a reused backup transaction (abort: %s)', async abort => {
  const context = await openStore();
  const device = new FakeDevice(fixture(9));
  const session = new HIDSession(new FakeHID([device]), { timeout: 50, retryMs: 60000 });
  onTestFinished(() => session.stop());
  await session.start();
  const { profile: baseline } = await session.read();
  const id = await completeOperation(context, () => context.store.save(baseline));
  const target = baseline.clone();
  target.setDefinition(0, { type: 0, keys: [43] });
  device.profile.counters[0]++;
  const pending = session.write(target, (profile, reason) => context.store.save(profile, reason));
  const rejected = abort ? assert.rejects(pending, /失败/) : null;
  await pendingTick();
  const transaction = context.transactions[1];
  requestSuccess(transaction);
  await pendingTick();
  const writes = () => device.sent.filter(packet => [0xf1, 0xf0, 0xf6, 0xe1, 0xe0, 0xe6].includes(packet[1]));
  assert.equal(writes().length, 0);
  assert.equal(context.rows.size, 1);
  if (abort) {
    transaction.onabort();
    await rejected;
    assert.equal(writes().length, 0);
    assert.equal(context.rows.get(id).profile.counters[0], baseline.counters[0]);
  } else {
    completeTransaction(transaction);
    await pending;
    assert.ok(writes().length > 0);
    assert.equal(context.rows.size, 1);
    assert.deepEqual(context.rows.get(id).profile.counters, baseline.counters);
    assert.deepEqual(device.profile.reports, target.reports);
  }
});
