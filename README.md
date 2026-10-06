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
