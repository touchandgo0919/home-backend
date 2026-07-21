import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");
const match = html.match(/const fallbackSiteData = ([\s\S]*?);\n\n    const icons =/);

if (!match) {
  throw new Error("Unable to find siteData in index.html");
}

const siteData = Function(`return ${match[1]}`)();

fs.mkdirSync("data", { recursive: true });
fs.mkdirSync("migrations", { recursive: true });
fs.writeFileSync("data/seed.json", `${JSON.stringify(siteData, null, 2)}\n`);

const quote = (value) => String(value).replaceAll("'", "''");

let sql = `-- D1 schema and initial navigation data.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'book',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order, id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_category_sort ON bookmarks(category_id, sort_order, id);

`;

siteData.forEach((group, groupIndex) => {
  sql += `INSERT INTO categories (name, icon, sort_order) VALUES ('${quote(group.category)}', '${quote(group.icon || "book")}', ${groupIndex});\n`;

  group.links.forEach((link, linkIndex) => {
    sql += `INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='${quote(group.category)}'), '${quote(link.title)}', '${quote(link.url)}', ${linkIndex});\n`;
  });

  sql += "\n";
});

fs.writeFileSync("migrations/0001_init.sql", sql);
const defaultTenant = {
  slug: "zhaotao",
  name: "zhaotao",
  adminToken: "76228f6039d240938f550232266157e066a778401c04479cabfa69289b92f5b4",
};

let rebuildSql = `-- Rebuild the full multi-tenant D1 database.
-- WARNING: this drops existing navigation tables before recreating them.
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS bookmarks;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS tenant_tokens;
DROP TABLE IF EXISTS tenants;

PRAGMA foreign_keys = ON;

CREATE TABLE tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  admin_token TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tenant_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN ('admin', 'editor')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'book',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, name)
);

CREATE TABLE bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenants_sort ON tenants(sort_order, id);
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenant_tokens_tenant ON tenant_tokens(tenant_id, id);
CREATE INDEX idx_tenant_tokens_token ON tenant_tokens(token);
CREATE INDEX idx_categories_sort ON categories(sort_order, id);
CREATE INDEX idx_categories_tenant_sort ON categories(tenant_id, sort_order, id);
CREATE INDEX idx_bookmarks_category_sort ON bookmarks(category_id, sort_order, id);
CREATE INDEX idx_bookmarks_tenant_sort ON bookmarks(tenant_id, sort_order, id);
CREATE INDEX idx_bookmarks_tenant_category_sort ON bookmarks(tenant_id, category_id, sort_order, id);

INSERT INTO tenants (slug, name, admin_token, sort_order)
VALUES ('${quote(defaultTenant.slug)}', '${quote(defaultTenant.name)}', '${quote(defaultTenant.adminToken)}', 0);

INSERT INTO tenant_tokens (tenant_id, name, token, role)
VALUES (
  (SELECT id FROM tenants WHERE slug = '${quote(defaultTenant.slug)}'),
  '${quote(defaultTenant.name)} 管理员',
  '${quote(defaultTenant.adminToken)}',
  'admin'
);

`;

siteData.forEach((group, groupIndex) => {
  rebuildSql += `INSERT INTO categories (tenant_id, name, icon, sort_order) VALUES ((SELECT id FROM tenants WHERE slug='${quote(defaultTenant.slug)}'), '${quote(group.category)}', '${quote(group.icon || "book")}', ${groupIndex});\n`;

  group.links.forEach((link, linkIndex) => {
    rebuildSql += `INSERT INTO bookmarks (tenant_id, category_id, title, url, sort_order) VALUES ((SELECT id FROM tenants WHERE slug='${quote(defaultTenant.slug)}'), (SELECT categories.id FROM categories JOIN tenants ON tenants.id = categories.tenant_id WHERE tenants.slug='${quote(defaultTenant.slug)}' AND categories.name='${quote(group.category)}'), '${quote(link.title)}', '${quote(link.url)}', ${linkIndex});\n`;
  });

  rebuildSql += "\n";
});

fs.writeFileSync("migrations/rebuild_database.sql", rebuildSql);
console.log(`Generated ${siteData.length} categories and ${siteData.reduce((sum, item) => sum + item.links.length, 0)} bookmarks.`);
