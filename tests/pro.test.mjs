import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.mjs';
import { createBackup } from '../src/backups.js';

const admin = 'platform-test-token', user = 'existing-admin';

test('Pro mutations require a server-side entitlement and expiry is enforced', async () => {
  const { call, sql } = setup();
  assert.equal((await call('pro/status', null, user)).body.plan, 'free');
  assert.equal((await call('pro/bookmarks/tag', { ids: [1], tag: 'Read', action: 'add' }, user)).status, 403);
  assert.equal((await call('pro/admin/entitlements/1', { expires_at: Date.now() + 86400000 }, user, 'PUT')).status, 403);
  assert.equal((await call('pro/admin/entitlements/1', { expires_at: Date.now() + 86400000 }, admin, 'PUT')).status, 200);
  assert.equal((await call('pro/status', null, user)).body.plan, 'pro');
  sql.exec('UPDATE tenant_entitlements SET expires_at=1 WHERE tenant_id=1');
  assert.equal((await call('pro/status', null, user)).body.plan, 'free');
  assert.equal((await call('pro/bookmarks/move', { ids: [1], category_id: 1 }, user)).status, 403);
});

test('Pro bulk organization is tenant scoped and tags survive export, import and backup', async () => {
  const { call, env, sql } = setup();
  await call('pro/admin/entitlements/1', { expires_at: null }, admin, 'PUT');
  const other = (await call('auth/register', { name: 'Other', registration_key: 'e'.repeat(64) })).body.token;
  await call('pro/admin/entitlements/2', { expires_at: null }, admin, 'PUT');
  const group = await call('categories', { name: 'Target' }, user);
  assert.equal((await call('pro/bookmarks/move', { ids: [1], category_id: group.body.id }, other)).status, 404);
  assert.equal((await call('pro/bookmarks/tag', { ids: [1], tag: 'Private', action: 'add' }, other)).status, 404);
  assert.equal((await call('pro/links/check', { ids: [1] }, other)).status, 404);
  assert.equal((await call('pro/bookmarks/move', { ids: [1], category_id: group.body.id }, user)).body.moved, 1);
  assert.equal((await call('pro/bookmarks/tag', { ids: [1], tag: 'Read later', action: 'add' }, user)).status, 200);
  assert.deepEqual((await call('pro/organize', null, user)).body.bookmarks[0].tags, ['Read later']);
  assert.equal((await call('pro/bookmarks/tag', { ids: [1], tag: 'Read later', action: 'add' }, user)).status, 200);
  assert.equal(sql.prepare('SELECT count(*) n FROM bookmark_tags').get().n, 1);
  const exported = (await call('data/export', null, user)).body;
  assert.deepEqual(exported.categories.find(group => group.name === 'Target').links[0].tags, ['Read later']);
  assert.equal((await call('data/import', { ...exported, request_id: 'pro-import-abcdefghijklmnop' }, other)).status, 200);
  assert.deepEqual((await call('data/export', null, other)).body.categories.find(group => group.name === 'Target').links[0].tags, ['Read later']);
  const store = new Map(); env.HOME_BACKUPS = { put: async (key, value) => store.set(key, value), get: async key => store.get(key) };
  const backup = await createBackup(env);
  assert.equal(backup.counts.bookmark_tags, 2);
  assert.deepEqual((await call(`backups/${backup.id}`, null, user)).body.categories.find(group => group.name === 'Target').links[0].tags, ['Read later']);
  assert.equal((await call('pro/bookmarks/tag', { ids: [1], tag: 'Read later', action: 'remove' }, user)).status, 200);
  assert.equal(sql.prepare('SELECT count(*) n FROM bookmark_tags WHERE tenant_id=1').get().n, 0);
});

test('Pro link check distinguishes missing pages, caches results and skips local URLs', async () => {
  const { call, env, sql } = setup();
  await call('pro/admin/entitlements/1', { expires_at: null }, admin, 'PUT');
  let fetches = 0;
  env.LINK_CHECK_FETCH = async () => { fetches++; return { status: 404, body: null }; };
  const first = await call('pro/links/check', { ids: [1] }, user);
  assert.equal(first.body.results[0].status, 'missing');
  assert.equal(first.body.results[0].http_status, 404);
  await call('pro/links/check', { ids: [1] }, user);
  assert.equal(fetches, 1);
  sql.exec("UPDATE bookmarks SET url='http://localhost/private',url_key='http://localhost/private' WHERE id=1");
  const skipped = await call('pro/links/check', { ids: [1] }, user);
  assert.equal(skipped.body.results[0].status, 'skipped');
  assert.equal(fetches, 1);
  const day = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  sql.prepare('UPDATE pro_link_check_usage SET count=100 WHERE tenant_id=1 AND day=?').run(day);
  sql.exec("UPDATE bookmarks SET url='https://fresh.example/',url_key='https://fresh.example/' WHERE id=1");
  assert.equal((await call('pro/links/check', { ids: [1] }, user)).status, 429);
  assert.equal(fetches, 1);
});
