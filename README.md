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
No database migration, existing Token rotation, or data reset is required for this release.

Global tenant management requires the platform Token. Tenant admins may manage their own Tokens;
editor accounts may edit only their own categories and bookmarks. Authentication uses `tenant_tokens`;
before upgrading an older installation, verify each active tenant credential has a corresponding row there.

Run `npm test` with Node.js 22.13+ (built-in `node:sqlite`) for transaction rollback, retry, account isolation,
privilege checks and revoked-Token tests. Tests use an isolated in-memory database.
