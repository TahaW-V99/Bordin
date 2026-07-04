export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const runtimeImport = new Function("path", "return import(path)") as (
    path: string,
  ) => Promise<unknown>;
  const runtimeRequire = eval("require") as NodeRequire;
  const { resolve } = runtimeRequire("path") as typeof import("path");
  const { pathToFileURL } = runtimeRequire("url") as typeof import("url");
  const startupUrl = pathToFileURL(resolve(process.cwd(), "runtime", "kandakator-startup.mjs")).href;
  await runtimeImport(startupUrl);
}
