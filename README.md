# home-backend

Backend service for the home project.

## Cloudflare Workers

Run locally:

```bash
npm run dev
```

Before production changes, export and verify a full database backup. Check for
pending migrations, inspect their SQL, and apply only reviewed migrations:

```bash
npx wrangler d1 export homepage --remote --output /private/backup/path/homepage.sql
npx wrangler d1 migrations list homepage --remote
npm run db:migrate:remote
```

`scripts/rebuild_database.sql` is a destructive manual reset script. It is kept
outside `migrations/` so normal migration commands never run it automatically.
The seed generator reads `data/seed.json`; run `npm run seed:generate` after
editing that file to regenerate the initial migration and manual reset script.

Deploy the Worker:

```bash
npm run deploy
```

Set `CORS_ORIGIN` in `wrangler.toml` to the Cloudflare Pages domain when the
frontend URL is known. Use `*` for initial setup or local testing.

## Extension registration

`POST /api/auth/register` accepts JSON `{ "name": "My navigation", "registration_key": "<64 lowercase hex characters>" }`.
The client must generate the key using 32 cryptographically random bytes and persist it privately before submitting.
Treat the key as a credential: it recovers the same account and Token after a lost response.
The response is HTTP 201 with `{ token, nav }`; `nav` contains only the new user's navigation.
Names must contain 1–40 characters. A transaction creates the tenant, an editor Token and the default `我的收藏` category.
Client-supplied roles and tenant IDs are ignored. Retrying never restores a revoked Token.

Deploy the `REGISTRATION_LIMITER` binding in `wrangler.toml` with the Worker. Without it registration returns 503.
The limit is 10 registration requests per minute per connecting IP at each Cloudflare location (429 when exceeded).
The current reverse proxy shares its IP quota across users; this is a coarse abuse limit, not a per-person quota.
Registration itself needs no migration. The 1.2 library features require migration 0007 below. Existing Tokens are preserved.

Global tenant management requires the platform Token. Tenant admins may manage their own Tokens;
editor accounts may edit only their own categories and bookmarks. Authentication uses `tenant_tokens`;
before upgrading an older installation, verify each active tenant credential has a corresponding row there.

Run `npm test` with Node.js 22.13+ (built-in `node:sqlite`) for transaction rollback, retry, account isolation,
privilege checks and revoked-Token tests. Tests use an isolated in-memory database.


## 1.2 library tools and recovery

Apply only the additive `0007_library_tools.sql` migration after exporting and validating the live database.
It adds trash timestamps, normalized URL lookup keys, write receipts and backup metadata; it does not delete rows or rotate Tokens.
After migration, query `SELECT id,url FROM bookmarks` into a private JSON file and run `scripts/normalize-url-keys.mjs`
to prepare reviewed SQL updates to `url_key` only. Original URLs and existing duplicates are preserved.
Deploy this backend before the 1.2 frontend and extension.

- `GET /api/collections`: lightweight authenticated collection list without bookmark payloads.
- `GET /api/bookmarks/check?url=...`: current tenant's normalized URL lookup.
- `POST /api/bookmarks`: atomic duplicate check; optional `request_id` makes an explicit retry return the original result.
- `DELETE /api/bookmarks/:id` and `/api/categories/:id`: soft delete, returning an undo descriptor.
- `GET /api/trash`, `POST /api/trash/restore`: 30-day recovery, scoped to the authenticated account.
- `GET /api/data/export`: credential-free JSON export.
- `POST /api/data/import/preview`: read-only validation, duplicate and invalid counts.
- `POST /api/data/import`: transactional merge, up to 1,000 entries and 1 MiB. Requires a unique `request_id`.
  `restore_deleted: true` reactivates matching deleted collections for a user-approved recovery merge.
- `GET /api/backups`: backup timestamps and status. `GET /api/backups/:id`: checksum-verified export for the current account only.
- `POST /api/backups/run`: platform-only manual backup.

`HOME_BACKUPS` is a private Cloudflare KV namespace independent of D1. Cron `0 19 * * *` runs daily at 03:00 Asia/Shanghai.
It snapshots tenants, credentials, collections, bookmarks and write receipts in one D1 batch, then stores a checksummed JSON
object with a 35-day TTL. Regular users receive only their own active collections/bookmarks when requesting a backup.
A successful backup is required before the scheduled job purges trash older than 30 days. Failure is recorded and thrown
so the scheduled invocation reports failure; the UI shows backup status. No alert email is configured.
Snapshots over 20 MiB fail explicitly; increase capacity before reaching that size. KV is eventually consistent, so a newly
created snapshot may need a short delay before a different location can download it.

Recovery merges a selected account's bookmarks without replacing current data or credentials. For full disaster recovery,
retrieve the private full snapshot with an authorized Cloudflare account, validate its SHA-256 against `backup_runs`, and
restore into a separate database for review before changing production bindings. Do not overwrite a live database blindly.
