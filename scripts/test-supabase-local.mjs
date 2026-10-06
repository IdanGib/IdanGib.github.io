import { spawn } from "node:child_process";
import { root, localStatus } from "./local-supabase.mjs";

try {
  const status = localStatus();
  const secret = status.SECRET_KEY || status.SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Local Supabase did not return the administrative key needed for isolated fixtures.");
  const child = spawn(process.execPath, ["--test", "tests/supabase.integration.mjs"], {
    cwd: root,
    env: { ...process.env, SUPABASE_TEST_URL: status.API_URL, SUPABASE_TEST_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY || status.ANON_KEY, SUPABASE_TEST_SECRET_KEY: secret, SUPABASE_TEST_MAIL_URL: status.MAILPIT_URL || status.INBUCKET_URL },
    stdio: "inherit",
  });
  child.on("error", error => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
