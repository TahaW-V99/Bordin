#!/usr/bin/env node
/**
 * Deploy to Liara with explicit branch/environment separation.
 *
 *   node scripts/liara-deploy.mjs staging
 *   node scripts/liara-deploy.mjs staging --branch=feature/team-bracket
 *   node scripts/liara-deploy.mjs production
 *   node scripts/liara-deploy.mjs both
 *
 * Production always deploys from main only (unless you intentionally --force).
 * Staging deploys from develop by default; use --branch=<feature> to preview a feature branch.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const PRODUCTION_BRANCH = process.env.PRODUCTION_BRANCH || "main";
const ALLOWED_PRODUCTION_BRANCHES = new Set([PRODUCTION_BRANCH, "master"]);
const STAGING_BRANCH = process.env.STAGING_BRANCH || "develop";

const target = process.argv[2];
const forceFlag = process.argv.includes("--force");
const force = forceFlag || process.env.ALLOW_PRODUCTION_DEPLOY === "1";
const stagingForce = forceFlag || process.env.ALLOW_STAGING_DEPLOY === "1";
const selectedBranchArg = process.argv.find((arg) => arg.startsWith("--branch="));
const selectedBranch = selectedBranchArg?.slice("--branch=".length)?.trim() || null;

function runGit(args) {
  try {
    const result = spawnSync("git", args, { encoding: "utf8" });
    if (result.status !== 0) return null;
    return (result.stdout || "").trim();
  } catch {
    return null;
  }
}

function resolveGitDir() {
  const directGitDir = path.join(process.cwd(), ".git");
  if (!existsSync(directGitDir)) return null;

  try {
    const statText = readFileSync(directGitDir, "utf8");
    const match = statText.match(/^gitdir:\s*(.+)$/im);
    if (!match) return directGitDir;
    return path.resolve(process.cwd(), match[1].trim());
  } catch {
    return directGitDir;
  }
}

function getCurrentBranchFromHeadFile() {
  const gitDir = resolveGitDir();
  if (!gitDir) return null;

  try {
    const head = readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
    const match = head.match(/^ref:\s+refs\/heads\/(.+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function getCurrentBranch() {
  return runGit(["rev-parse", "--abbrev-ref", "HEAD"]) || getCurrentBranchFromHeadFile();
}

function hasUncommittedChanges() {
  const status = runGit(["status", "--porcelain"]);
  if (status === null) return null;
  return status.length > 0;
}

function assertProductionDeployAllowed() {
  if (force) {
    console.warn("⚠ Production deploy: branch check skipped (--force / ALLOW_PRODUCTION_DEPLOY=1).");
    return;
  }

  const branch = getCurrentBranch();
  if (!branch) {
    console.error("❌ Production deploy blocked: git is not available.");
    console.error("   Install git, or run with --force only if you are sure:");
    console.error("   npm run deploy:production:force");
    process.exit(1);
  }

  if (!ALLOWED_PRODUCTION_BRANCHES.has(branch)) {
    console.error(`❌ Production deploy blocked: current branch is "${branch}".`);
    console.error(`   bordin.ir only accepts code from "${PRODUCTION_BRANCH}" (approved releases).`);
    console.error("");
    console.error("   Workflow:");
    console.error("   1. Develop & test  →  npm run deploy:staging     (bordintest.ir)");
    console.error(`   2. Merge to ${PRODUCTION_BRANCH} when OK`);
    console.error("   3. Release         →  npm run deploy:production  (bordin.ir)");
    console.error("");
    console.error("   Deploy both (same approved code): npm run deploy:both");
    process.exit(1);
  }

  const dirty = hasUncommittedChanges();
  if (dirty) {
    console.warn("⚠ Uncommitted local changes will be deployed to production.");
  } else if (dirty === false) {
    console.log(`✓ Branch "${branch}" — production deploy allowed.`);
  }
}

function assertStagingDeployAllowed() {
  const branch = getCurrentBranch();

  // Explicit feature-branch preview: only verify the selected branch is the one checked out.
  if (selectedBranch) {
    if (!branch) {
      console.error("❌ Staging deploy blocked: current branch could not be detected.");
      console.error(`   Switch to "${selectedBranch}" and re-run:`);
      console.error(`   npm run deploy:staging -- --branch=${selectedBranch}`);
      process.exit(1);
    }

    if (branch !== selectedBranch) {
      console.error(`❌ Staging deploy blocked: selected branch is "${selectedBranch}" but current branch is "${branch}".`);
      console.error("   Checkout the intended feature branch first, then deploy staging again.");
      process.exit(1);
    }

    console.log(`✓ Staging deploy source locked to feature branch "${branch}".`);
    return;
  }

  if (stagingForce) {
    console.warn("⚠ Staging deploy: branch check skipped (--force / ALLOW_STAGING_DEPLOY=1).");
    return;
  }

  if (!branch) {
    console.error("❌ Staging deploy blocked: git is not available / current branch could not be detected.");
    console.error(`   Checkout "${STAGING_BRANCH}", or preview a feature branch explicitly:`);
    console.error("   npm run deploy:staging -- --branch=<feature-branch>");
    process.exit(1);
  }

  if (branch !== STAGING_BRANCH) {
    console.error(`❌ Staging deploy blocked: current branch is "${branch}".`);
    console.error(`   bordintest.ir deploys from "${STAGING_BRANCH}" by default (integration branch).`);
    console.error("");
    console.error("   Options:");
    console.error(`   • Switch to ${STAGING_BRANCH}:  git checkout ${STAGING_BRANCH}  →  npm run deploy:staging`);
    console.error("   • Preview one feature branch:  npm run deploy:staging -- --branch=<feature-branch>");
    process.exit(1);
  }

  console.log(`✓ Branch "${branch}" — staging deploy allowed.`);
}

function liaraDeploy(staging) {
  const app = staging ? "bordintest (bordintest.ir)" : "bordin (bordin.ir)";
  console.log(`\n→ Deploying to ${app}...\n`);

  const args = staging
    ? ["deploy", "--liara-json", "liara.staging.json", "--no-app-logs"]
    : ["deploy"];

  const result = spawnSync("liara", args, { stdio: "inherit", shell: true });
  const code = result.status ?? 1;
  if (code !== 0) {
    console.error(`\n❌ Deploy to ${app} failed (exit ${code}).`);
    process.exit(code);
  }

  console.log(`\n✓ Deploy to ${app} finished.\n`);
}

if (!target || !["staging", "production", "both"].includes(target)) {
  console.error("Usage: node scripts/liara-deploy.mjs <staging|production|both> [--branch=name] [--force]");
  process.exit(1);
}

if (target === "staging") {
  assertStagingDeployAllowed();
  liaraDeploy(true);
  process.exit(0);
}

if (target === "production") {
  assertProductionDeployAllowed();
  liaraDeploy(false);
  process.exit(0);
}

// both: release the SAME approved code to both apps. This is a production release,
// so it is gated on the production branch (main) and deployed to staging + production.
assertProductionDeployAllowed();
liaraDeploy(true);
liaraDeploy(false);
