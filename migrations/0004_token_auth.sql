-- Token-based tenant authentication.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenant_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN ('admin', 'editor')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_tokens_tenant ON tenant_tokens(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_tenant_tokens_token ON tenant_tokens(token);

INSERT OR IGNORE INTO tenant_tokens (tenant_id, name, token, role)
SELECT id, name || ' 管理员', admin_token, 'admin'
FROM tenants
WHERE admin_token IS NOT NULL AND admin_token <> '';
