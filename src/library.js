export const problem = (message, status = 400) => Object.assign(new Error(message), { status });
export const sha = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(x => x.toString(16).padStart(2, '0')).join('');
export function canonical(value) {
  try { const u = new URL(String(value).trim()); if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw 0; return u.href; }
  catch { throw problem('A valid HTTP(S) URL without embedded credentials is required.'); }
}
const idOf = value => { const n=Number(value); if(!Number.isSafeInteger(n)||n<1)throw problem('Invalid ID.');return n; };
const textOf = (value,max=500) => { if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw problem('Invalid or oversized text.');return value.trim(); };
const keyOf = value => { if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(value))throw problem('A request_id of 16–100 characters is required.');return value; };
export async function readBody(request) {
  if(Number(request.headers.get('content-length'))>1048576)throw problem('Request too large.',413);
  const reader=request.body?.getReader(); let size=0,chunks=[];
  if(!reader)throw problem('JSON body required.');
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1048576){await reader.cancel();throw problem('Request too large.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw problem('Invalid JSON.');}
}
const rows = async statement => (await statement.all()).results;
const activeCategory = async (db,tenant,id) => {const c=await db.prepare('SELECT id,name FROM categories WHERE tenant_id=? AND id=? AND deleted_at IS NULL').bind(tenant,id).first();if(!c)throw problem('Category not found.',404);return c;};
export async function exportTenant(db,tenant) {
 const [c,b]=await db.batch([
  db.prepare('SELECT id,name,icon,sort_order FROM categories WHERE tenant_id=? AND deleted_at IS NULL ORDER BY sort_order,id').bind(tenant),
  db.prepare('SELECT b.id,b.category_id,b.title,b.url,b.icon_url,b.sort_order FROM bookmarks b JOIN categories c ON c.id=b.category_id AND c.tenant_id=b.tenant_id WHERE b.tenant_id=? AND b.deleted_at IS NULL AND c.deleted_at IS NULL ORDER BY b.sort_order,b.id').bind(tenant)
 ]);
 return {format:'home-navigation',version:1,exported_at:new Date().toISOString(),categories:c.results.map(g=>({...g,links:b.results.filter(x=>x.category_id===g.id)}))};
}
async function normalizeImport(db,tenant,body) {
 const input=body.categories;
 if(!Array.isArray(input)||input.length>1000)throw problem('Expected up to 1000 collections.');
 const existing=await rows(db.prepare('SELECT url_key FROM bookmarks WHERE tenant_id=? AND deleted_at IS NULL').bind(tenant));
 const seen=new Set(existing.map(x=>x.url_key));let invalid=0,duplicates=0,total=0;const categories=[];
 for(const group of input){
  const name=textOf(group.name||group.category,100);if(!Array.isArray(group.links))throw problem('Each collection needs a links array.');
  const links=[];
  for(const item of group.links){if(++total>1000)throw problem('Import up to 1000 bookmarks at a time.');
   try{const url=canonical(item.url),title=textOf(item.title);if(seen.has(url)){duplicates++;continue;}seen.add(url);links.push({url,title});}catch{invalid++;}
  }
  categories.push({name,icon:'book',links});
 }
 const current=await rows(db.prepare('SELECT name,deleted_at FROM categories WHERE tenant_id=?').bind(tenant));
 const active=new Set(current.filter(g=>!g.deleted_at).map(g=>g.name));
 const collections_added=new Set(categories.filter(g=>!active.has(g.name)).map(g=>g.name)).size;
 return {categories,total,invalid,duplicates,collections_added,added:categories.reduce((n,g)=>n+g.links.length,0)};
}
async function receipt(db,tenant,key,hash){const r=await db.prepare('SELECT * FROM write_requests WHERE tenant_id=? AND request_key=?').bind(tenant,key).first();if(r&&r.body_hash!==hash)throw problem('Request ID was already used for different data.',409);return r;}
export async function library(request,env,actor,path){
 const db=env.DB,tenant=actor.tenant.id,method=request.method,url=new URL(request.url),parts=path.split('/');
 const ok=(body,status=200)=>({body,status});
 if(method==='GET'&&path==='collections'){
  return ok({authenticated:true,role:actor.role,tenant:{id:tenant,slug:actor.tenant.slug,name:actor.tenant.name},data:await rows(db.prepare('SELECT id,name AS category,icon,sort_order FROM categories WHERE tenant_id=? AND deleted_at IS NULL ORDER BY sort_order,id').bind(tenant))});
 }
 if(method==='GET'&&path==='bookmarks/check'){
  const key=canonical(url.searchParams.get('url'));const found=await db.prepare('SELECT b.id,b.category_id,c.name AS category FROM bookmarks b JOIN categories c ON c.id=b.category_id AND c.tenant_id=b.tenant_id WHERE b.tenant_id=? AND b.url_key=? AND b.deleted_at IS NULL AND c.deleted_at IS NULL ORDER BY b.id LIMIT 1').bind(tenant,key).first();return ok({bookmark:found||null});
 }
 if(method==='POST'&&path==='categories'){
  const b=await readBody(request),name=textOf(b.name||b.category,100);
  const old=await db.prepare('SELECT id,deleted_at FROM categories WHERE tenant_id=? AND name=?').bind(tenant,name).first();
  if(old){if(old.deleted_at)throw problem('This collection is in Trash. Restore it first.',409);return ok({id:old.id,existing:true});}
  await db.prepare('INSERT INTO categories(tenant_id,name,icon,sort_order) VALUES(?,?,?,?) ON CONFLICT(tenant_id,name) DO NOTHING').bind(tenant,name,textOf(b.icon||'book',40),Date.now()).run();
  return ok(await db.prepare('SELECT id FROM categories WHERE tenant_id=? AND name=?').bind(tenant,name).first(),201);
 }
 if(method==='POST'&&path==='bookmarks'){
  const b=await readBody(request),category=idOf(b.category_id),title=textOf(b.title),key=canonical(b.url),req=b.request_id?keyOf(b.request_id):crypto.randomUUID();
  const hash=await sha(JSON.stringify({category,title,key}));const previous=await receipt(db,tenant,req,hash);
  if(previous)return ok({id:previous.result_id,replayed:true});
  const group=await activeCategory(db,tenant,category);
  const result=await db.batch([
   db.prepare(`INSERT INTO bookmarks(tenant_id,category_id,title,url,url_key,icon_url,sort_order,source_request)
    SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM categories WHERE id=? AND tenant_id=? AND deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM bookmarks WHERE tenant_id=? AND url_key=? AND deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM write_requests WHERE tenant_id=? AND request_key=?)`).bind(tenant,category,title,key,key,`${new URL(key).origin}/favicon.ico`,Date.now(),req,category,tenant,tenant,key,tenant,req),
   db.prepare(`INSERT INTO write_requests(tenant_id,request_key,body_hash,result_id,created_at)
    SELECT ?,?,?,id,? FROM bookmarks WHERE tenant_id=? AND url_key=? AND deleted_at IS NULL ORDER BY id LIMIT 1
    ON CONFLICT(tenant_id,request_key) DO NOTHING`).bind(tenant,req,hash,Date.now(),tenant,key)
  ]);
  const saved=await receipt(db,tenant,req,hash);if(!saved)throw problem('Category changed. Refresh and retry.',409);
  const item=await db.prepare('SELECT b.id,b.category_id,c.name AS category FROM bookmarks b JOIN categories c ON c.id=b.category_id WHERE b.id=? AND b.tenant_id=?').bind(saved.result_id,tenant).first();
  return ok({...item,duplicate:!result[0].meta.changes},result[0].meta.changes?201:200);
 }
 if(method==='PUT'&&parts[0]==='bookmarks'&&parts.length===2){
  const b=await readBody(request),id=idOf(parts[1]),category=idOf(b.category_id),title=textOf(b.title),key=canonical(b.url);await activeCategory(db,tenant,category);
  const old=await db.prepare('SELECT id FROM bookmarks WHERE id=? AND tenant_id=? AND deleted_at IS NULL').bind(id,tenant).first();if(!old)throw problem('Bookmark not found.',404);
  const r=await db.prepare(`UPDATE bookmarks SET category_id=?,title=?,url=?,url_key=?,icon_url=?,updated_at=CURRENT_TIMESTAMP
   WHERE id=? AND tenant_id=? AND deleted_at IS NULL AND EXISTS(SELECT 1 FROM categories WHERE id=? AND tenant_id=? AND deleted_at IS NULL)
   AND NOT EXISTS(SELECT 1 FROM bookmarks WHERE tenant_id=? AND url_key=? AND deleted_at IS NULL AND id<>?)`).bind(category,title,key,key,`${new URL(key).origin}/favicon.ico`,id,tenant,category,tenant,tenant,key,id).run();
  if(!r.meta.changes)throw problem('URL already saved, or collection changed.',409);return ok({id});
 }
 if(method==='DELETE'&&['categories','bookmarks'].includes(parts[0])&&parts.length===2){
  const id=idOf(parts[1]),stamp=Date.now(),batch=crypto.randomUUID();
  if(parts[0]==='categories')await db.batch([
   db.prepare('UPDATE categories SET deleted_at=?,delete_batch=? WHERE id=? AND tenant_id=? AND deleted_at IS NULL').bind(stamp,batch,id,tenant),
   db.prepare('UPDATE bookmarks SET deleted_at=?,delete_batch=? WHERE category_id=? AND tenant_id=? AND deleted_at IS NULL').bind(stamp,batch,id,tenant)
  ]);else await db.prepare('UPDATE bookmarks SET deleted_at=?,delete_batch=? WHERE id=? AND tenant_id=? AND deleted_at IS NULL').bind(stamp,batch,id,tenant).run();
  return ok({ok:true,undo:{type:parts[0],id},retention_days:30});
 }
 if(method==='GET'&&path==='trash')return ok({retention_days:30,categories:await rows(db.prepare('SELECT id,name,deleted_at FROM categories WHERE tenant_id=? AND deleted_at>? ORDER BY deleted_at DESC').bind(tenant,Date.now()-30*86400000)),bookmarks:await rows(db.prepare('SELECT b.id,b.title,b.url,b.deleted_at,c.name AS category FROM bookmarks b JOIN categories c ON c.id=b.category_id WHERE b.tenant_id=? AND b.deleted_at>? AND c.deleted_at IS NULL ORDER BY b.deleted_at DESC').bind(tenant,Date.now()-30*86400000))});
 if(method==='POST'&&path==='trash/restore'){
  const b=await readBody(request),id=idOf(b.id),cutoff=Date.now()-30*86400000;
  if(!['categories','bookmarks'].includes(b.type))throw problem('Invalid item type.');
  if(b.type==='categories'){
   const g=await db.prepare('SELECT delete_batch FROM categories WHERE id=? AND tenant_id=? AND deleted_at>?').bind(id,tenant,cutoff).first();if(!g)throw problem('Item unavailable or expired.',404);
   // Restore the complete original group; pre-existing duplicate data is preserved.
   await db.batch([db.prepare('UPDATE categories SET deleted_at=NULL,delete_batch=NULL WHERE id=? AND tenant_id=?').bind(id,tenant),db.prepare('UPDATE bookmarks SET deleted_at=NULL,delete_batch=NULL WHERE tenant_id=? AND category_id=? AND delete_batch=?').bind(tenant,id,g.delete_batch)]);
  }else{
   const r=await db.prepare('UPDATE bookmarks SET deleted_at=NULL,delete_batch=NULL WHERE id=? AND tenant_id=? AND deleted_at>? AND category_id IN(SELECT id FROM categories WHERE tenant_id=? AND deleted_at IS NULL)').bind(id,tenant,cutoff,tenant).run();if(!r.meta.changes)throw problem('Item unavailable. Restore its collection first.',404);
  }return ok({ok:true});
 }
 if(method==='GET'&&path==='data/export')return ok(await exportTenant(db,tenant));
 if(method==='POST'&&['data/import/preview','data/import'].includes(path)){
  const b=await readBody(request),key=path==='data/import'?keyOf(b.request_id):null,hash=await sha(JSON.stringify({categories:b.categories,restore_deleted:Boolean(b.restore_deleted)}));
  if(key&&await receipt(db,tenant,key,hash))return ok({ok:true,replayed:true});
  const plan=await normalizeImport(db,tenant,b);
  if(path.endsWith('/preview'))return ok(plan);
  const payload=JSON.stringify(plan.categories),statements=[];
  const deleted=await db.prepare(`SELECT c.id FROM categories c WHERE c.tenant_id=? AND c.deleted_at IS NOT NULL AND c.name IN (SELECT json_extract(value,'$.name') FROM json_each(?)) LIMIT 1`).bind(tenant,payload).first();
  if(deleted&&!b.restore_deleted)throw problem('An import collection is in Trash. Restore it first.',409);
  if(b.restore_deleted)statements.push(db.prepare(`UPDATE categories SET deleted_at=NULL,delete_batch=NULL WHERE tenant_id=? AND name IN (SELECT json_extract(value,'$.name') FROM json_each(?)) AND NOT EXISTS(SELECT 1 FROM write_requests WHERE tenant_id=? AND request_key=?)`).bind(tenant,payload,tenant,key));
  statements.push(db.prepare(`INSERT INTO categories(tenant_id,name,icon,sort_order)
    SELECT ?,json_extract(value,'$.name'),'book',? FROM json_each(?)
    WHERE NOT EXISTS(SELECT 1 FROM write_requests WHERE tenant_id=? AND request_key=?) ON CONFLICT(tenant_id,name) DO NOTHING`).bind(tenant,Date.now(),payload,tenant,key));
  statements.push(db.prepare(`INSERT INTO bookmarks(tenant_id,category_id,title,url,url_key,sort_order,source_request)
    SELECT ?,c.id,json_extract(l.value,'$.title'),json_extract(l.value,'$.url'),json_extract(l.value,'$.url'),?,?
    FROM json_each(?) g JOIN json_each(g.value,'$.links') l
    JOIN categories c ON c.tenant_id=? AND c.name=json_extract(g.value,'$.name') AND c.deleted_at IS NULL
    WHERE NOT EXISTS(SELECT 1 FROM bookmarks b WHERE b.tenant_id=? AND b.url_key=json_extract(l.value,'$.url') AND b.deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM write_requests WHERE tenant_id=? AND request_key=?)`).bind(tenant,Date.now(),key,payload,tenant,tenant,tenant,key));
  statements.push(db.prepare('INSERT INTO write_requests(tenant_id,request_key,body_hash,created_at) VALUES(?,?,?,?) ON CONFLICT(tenant_id,request_key) DO NOTHING').bind(tenant,key,hash,Date.now()));
  await db.batch(statements);await receipt(db,tenant,key,hash);
  const n=await db.prepare('SELECT COUNT(*) AS n FROM bookmarks WHERE tenant_id=? AND source_request=?').bind(tenant,key).first();return ok({ok:true,added:n.n,duplicates:plan.total-plan.invalid-n.n,invalid:plan.invalid});
 }
 return null;
}
