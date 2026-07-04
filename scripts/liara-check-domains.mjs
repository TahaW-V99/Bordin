#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function getApiToken() {
  const authPath = join(homedir(), ".liara-auth.json");
  const auth = JSON.parse(readFileSync(authPath, "utf8"));
  const account = Object.values(auth.accounts).find((a) => a.current) ?? Object.values(auth.accounts)[0];
  if (!account?.api_token) throw new Error("Liara API token not found");
  return account.api_token;
}

async function api(path) {
  const token = getApiToken();
  const res = await fetch(`https://api.iran.liara.ir${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  const projects = await api("/v1/projects");
  const list = Array.isArray(projects) ? projects : projects?.projects ?? [];
  const bordin = list.find((p) => p.name === "bordin" || p.project_id === "bordin");
  if (!bordin) {
    console.log("Projects:", list.map((p) => p.name ?? p.project_id).join(", "));
    throw new Error("bordin project not found");
  }

  const projectId = bordin._id ?? bordin.id;
  console.log("Project:", bordin.name ?? bordin.project_id, projectId);

  const domains = await api(`/v1/domains?project=${projectId}`);
  const domainList = Array.isArray(domains) ? domains : domains?.domains ?? domains?.data ?? [];
  console.log("\nAttached domains:");
  for (const d of domainList) {
    const name = d.name ?? d.domain ?? d.hostname;
    const project = d.project?.project_id ?? d.project_id ?? d.project;
    console.log(
      `- ${name} | project=${project} | status=${d.status ?? "?"} | ssl=${d.certificatesStatus ?? "?"}`,
    );
    if (d._id || d.id) {
      try {
        const check = await api(`/v1/domains/${d._id ?? d.id}/check`);
        console.log(`  check: ${JSON.stringify(check?.domain?.status ?? check)}`);
      } catch (error) {
        console.log(`  check failed: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
