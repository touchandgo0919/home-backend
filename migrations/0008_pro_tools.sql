-- Add optional Pro access and organizer metadata without changing existing accounts.
CREATE TABLE IF NOT EXISTS tenant_entitlements (
  tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('pro')),
  expires_at INTEGER,
  source TEXT NOT NULL CHECK (source IN ('manual')),
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY (bookmark_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tenant_tag ON bookmark_tags(tenant_id, tag, bookmark_id);

CREATE TABLE IF NOT EXISTS pro_link_checks (
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  url_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reachable', 'missing', 'restricted', 'unknown', 'skipped')),
  http_status INTEGER,
  checked_at INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, bookmark_id)
);
CREATE INDEX IF NOT EXISTS idx_pro_link_checks_recent ON pro_link_checks(tenant_id, checked_at);

CREATE TABLE IF NOT EXISTS pro_link_check_usage (
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 0 AND count <= 100),
  PRIMARY KEY (tenant_id, day)
);
