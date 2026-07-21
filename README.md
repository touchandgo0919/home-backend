# home-backend

Backend service for the home project.

## Cloudflare Workers

Run locally:

```bash
npm run dev
```

Apply D1 migrations:

```bash
npm run db:migrate:remote
```

Deploy the Worker:

```bash
npm run deploy
```

Set `CORS_ORIGIN` in `wrangler.toml` to the Cloudflare Pages domain when the
frontend URL is known. Use `*` for initial setup or local testing.
