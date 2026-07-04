# Deployment Workflow

This project keeps the existing Liara apps and URLs unchanged:

- Production: `https://bordin.ir`
- Test/Staging: `https://bordintest.ir`

## Branch Rules

- `main` is the only stable release branch.
- Every new feature must be developed on its own feature branch.
- Feature branches can be deployed to `bordintest.ir` for testing.
- Feature branches must never be deployed to `bordin.ir` unless they are merged into `main`.
- Urgent fixes can be made on `main` and deployed directly to production without including unfinished feature branches.

## Commands

### Deploy production

```bash
npm run deploy:production
```

This command is guarded and only allows deploy when the current branch is `main` (or `master` for legacy compatibility).

If you intentionally need to bypass the guard:

```bash
npm run deploy:production:force
```

Use this only for exceptional/manual recovery situations.

### Deploy test/staging from the current branch

```bash
npm run deploy:staging
```

This deploys the code currently checked out in your working tree to `https://bordintest.ir`.

### Deploy test/staging from a selected feature branch

First checkout the feature branch locally, then run:

```bash
npm run deploy:staging -- --branch=feature/my-work
```

The extra `--branch=...` flag does not switch branches for you. It verifies that the branch you selected is the branch currently checked out, so you do not accidentally deploy the wrong code to staging.

### Deploy the same approved code to both environments

```bash
npm run deploy:both
```

This deploys staging first, then production. Production is still blocked unless the current branch is `main`.

## Recommended Future Workflow

1. Create a new feature branch from `main`.
2. Build the feature only on that branch.
3. Deploy that branch to `bordintest.ir` with `npm run deploy:staging`.
4. Continue other unfinished features in other separate branches if needed.
5. For urgent production fixes, work on `main` and deploy with `npm run deploy:production`.
6. After a feature is approved on staging, merge it into `main`.
7. Deploy `main` to `bordin.ir`.

## What This Changes

This workflow only separates deploy source by branch.

It does **not** change:

- domains
- Liara app names
- DNS
- SSL
- routing
- application behavior
- database logic
- CI/CD architecture

The existing deploy target configuration remains the same; only the branch safety around deploy commands is improved.
