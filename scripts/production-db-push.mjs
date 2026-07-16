#!/usr/bin/env node
/**
 * Non-interactive prisma db push on Liara production.
 */
import { spawnSync } from "node:child_process";

const result = spawnSync(
  'liara shell --app bordin --command "npx prisma db push --accept-data-loss"',
  {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
