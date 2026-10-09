import { problem, readBody } from './library.js';

const idOf = value => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw problem('Invalid ID.');
  return id;
};
const idsOf = value => {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw problem('Select 1–100 bookmarks.');
  const ids = value.map(idOf);
  if (new Set(ids).size !== ids.length) throw problem('Duplicate bookmark IDs.');
  return ids;
};
const tagsOf = value => {
  if (!Array.isArray(value) || value.length > 10) throw problem('Use up to 10 tags.');
  const tags = value.map(tag => {
    if (typeof tag !== 'string') throw problem('Invalid tag.');
    const clean = tag.trim();
    if (!clean || clean.length > 40 || /[\u0000-\u001f\u007f]/.test(clean)) throw problem('Tags must be 1–40 characters.');
    return clean;
  });
  if (new Set(tags.map(tag => tag.toLocaleLowerCase())).size !== tags.length) throw problem('Duplicate tags.');
  return tags;
};
const rows = async statement => (await statement.all()).results;

async function entitlement(db, actor) {
  if (actor.role === 'platform') return { plan: 'pro', active: true, expires_at: null, source: 'platform_preview' };
  const grant = await db.prepare('SELECT plan, expires_at, source FROM tenant_entitlements WHERE tenant_id=?').bind(actor.tenant.id).first();
  const active = grant?.plan === 'pro' && (grant.expires_at === null || grant.expires_at > Date.now());
  return { plan: active ? 'pro' : 'free', active, expires_at: grant?.expires_at ?? null, source: active ? grant.source : null };
}
async function requirePro(db, actor) {
  if (!(await entitlement(db, actor)).active) throw problem('Pro access is required. Payments are not available yet.', 403);
}

function checkableUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        !host.includes('.') || /^\d+(?:\.\d+){3}$/.test(host) || host.includes(':') ||
        /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)) return null;
    return url.href;
  } catch { return null; }
}
async function inspectLink(value, checkFetch) {
  const url = checkableUrl(value);
  if (!url) return { status: 'skipped', http_status: null };
  try {
    const response = await checkFetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(4000) });
    response.body?.cancel().catch(() => {});
    const code = response.status;
    return { status: code >= 200 && code < 400 ? 'reachable' : [404, 410].includes(code) ? 'missing' : [401, 403].includes(code) ? 'restricted' : 'unknown', http_status: code };
  } catch { return { status: 'unknown', http_status: null }; }
}

export async function proRoutes(request, env, actor, path) {
  if (!path.startsWith('pro/')) return null;
  const db = env.DB, tenant = actor.tenant.id, method = request.method.toUpperCase();
  const ok = (body, status = 200) => ({ body, status });
  if (method === 'GET' && path === 'pro/status') {
    return ok({ ...await entitlement(db, actor), purchase_available: false,
      features: ['tags', 'smart_filters', 'bulk_move', 'link_check'] });
  }
  if (path.startsWith('pro/admin/entitlements/')) {
    if (actor.role !== 'platform') throw problem('Platform administrator required.', 403);
    const target = idOf(path.split('/')[3]);
    const exists = await db.prepare('SELECT id FROM tenants WHERE id=?').bind(target).first();
    if (!exists) throw problem('Account not found.', 404);
    if (method === 'DELETE') {
      await db.prepare('DELETE FROM tenant_entitlements WHERE tenant_id=?').bind(target).run();
      return ok({ active: false });
    }
    if (method === 'PUT') {
      const body = await readBody(request);
      const expires = body.expires_at === null ? null : Number(body.expires_at);
      if (expires !== null && (!Number.isSafeInteger(expires) || expires <= Date.now() || expires > Date.now() + 10 * 366 * 86400000))
        throw problem('Provide a future expiry within 10 years, or null.');
      await db.prepare(`INSERT INTO tenant_entitlements(tenant_id,plan,expires_at,source,updated_at)
        VALUES(?,'pro',?,'manual',?) ON CONFLICT(tenant_id) DO UPDATE SET plan='pro',expires_at=excluded.expires_at,source='manual',updated_at=excluded.updated_at`)
        .bind(target, expires, Date.now()).run();
      return ok({ active: true, expires_at: expires });
    }
    return null;
  }
  if (method === 'GET' && path === 'pro/organize') {
    const [groups, bookmarks, tags] = await db.batch([
      db.prepare('SELECT id,name FROM categories WHERE tenant_id=? AND deleted_at IS NULL ORDER BY sort_order,id').bind(tenant),
      db.prepare(`SELECT b.id,b.category_id,b.title,b.url FROM bookmarks b JOIN categories c ON c.id=b.category_id AND c.tenant_id=b.tenant_id
        WHERE b.tenant_id=? AND b.deleted_at IS NULL AND c.deleted_at IS NULL ORDER BY b.sort_order,b.id`).bind(tenant),
      db.prepare('SELECT t.bookmark_id,t.tag FROM bookmark_tags t JOIN bookmarks b ON b.id=t.bookmark_id AND b.tenant_id=t.tenant_id WHERE t.tenant_id=? AND b.deleted_at IS NULL ORDER BY t.tag').bind(tenant)
    ]);
    const byBookmark = new Map();
    for (const row of tags.results) {
      if (!byBookmark.has(row.bookmark_id)) byBookmark.set(row.bookmark_id, []);
      byBookmark.get(row.bookmark_id).push(row.tag);
    }
    return ok({ entitlement: await entitlement(db, actor), collections: groups.results,
      bookmarks: bookmarks.results.map(item => ({ ...item, tags: byBookmark.get(item.id) || [] })) });
  }
  if (method === 'PUT' && /^pro\/bookmarks\/\d+\/tags$/.test(path)) {
    await requirePro(db, actor);
    const id = idOf(path.split('/')[2]), tags = tagsOf((await readBody(request)).tags);
    const item = await db.prepare('SELECT id FROM bookmarks WHERE id=? AND tenant_id=? AND deleted_at IS NULL').bind(id, tenant).first();
    if (!item) throw problem('Bookmark not found.', 404);
    await db.batch([
      db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id=? AND tenant_id=?').bind(id, tenant),
      ...tags.map(tag => db.prepare('INSERT INTO bookmark_tags(tenant_id,bookmark_id,tag) VALUES(?,?,?)').bind(tenant, id, tag))
    ]);
    return ok({ id, tags });
  }
  if (method === 'POST' && path === 'pro/bookmarks/tag') {
    await requirePro(db, actor);
    const body = await readBody(request), ids = idsOf(body.ids), tag = tagsOf([body.tag])[0], payload = JSON.stringify(ids);
    if (!['add', 'remove'].includes(body.action)) throw problem('Tag action must be add or remove.');
    const found = await db.prepare(`SELECT COUNT(*) AS n FROM bookmarks b JOIN categories c ON c.id=b.category_id AND c.tenant_id=b.tenant_id
      WHERE b.tenant_id=? AND b.deleted_at IS NULL AND c.deleted_at IS NULL AND b.id IN (SELECT value FROM json_each(?))`).bind(tenant, payload).first();
    if (found.n !== ids.length) throw problem('One or more bookmarks are unavailable.', 404);
    if (body.action === 'add') {
      const full = await db.prepare(`SELECT COUNT(*) AS n FROM bookmarks b WHERE b.tenant_id=? AND b.id IN (SELECT value FROM json_each(?))
        AND NOT EXISTS(SELECT 1 FROM bookmark_tags t WHERE t.bookmark_id=b.id AND t.tag=?)
        AND (SELECT COUNT(*) FROM bookmark_tags t WHERE t.bookmark_id=b.id)>=10`).bind(tenant, payload, tag).first();
      if (full.n) throw problem('One or more bookmarks already have 10 tags.', 409);
      await db.prepare(`INSERT INTO bookmark_tags(tenant_id,bookmark_id,tag)
        SELECT ?,b.id,? FROM bookmarks b WHERE b.tenant_id=? AND b.id IN (SELECT value FROM json_each(?))
        ON CONFLICT(bookmark_id,tag) DO NOTHING`).bind(tenant, tag, tenant, payload).run();
    } else {
      await db.prepare('DELETE FROM bookmark_tags WHERE tenant_id=? AND tag=? AND bookmark_id IN (SELECT value FROM json_each(?))').bind(tenant, tag, payload).run();
    }
    return ok({ ok: true, action: body.action, count: ids.length, tag });
  }
  if (method === 'POST' && path === 'pro/bookmarks/move') {
    await requirePro(db, actor);
    const body = await readBody(request), ids = idsOf(body.ids), target = idOf(body.category_id), payload = JSON.stringify(ids);
    const category = await db.prepare('SELECT id FROM categories WHERE id=? AND tenant_id=? AND deleted_at IS NULL').bind(target, tenant).first();
    if (!category) throw problem('Destination collection not found.', 404);
    const found = await db.prepare(`SELECT COUNT(*) AS n FROM bookmarks b JOIN categories c ON c.id=b.category_id AND c.tenant_id=b.tenant_id
      WHERE b.tenant_id=? AND b.deleted_at IS NULL AND c.deleted_at IS NULL AND b.id IN (SELECT value FROM json_each(?))`).bind(tenant, payload).first();
    if (found.n !== ids.length) throw problem('One or more bookmarks are unavailable.', 404);
    const result = await db.prepare(`UPDATE bookmarks SET category_id=?,updated_at=CURRENT_TIMESTAMP
      WHERE tenant_id=? AND deleted_at IS NULL AND id IN (SELECT value FROM json_each(?))`).bind(target, tenant, payload).run();
    return ok({ moved: result.meta.changes, category_id: target });
  }
  if (method === 'POST' && path === 'pro/links/check') {
    await requirePro(db, actor);
    const ids = idsOf((await readBody(request)).ids);
    if (ids.length > 10) throw problem('Check up to 10 links at a time.');
    const payload = JSON.stringify(ids), now = Date.now();
    const bookmarks = await rows(db.prepare(`SELECT b.id,b.url,b.url_key FROM bookmarks b JOIN categories c ON c.id=b.category_id AND c.tenant_id=b.tenant_id
      WHERE b.tenant_id=? AND b.deleted_at IS NULL AND c.deleted_at IS NULL AND b.id IN (SELECT value FROM json_each(?))`).bind(tenant, payload));
    if (bookmarks.length !== ids.length) throw problem('One or more bookmarks are unavailable.', 404);
    const cached = await rows(db.prepare('SELECT bookmark_id,url_key,status,http_status,checked_at FROM pro_link_checks WHERE tenant_id=? AND bookmark_id IN (SELECT value FROM json_each(?))').bind(tenant, payload));
    const byId = new Map(cached.map(row => [row.bookmark_id, row]));
    const needsCheck = bookmarks.filter(item => { const old = byId.get(item.id); return !old || old.url_key !== item.url_key || old.checked_at < now - 86400000; });
    if (needsCheck.length) {
      const day = new Date(now + 8 * 3600000).toISOString().slice(0, 10);
      const usage = await db.prepare(`INSERT INTO pro_link_check_usage(tenant_id,day,count) VALUES(?,?,?)
        ON CONFLICT(tenant_id,day) DO UPDATE SET count=count+excluded.count WHERE count+excluded.count<=100`)
        .bind(tenant, day, needsCheck.length).run();
      if (!usage.meta.changes) throw problem('Daily link check limit reached (100).', 429);
    }
    const checked = await Promise.all(needsCheck.map(async item => ({ item, ...await inspectLink(item.url, env.LINK_CHECK_FETCH || fetch) })));
    for (const row of checked) {
      await db.prepare(`INSERT INTO pro_link_checks(tenant_id,bookmark_id,url_key,status,http_status,checked_at) VALUES(?,?,?,?,?,?)
        ON CONFLICT(tenant_id,bookmark_id) DO UPDATE SET url_key=excluded.url_key,status=excluded.status,http_status=excluded.http_status,checked_at=excluded.checked_at`)
        .bind(tenant, row.item.id, row.item.url_key || row.item.url, row.status, row.http_status, now).run();
      byId.set(row.item.id, { status: row.status, http_status: row.http_status, checked_at: now });
    }
    return ok({ results: ids.map(id => ({ id, status: byId.get(id).status, http_status: byId.get(id).http_status, checked_at: byId.get(id).checked_at })) });
  }
  return null;
}
