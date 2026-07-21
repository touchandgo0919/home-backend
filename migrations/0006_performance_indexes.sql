-- Add indexes for the hot tenant-scoped read and write paths.
PRAGMA foreign_keys = ON;

-- Authentication joins by token, then reads the owning tenant.
CREATE INDEX IF NOT EXISTS idx_tenant_tokens_token_tenant ON tenant_tokens(token, tenant_id);

-- Tenant-scoped category mutations and ownership checks use id + tenant_id.
CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON categories(tenant_id, id);

-- Tenant-scoped bookmark mutations and deletes use id + tenant_id.
CREATE INDEX IF NOT EXISTS idx_bookmarks_tenant_id ON bookmarks(tenant_id, id);

-- Category deletes cascade through bookmarks by category_id and tenant_id.
CREATE INDEX IF NOT EXISTS idx_bookmarks_category_tenant ON bookmarks(category_id, tenant_id);
