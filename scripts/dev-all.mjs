import { spawn } from "node:child_process";
import { join } from "node:path";
import { root, startLocal } from "./local-supabase.mjs";

try {
  const status = await startLocal();
  const child = spawn(process.execPath, [join(root, "node_modules/vite/bin/vite.js"), "--host", "0.0.0.0", "--port", "5173", "--strictPort"], {
    cwd: root,
    env: { ...process.env, VITE_SUPABASE_URL: status.API_URL, VITE_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY || status.ANON_KEY },
    stdio: "inherit",
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("error", error => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
