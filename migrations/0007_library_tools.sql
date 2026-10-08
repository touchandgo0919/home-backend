-- Additive migration: existing rows and credentials are preserved.
ALTER TABLE categories ADD COLUMN deleted_at INTEGER;
ALTER TABLE categories ADD COLUMN delete_batch TEXT;
ALTER TABLE bookmarks ADD COLUMN deleted_at INTEGER;
ALTER TABLE bookmarks ADD COLUMN delete_batch TEXT;
ALTER TABLE bookmarks ADD COLUMN url_key TEXT;
ALTER TABLE bookmarks ADD COLUMN source_request TEXT;
UPDATE bookmarks SET url_key = url WHERE url_key IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookmarks_url_active ON bookmarks(tenant_id, url_key, deleted_at);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(tenant_id, deleted_at, sort_order);
CREATE TABLE IF NOT EXISTS write_requests (
 tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL, body_hash TEXT NOT NULL, result_id INTEGER,
 created_at INTEGER NOT NULL, PRIMARY KEY(tenant_id, request_key)
);
CREATE TABLE IF NOT EXISTS backup_runs (
 id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, status TEXT NOT NULL,
 object_key TEXT, checksum TEXT, counts TEXT, error TEXT
);
