# Bordin — Staging / Testing Environment

This project uses **one codebase** with **separate configuration** for production and staging. Production settings are never overwritten by staging files.

## Environment layout

| File | Purpose | Committed to git? |
|------|---------|-------------------|
| `.env` | Production Liara (`bordin`) | No (gitignored) |
| `.env.local` | Local dev overrides (memory DB) | No |
| `.env.staging` | Staging DB and secrets | No |
| `.env.staging.local` | Local overrides for `dev:staging` | No |
| `.env.example` | Production template | Yes |
| `.env.staging.example` | Staging template | Yes |
| `liara.json` | Deploy → **production** app | Yes |
| `liara.staging.json` | Deploy → **staging** app | Yes |

Prisma reads `DATABASE_URL` from the active environment file. No schema changes are required.

## Staging database (isolated)

- **Host:** `bordindbtest` (Liara private network)
- **Database:** `xenodochial_taussig`
- **Credentials:** stored in `.env.staging` only

Production uses `naughty_shannon` via `.env` — unchanged.

## Liara apps

| Environment | Liara app | Config file |
|-------------|-----------|-------------|
| Production | `bordin` | `liara.json` |
| Staging | `bordintest` | `liara.staging.json` |

Update `"app"` in `liara.staging.json` if your staging app id differs.

Staging deploy uses the **node** platform (Node 20), not `next`, to avoid `npm ci` lockfile errors on Liara builders.

Both the staging **app** and **database** must be on the same Liara private network.

## Commands

### Local development

```bash
# Normal local dev (in-memory DB)
npm run dev

# Staging code path locally (BORDIN_ENV=staging, still in-memory on PC)
npm run dev:staging
```

### Deploy

```bash
# Production — unchanged
npm run deploy:production

# Staging only
npm run deploy:staging
```

### Staging env on Liara

```bash
# Push .env.staging → Liara staging app (does not touch production)
npm run env:sync:staging
```

### Database (staging)

The staging DB host is only reachable **inside Liara**. Run migrations from the staging app shell:

```bash
liara shell --app bordintest
npx prisma db push
npx tsx prisma/seed.ts
```

Or use the npm aliases (same commands, loads `.env.staging` — only works if DB is reachable):

```bash
npm run db:setup:staging
```

## First-time staging setup checklist

1. Create Liara app `bordintest` (or update `liara.staging.json`).
2. Create MySQL DB `xenodochial_taussig` on host `bordindbtest`.
3. Put app + DB on the same private network.
4. Copy `.env.staging.example` → `.env.staging` and fill values.
5. Run `npm run env:sync:staging`.
6. Run `npm run deploy:staging`.
7. In `liara shell`, run `npx prisma db push` and `npx tsx prisma/seed.ts`.

## Safety

- `deploy:production` uses `liara.json` → app `bordin`.
- `deploy:staging` uses `liara.staging.json` → app `bordintest`.
- `env:sync:staging` only updates the staging app.
- Production `.env` and `liara.json` are not modified by staging tooling.
