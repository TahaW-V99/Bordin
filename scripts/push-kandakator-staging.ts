import { existsSync, readFileSync } from "node:fs";
import { pushKandakatorWeekRemote } from "./push-kandakator-remote";

function parseEnvFile(path: string) {
  const env: Record<string, string> = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function mergeEnvFiles(paths: string[]) {
  const merged: Record<string, string> = {};
  for (const path of paths) {
    Object.assign(merged, parseEnvFile(path));
  }
  return merged;
}

const merged = mergeEnvFiles([".env.staging", ".env.staging.local"]);
for (const [key, value] of Object.entries(merged)) {
  process.env[key] = value;
}

pushKandakatorWeekRemote().catch((error) => {
  console.error(error);
  process.exit(1);
});
