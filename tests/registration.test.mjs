import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../src/index.js';

function setup() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE tenants (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, admin_token TEXT NOT NULL, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE tenant_tokens (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, name TEXT NOT NULL, token TEXT NOT NULL UNIQUE, role TEXT NOT NULL CHECK(role IN ('admin','editor')), created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE categories (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, name TEXT NOT NULL, icon TEXT DEFAULT 'book', sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(tenant_id,name));
    CREATE TABLE bookmarks (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE, title TEXT NOT NULL, url TEXT NOT NULL, icon_url TEXT, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO tenants (id,slug,name,admin_token) VALUES (1,'zhaotao','Existing tenant','existing-admin');
    INSERT INTO tenant_tokens (tenant_id,name,token,role) VALUES (1,'Existing admin','existing-admin','admin');
    INSERT INTO categories (id,tenant_id,name) VALUES (1,1,'Existing group');
    INSERT INTO bookmarks (tenant_id,category_id,title,url) VALUES (1,1,'Existing bookmark','https://existing.example/');`);
  const db = {
    prepare(query) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return sql.prepare(query).get(...args) || null; },
        async all() { return {results:sql.prepare(query).all(...args)}; },
        async run() { const result=sql.prepare(query).run(...args); return {meta:{last_row_id:Number(result.lastInsertRowid),changes:Number(result.changes)}}; },
      };
    },
    async batch(statements) {
      sql.exec('BEGIN');
      try { const result=[]; for (const statement of statements) result.push(await statement.run()); sql.exec('COMMIT'); return result; }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  const env = {DB:db,ADMIN_TOKEN:'platform-test-token',REGISTRATION_LIMITER:{async limit(){return {success:true};}}};
  const call = async (path, body, token) => {
    const request = new Request(`https://api.example/api/${path}`, {method:body?'POST':'GET',headers:{'content-type':'application/json','cf-connecting-ip':'192.0.2.1',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const response = await onRequest({request,env,params:{path:path.split('?')[0]}});
    return {status:response.status,body:await response.json()};
  };
  return {sql,env,call};
}
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
