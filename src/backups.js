import { problem, sha } from './library.js';
const TABLES=['tenants','tenant_tokens','categories','bookmarks','write_requests'];
const RETENTION=35*86400;
export async function createBackup(env){
 if(!env.HOME_BACKUPS)throw problem('Backup storage is not configured.',503);
 const id=crypto.randomUUID(),created=Date.now();
 try{
  const results=await env.DB.batch(TABLES.map(t=>env.DB.prepare(`SELECT * FROM ${t} ORDER BY ${t==='write_requests'?'tenant_id,request_key':'id'}`)));
  const tables=Object.fromEntries(TABLES.map((name,i)=>[name,results[i].results]));
  const snapshot={format:'home-full-backup',version:1,created_at:created,tables};
  const body=JSON.stringify(snapshot),bytes=new TextEncoder().encode(body).length;
  if(bytes>20*1024*1024)throw new Error('Backup exceeds 20 MiB; increase backup storage capacity.');
  const checksum=await sha(body),key=`snapshot/${id}`;
  await env.HOME_BACKUPS.put(key,body,{expirationTtl:RETENTION});
  const counts=JSON.stringify(Object.fromEntries(TABLES.map(t=>[t,tables[t].length])));
  await env.DB.prepare('INSERT INTO backup_runs(id,created_at,status,object_key,checksum,counts) VALUES(?,?,?,?,?,?)').bind(id,created,'success',key,checksum,counts).run();
  return {id,created_at:created,status:'success',counts:JSON.parse(counts),retention_days:35};
 }catch(error){
  await env.DB.prepare('INSERT INTO backup_runs(id,created_at,status,error) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,created,'failed',String(error.message).slice(0,300)).run();
  throw problem('Backup failed. Existing backups remain available.',503);
 }
}
export async function backupRoutes(request,env,actor,path){
 if(path==='backups'&&request.method==='GET'){
  const {results}=await env.DB.prepare('SELECT id,created_at,status FROM backup_runs WHERE created_at>? ORDER BY created_at DESC LIMIT 60').bind(Date.now()-RETENTION*1000).all();
  return {body:{data:results,retention_days:35,schedule:'Daily at 03:00 Asia/Shanghai'},status:200};
 }
 if(path==='backups/run'&&request.method==='POST'){
  if(actor.role!=='platform')throw problem('Platform administrator required.',403);
  return {body:await createBackup(env),status:201};
 }
 if(path.startsWith('backups/')&&request.method==='GET'){
  const id=path.split('/')[1];if(!/^[a-f0-9-]{36}$/.test(id))throw problem('Invalid backup ID.');
  const meta=await env.DB.prepare('SELECT object_key,checksum FROM backup_runs WHERE id=? AND status=? AND created_at>?').bind(id,'success',Date.now()-RETENTION*1000).first();
  if(!meta)throw problem('Backup unavailable or expired.',404);
  const text=await env.HOME_BACKUPS?.get(meta.object_key);
  if(!text)throw problem('Backup not yet available. Retry shortly.',503);
  if(await sha(text)!==meta.checksum)throw problem('Backup integrity check failed.',503);
  const snapshot=JSON.parse(text),tenant=actor.tenant.id;
  const categories=snapshot.tables.categories.filter(g=>g.tenant_id===tenant&&!g.deleted_at).map(g=>({name:g.name,icon:g.icon,links:snapshot.tables.bookmarks.filter(b=>b.tenant_id===tenant&&b.category_id===g.id&&!b.deleted_at).map(b=>({title:b.title,url:b.url,icon_url:b.icon_url}))}));
  return {body:{format:'home-navigation',version:1,exported_at:new Date(snapshot.created_at).toISOString(),categories},status:200};
 }
 return null;
}
export async function scheduledBackup(env){
 await createBackup(env);
 // Only purge expired trash after a new independent snapshot is safely stored.
 const cutoff=Date.now()-30*86400000;
 await env.DB.batch([
  env.DB.prepare('DELETE FROM bookmarks WHERE deleted_at IS NOT NULL AND deleted_at<?').bind(cutoff),
  env.DB.prepare('DELETE FROM categories WHERE deleted_at IS NOT NULL AND deleted_at<?').bind(cutoff),
  env.DB.prepare('DELETE FROM backup_runs WHERE created_at<?').bind(Date.now()-RETENTION*1000)
 ]);
}
