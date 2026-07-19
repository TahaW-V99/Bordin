# Deployment Workflow

This project keeps the existing Liara apps and URLs unchanged:

- Production: `https://bordin.ir` (Liara app `bordin`)
- Test/Staging: `https://bordintest.ir` (Liara app `bordintest`)

Production and staging have **separate servers and separate databases**. The only
thing this workflow controls is **which branch is allowed to deploy where**.

## Branch Rules

- `main` is the **production** branch. Only tested, approved code lives here.
- `develop` is the **staging/integration** branch. All features are integrated here first.
- Every new feature is built on its own `feature/*` branch, created from `develop`.
- `bordin.ir` (production) deploys **only** from `main`.
- `bordintest.ir` (staging) deploys **only** from `develop` (feature previews are opt-in, see below).
- Unfinished work never touches `main`, so it can never reach production.

```
feature/*  ──merge──►  develop  ──deploy:staging──►  bordintest.ir
                           │
                           └──merge (when approved)──►  main  ──deploy:production──►  bordin.ir
```

## Commands

### Deploy production (main only)

```bash
git checkout main
npm run deploy:production
```

Guarded: only runs when the current branch is `main` (or `master` for legacy compatibility).

Emergency bypass (recovery only):

```bash
npm run deploy:production:force
```

### Deploy staging (develop only)

```bash
git checkout develop
npm run deploy:staging
```

Guarded: by default only runs when the current branch is `develop`.

### Deploy a feature branch to staging (opt-in preview)

To preview a single feature on staging without merging it into `develop` yet:

```bash
git checkout feature/my-work
npm run deploy:staging -- --branch=feature/my-work
```

The `--branch=...` flag does not switch branches. It asserts that the branch you
named is the one currently checked out, so you never deploy the wrong code.

Emergency bypass for staging (skips the branch check):

```bash
npm run deploy:staging -- --force
# or: ALLOW_STAGING_DEPLOY=1 npm run deploy:staging
```

### Deploy the same approved code to both environments

```bash
git checkout main
npm run deploy:both
```

This is a **production release**: it is gated on `main` and deploys that exact
code to staging first, then production.

## Standard Workflow

```bash
# 1) Start a feature from develop
git checkout develop
git pull origin develop
git checkout -b feature/my-work
# ...commit work...
git push -u origin feature/my-work

# 2) Integrate into develop when ready (PR preferred)
git checkout develop
git pull origin develop
git merge --no-ff feature/my-work
git push origin develop

# 3) Test on staging
git checkout develop
npm run deploy:staging      # → bordintest.ir

# 4) Promote to production once approved (PR preferred)
git checkout main
git pull origin main
git merge --no-ff develop
git push origin main

# 5) Release
git checkout main
npm run deploy:production    # → bordin.ir
```

Urgent hotfixes: make the fix on `main`, deploy production, then merge `main`
back into `develop` so both branches stay in sync.

## Configuration Notes

- Branch policy is enforced in `scripts/liara-deploy.mjs` (Git + deploy script).
  Liara itself has no branch binding — deploys ship the locally checked-out files.
- Override branch names if ever needed via env: `PRODUCTION_BRANCH`, `STAGING_BRANCH`.
- `liara.json` / `liara.staging.json` only select the Liara app; they are unchanged.

## What This Changes

This workflow only separates deploy source by branch. It does **not** change:

- domains, DNS, SSL, routing
- Liara app names
- application / business logic
- API behavior
- database schemas
- CI/CD architecture
