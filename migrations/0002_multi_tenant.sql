-- Upgrade an existing single-tenant database to multi-tenant mode.
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  admin_token TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO tenants (slug, name, admin_token, sort_order)
VALUES ('zhaotao', 'zhaotao', '76228f6039d240938f550232266157e066a778401c04479cabfa69289b92f5b4', 0);

DROP INDEX IF EXISTS idx_categories_sort;

-- D1 runs migrations in a transaction, where PRAGMA foreign_keys = OFF may not
-- disable cascades. Preserve bookmarks before replacing their parent table.
CREATE TABLE bookmarks_backup AS SELECT * FROM bookmarks;

CREATE TABLE categories_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'book',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, name)
);

INSERT INTO categories_new (id, tenant_id, name, icon, sort_order, created_at, updated_at)
SELECT
  id,
  (SELECT id FROM tenants WHERE slug = 'zhaotao'),
  name,
  icon,
  sort_order,
  created_at,
  updated_at
FROM categories;

DROP TABLE categories;
ALTER TABLE categories_new RENAME TO categories;

INSERT OR IGNORE INTO bookmarks (id, category_id, title, url, sort_order, created_at, updated_at)
SELECT id, category_id, title, url, sort_order, created_at, updated_at FROM bookmarks_backup;
DROP TABLE bookmarks_backup;

CREATE INDEX IF NOT EXISTS idx_tenants_sort ON tenants(sort_order, id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order, id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant_sort ON categories(tenant_id, sort_order, id);

PRAGMA foreign_keys = ON;
