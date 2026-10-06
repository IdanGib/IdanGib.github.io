import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFunctions } from "./build-supabase-functions.mjs";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const cli = join(root, "node_modules", ".bin", process.platform === "win32" ? "supabase.cmd" : "supabase");
export const cliEnv = {
  ...process.env,
  SUPABASE_HOME: process.env.SUPABASE_HOME || join(root, "supabase", ".temp", "cli-home"),
  SUPABASE_INTERNAL_IMAGE_REGISTRY: process.env.SUPABASE_INTERNAL_IMAGE_REGISTRY || "ghcr.io",
};

export function prepareLocalFunctions() {
  const path = join(root, "supabase", "functions", ".env");
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "EDITOR_SITE_URL=http://localhost:5173\n", { flag: "wx", mode: 0o600 });
  }
}

export function localStatus() {
  const result = spawnSync(cli, ["status", "-o", "json"], { cwd: root, env: cliEnv, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error("Local Supabase is unavailable. Run npm run supabase:start first.");
  const status = JSON.parse(result.stdout);
  if (!status.API_URL || !(status.PUBLISHABLE_KEY || status.ANON_KEY)) throw new Error("Local Supabase did not return its API URL and public key.");
  return status;
}

export function runCli(args, { hideOutput = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cli, args, { cwd: root, env: cliEnv, stdio: ["inherit", hideOutput ? "pipe" : "inherit", "inherit"] });
    // start/status output includes local administrative credentials; do not log it.
    let output = "";
    if (hideOutput) child.stdout.on("data", data => { output = (output + data).slice(-64 * 1024); });
    const stop = signal => child.kill(signal);
    const interrupt = () => stop("SIGINT"), terminate = () => stop("SIGTERM");
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", terminate);
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", terminate);
      if (code === 0) { resolve(); return; }
      let reason = "";
      for (const line of output.split("\n")) {
        try {
          const result = JSON.parse(line);
          if (typeof result.error?.message === "string") reason = result.error.message;
        } catch { /* Only structured error messages are safe to display. */ }
      }
      reject(new Error(`Supabase ${args[0]} failed (${signal || code}).${reason ? ` ${reason}` : ""}`));
    });
  });
}

export async function startLocal() {
  prepareLocalFunctions();
  await buildFunctions();
  // The CLI considers a running database an already-started stack, even after
  // stopping `functions serve` removes its Edge container. Restore the selected
  // project's missing services through the normal backup-preserving lifecycle.
  const project = readFileSync(join(root, "supabase", "config.toml"), "utf8").match(/^project_id\s*=\s*"([A-Za-z0-9_-]+)"/m)?.[1];
  if (!project) throw new Error("Set project_id in supabase/config.toml before starting locally.");
  const running = service => {
    const result = spawnSync("docker", ["inspect", "--format", "{{.State.Running}}", `supabase_${service}_${project}`], { encoding: "utf8" });
    return result.status === 0 && result.stdout.trim() === "true";
  };
  if (running("db") && !["auth", "rest", "kong", "edge_runtime"].every(running)) {
    console.log("Restoring missing local Supabase services; the database backup is preserved.");
    await runCli(["stop"]);
  }
  await runCli(["start", "--exclude", "realtime,storage-api,imgproxy,logflare,vector,supavisor", "--output-format", "json"], { hideOutput: true });
  const status = localStatus();
  const health = await fetch(`${status.API_URL}/auth/v1/health`, { headers: { apikey: status.PUBLISHABLE_KEY || status.ANON_KEY } });
  if (!health.ok) throw new Error(`Supabase Auth readiness failed (${health.status}).`);
  const functionResponse = await fetch(`${status.API_URL}/functions/v1/editor-admin`, {
    method: "POST", headers: { apikey: status.PUBLISHABLE_KEY || status.ANON_KEY, "content-type": "application/json" }, body: "{}",
  });
  const functionBody = await functionResponse.json().catch(() => null);
  if (functionResponse.status !== 401 || functionBody?.error !== "Authentication required") {
    throw new Error(`Editor function readiness failed (${functionResponse.status}). Check npm run supabase:functions.`);
  }
  console.log("Local Supabase Auth, database, API, email capture, and editor function are available.");
  return status;
}
