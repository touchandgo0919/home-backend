import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers.mjs';
import {createBackup,scheduledBackup} from '../src/backups.js';
const token='existing-admin';
const item={category_id:1,title:'A bookmark',url:'https://example.com',request_id:'request_abcdefghijklmnop'};
test('atomic canonical duplicate prevention and request replay preserve one row',async()=>{
 const {call,sql}=setup();
 const first=await call('bookmarks',item,token);assert.equal(first.status,201);
 const second=await call('bookmarks',item,token);assert.equal(second.body.id,first.body.id);assert.equal(second.body.replayed,true);
 const dup=await call('bookmarks',{...item,url:'https://example.com/',request_id:'another_abcdefghijklmnop'},token);assert.equal(dup.body.duplicate,true);assert.equal(dup.body.id,first.body.id);
 assert.equal((await call('bookmarks',{...item,title:'Changed'},token)).status,409);
 assert.equal(sql.prepare('SELECT count(*) n FROM bookmarks WHERE url_key=?').get('https://example.com/').n,1);
 const check=await call('bookmarks/check?url=https%3A%2F%2Fexample.com',null,token);assert.equal(check.body.bookmark.id,first.body.id);
 const groups=await call('collections',null,token);assert.equal(groups.body.data[0].links,undefined);
});
test('trash hides data, restores complete groups, and keeps separately deleted items deleted',async()=>{
 const {call}=setup();const added=await call('bookmarks',item,token);
 await call('bookmarks/'+added.body.id,null,token,'DELETE');await call('categories/1',null,token,'DELETE');
 assert.equal((await call('nav',null,token)).body.data.length,0);
 assert.equal((await call('trash',null,token)).body.categories.length,1);
 await call('trash/restore',{type:'categories',id:1},token);
 assert.equal((await call('nav',null,token)).body.data[0].links.length,1);
 await call('trash/restore',{type:'bookmarks',id:added.body.id},token);
 assert.equal((await call('nav',null,token)).body.data[0].links.length,2);
});
test('import preview is read-only; apply skips duplicates/invalid URLs and retry is idempotent',async()=>{
 const {call,sql}=setup();const body={categories:[{name:'Imported',links:[{title:'one',url:'https://new.example'},{title:'dup',url:'https://new.example/'},{title:'bad',url:'javascript:alert(1)'}]}],request_id:'import_abcdefghijklmnop'};
 const preview=await call('data/import/preview',body,token);assert.equal(preview.body.added,1);assert.equal(preview.body.duplicates,1);assert.equal(preview.body.invalid,1);
 assert.equal(sql.prepare('SELECT count(*) n FROM bookmarks').get().n,1);
 const applied=await call('data/import',body,token);assert.equal(applied.body.added,1);
 assert.equal((await call('data/import',body,token)).body.replayed,true);
 assert.equal(sql.prepare('SELECT count(*) n FROM bookmarks').get().n,2);
 const exported=await call('data/export',null,token);assert.equal(exported.body.categories.length,2);assert.equal(JSON.stringify(exported.body).includes(token),false);
});
test('import transaction rolls back every write on failure',async()=>{
 const {call,sql}=setup();sql.exec("CREATE TRIGGER fail_import BEFORE INSERT ON bookmarks WHEN NEW.title='bad' BEGIN SELECT RAISE(ABORT,'test');END");
 const response=await call('data/import',{request_id:'rollback_abcdefghijklmnop',categories:[{name:'New',links:[{title:'fine',url:'https://first.example/'},{title:'bad',url:'https://bad.example/'}]}]},token);
 assert.equal(response.status,500);assert.equal(sql.prepare('SELECT count(*) n FROM categories').get().n,1);assert.equal(sql.prepare('SELECT count(*) n FROM bookmarks').get().n,1);
});
test('tenant isolation applies to trash, restores, checks, imports and backups',async()=>{
 const {call,env}=setup();const other=(await call('auth/register',{name:'Other',registration_key:'f'.repeat(64)})).body.token;
 assert.equal((await call('bookmarks/check?url=https://existing.example/',null,other)).body.bookmark,null);
 await call('bookmarks/1',null,other,'DELETE');assert.equal((await call('nav',null,token)).body.data[0].links.length,1);
 assert.equal((await call('trash/restore',{type:'bookmarks',id:1},other)).status,404);
 const store=new Map();env.HOME_BACKUPS={put:async(k,v)=>store.set(k,v),get:async k=>store.get(k)};
 const backup=await createBackup(env);const view=await call('backups/'+backup.id,null,other);assert.equal(view.body.categories.length,1);assert.equal(view.body.categories[0].links.length,0);
 assert.equal(JSON.stringify(view.body).includes(token),false);assert.equal((await call('backups/run',{},other)).status,403);
});
test('backup integrity is checked; failed backups never purge trash; recovery can merge into deleted collections',async()=>{
 const {call,env,sql}=setup();const store=new Map();env.HOME_BACKUPS={put:async(k,v)=>store.set(k,v),get:async k=>store.get(k)};
 const backup=await createBackup(env);const exported=(await call('backups/'+backup.id,null,token)).body;
 await call('categories/1',null,token,'DELETE');
 const restore=await call('data/import',{...exported,restore_deleted:true,request_id:'restore_abcdefghijklmnop'},token);assert.equal(restore.status,200);assert.equal((await call('nav',null,token)).body.data[0].links.length,1);
 store.set('snapshot/'+backup.id,'tampered');assert.equal((await call('backups/'+backup.id,null,token)).status,503);
 sql.exec('UPDATE bookmarks SET deleted_at=1');env.HOME_BACKUPS.put=async()=>{throw new Error('disk unavailable');};
 await assert.rejects(scheduledBackup(env));assert.ok(sql.prepare('SELECT count(*) n FROM bookmarks').get().n>0);
 assert.equal(sql.prepare("SELECT count(*) n FROM backup_runs WHERE status='failed'").get().n,1);
});

test('empty collections survive JSON import and recovery',async()=>{
 const {call}=setup();const body={categories:[{name:'Empty collection',links:[]}],request_id:'empty_abcdefghijklmnop'};
 assert.equal((await call('data/import/preview',body,token)).body.collections_added,1);
 assert.equal((await call('data/import',body,token)).status,200);
 const exported=(await call('data/export',null,token)).body;
 const empty=exported.categories.find(g=>g.name==='Empty collection');assert.deepEqual(empty.links,[]);
 await call('categories/'+empty.id,null,token,'DELETE');
 assert.equal((await call('data/import',{...body,request_id:'empty_restore_abcdefghijklmnop',restore_deleted:true},token)).status,200);
 assert.ok((await call('data/export',null,token)).body.categories.some(g=>g.name==='Empty collection'));
});
