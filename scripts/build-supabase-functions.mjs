import { build, context } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const options = {
  absWorkingDir: root,
  entryPoints: ["supabase/functions/editor-admin/index.ts"],
  outfile: "supabase/functions/editor-admin/index.bundle.js",
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  alias: { "npm:@supabase/supabase-js@2.117.2": "@supabase/supabase-js" },
};

// Bundle the lockfile-installed SDK so local containers need no package-registry
// access. The same artifact is used by the hosted deployment command.
export async function buildFunctions({ watch = false } = {}) {
  if (!watch) { await build(options); return null; }
  const builder = await context(options);
  await builder.rebuild();
  await builder.watch();
  return builder;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildFunctions();
  console.log("Supabase editor function built.");
}
