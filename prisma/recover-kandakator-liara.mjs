#!/usr/bin/env node
/**
 * Liara production recover — uses internal DATABASE_URL on the server.
 *   liara shell --app bordin --command "node prisma/recover-kandakator-liara.mjs"
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["tsx", "prisma/recover-kandakator-liara.ts"], {
  stdio: "inherit",
  shell: true,
  cwd: process.cwd(),
});

process.exit(result.status ?? 1);
