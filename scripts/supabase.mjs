import { localStatus, runCli, startLocal } from "./local-supabase.mjs";
import { buildFunctions } from "./build-supabase-functions.mjs";

try {
  const args = process.argv.slice(2);
  if (args[0] === "start") await startLocal();
  else if (args[0] === "status") {
    const status = localStatus();
    console.log(JSON.stringify(Object.fromEntries(Object.entries(status).filter(([name]) => name.endsWith("_URL") && !name.includes("DB"))), null, 2));
  } else {
    const functionsCommand = args[0] === "functions" && ["serve", "deploy"].includes(args[1]);
    const builder = functionsCommand ? await buildFunctions({ watch: args[1] === "serve" }) : null;
    try { await runCli(args); }
    finally { await builder?.dispose(); }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
