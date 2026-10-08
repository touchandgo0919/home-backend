import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.mjs';

const signup = {name:'测试导航',registration_key:'a'.repeat(64)};

test('registration creates an isolated editor, token and default group; existing data stays intact', async () => {
  const {sql,call}=setup();
  const response=await call('auth/register',{...signup,role:'platform',slug:'zhaotao',admin_token:'attacker'});
  assert.equal(response.status,201);
  assert.match(response.body.token,/^[a-f0-9]{64}$/);
  assert.equal(response.body.nav.role,'editor');
  assert.equal(response.body.nav.data[0].category,'我的收藏');
  assert.equal(response.body.nav.data[0].links.length,0);
  const nav=await call('nav',null,response.body.token);
  assert.equal(nav.body.tenant.id,response.body.nav.tenant.id);
  assert.equal(nav.body.data.length,1);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM bookmarks WHERE tenant_id=1').get().n,1);
  assert.equal((await call('tenants',null,response.body.token)).status,403);
  assert.equal((await call('tokens',null,response.body.token)).status,403);
  assert.equal((await call('nav?tenant=zhaotao',null,response.body.token)).status,403);
  assert.equal((await call('bookmarks',{category_id:1,title:'Cross tenant',url:'https://example.com/'},response.body.token)).status,404);
});

test('retry recovers the same token, does not create duplicate data or overwrite a name', async () => {
  const {sql,call}=setup();
  const first=await call('auth/register',signup);
  const second=await call('auth/register',{...signup,name:'Another name'});
  assert.equal(second.body.token,first.body.token);
  assert.equal(second.body.nav.tenant.id,first.body.nav.tenant.id);
  assert.equal(second.body.nav.tenant.name,signup.name);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM tenants').get().n,2);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM tenant_tokens').get().n,2);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM categories').get().n,2);
});

test('failed registration transaction leaves no half-created tenant or token', async () => {
  const {sql,call}=setup();
  sql.exec("CREATE TRIGGER reject_new_group BEFORE INSERT ON categories BEGIN SELECT RAISE(ABORT,'test failure'); END;");
  assert.equal((await call('auth/register',signup)).status,500);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM tenants').get().n,1);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM tenant_tokens').get().n,1);
});

test('registration validates inputs, applies the limiter and fails closed without its binding', async () => {
  const {sql,call,env}=setup();
  for(const body of [{...signup,name:''},{...signup,name:'a'.repeat(41)},{...signup,registration_key:'short'}]) assert.equal((await call('auth/register',body)).status,400);
  env.REGISTRATION_LIMITER={async limit(){return {success:false};}};
  assert.equal((await call('auth/register',signup)).status,429);
  delete env.REGISTRATION_LIMITER;
  assert.equal((await call('auth/register',signup)).status,503);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM tenants').get().n,1);
});

test('tenant admins cannot enumerate all tokens or create global tenants; platform access remains', async () => {
  const {call}=setup();
  assert.equal((await call('tenants',null,'existing-admin')).status,403);
  assert.equal((await call('tenants',{slug:'other',admin_token:'other-token'},'existing-admin')).status,403);
  assert.equal((await call('tokens',null,'existing-admin')).status,200);
  assert.equal((await call('tenants',null,'platform-test-token')).status,200);
});

test('registration retries and legacy auth cannot resurrect a revoked signup token', async () => {
  const {sql,call}=setup();
  const {body}=await call('auth/register',signup);
  sql.prepare('DELETE FROM tenant_tokens WHERE token=?').run(body.token);
  assert.equal((await call('auth/register',signup)).status,409);
  assert.equal((await call(`auth/session?tenant=${body.nav.tenant.slug}`,null,body.token)).status,401);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM tenant_tokens').get().n,1);
});
