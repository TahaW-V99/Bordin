import { spawnSync } from "node:child_process";

function liara(command) {
  const result = spawnSync(`liara shell --app bordin --command ${JSON.stringify(command)}`, {
    shell: true,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, CI: "true", TERM: "dumb" },
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  return result.status ?? 1;
}

const code = liara('node -e "process.exit(17)"');
console.error("exit code from liara:", code);
