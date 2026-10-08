const invalid = (message, status = 400) => Object.assign(new Error(message), { status });
const sha256 = async value => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, "0")).join("");

export async function register(request, env, db) {
  // Fail closed if a deployment omitted the registration limiter.
  if (!env.REGISTRATION_LIMITER) throw invalid("注册暂未开放，请稍后重试。", 503);
  const { success } = await env.REGISTRATION_LIMITER.limit({ key: `register:${request.headers.get("cf-connecting-ip") || "unknown"}` });
  if (!success) throw invalid("注册请求过于频繁，请一分钟后重试。", 429);
  if (Number(request.headers.get("content-length")) > 4096) throw invalid("注册信息过长。", 413);
  const text = await request.text();
  if (text.length > 4096) throw invalid("注册信息过长。", 413);
  let body;
  try { body = JSON.parse(text); } catch { throw invalid("注册信息格式错误。"); }
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const key = body?.registration_key;
  if (!name || name.length > 40) throw invalid("导航名称需要 1–40 个字符。");
  if (typeof key !== "string" || !/^[a-f0-9]{64}$/.test(key)) throw invalid("注册凭据格式错误，请更新扩展后重试。");

  // The extension persists a secret 256-bit random nonce before submitting.
  // Domain-separated hashes make retries recover the SAME account and token
  // after a lost response, without a schema change or an extra recovery token.
  const [token, slugHash] = await Promise.all([
    sha256(`home-registration-token:v1:${key}`),
    sha256(`home-registration-slug:v1:${key}`),
  ]);
  const slug = `self-${slugHash.slice(0, 48)}`;
  let tenant = await db.prepare("SELECT id, slug, name FROM tenants WHERE slug = ?").bind(slug).first();
  if (!tenant) {
    // D1 batch is transactional: no half-created tenant/token/category on error.
    await db.batch([
      db.prepare("INSERT INTO tenants (slug, name, admin_token, sort_order) VALUES (?, ?, ?, ?) ON CONFLICT(slug) DO NOTHING")
        .bind(slug, name, token, Date.now()),
      db.prepare("INSERT INTO tenant_tokens (tenant_id, name, token, role) SELECT id, ?, ?, 'editor' FROM tenants WHERE slug = ? ON CONFLICT(token) DO NOTHING")
        .bind(`${name} 个人令牌`, token, slug),
      db.prepare("INSERT INTO categories (tenant_id, name, icon, sort_order) SELECT id, '我的收藏', 'book', 0 FROM tenants WHERE slug = ? ON CONFLICT(tenant_id, name) DO NOTHING")
        .bind(slug),
    ]);
    tenant = await db.prepare("SELECT id, slug, name FROM tenants WHERE slug = ?").bind(slug).first();
  }
  const activeToken = await db.prepare("SELECT id FROM tenant_tokens WHERE tenant_id = ? AND token = ?").bind(tenant.id, token).first();
  // A retry must never revive a token that was subsequently revoked or rotated.
  if (!activeToken) throw invalid("该注册凭据已失效，请使用当前 Token 登录。", 409);
  return { token, tenant };
}
