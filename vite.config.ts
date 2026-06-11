import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const resolveBase = () => {
  if (process.env.VITE_BASE) {
    return process.env.VITE_BASE;
  }

  const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
  if (!repo) {
    return "/";
  }

  return repo.endsWith(".github.io") ? "/" : `/${repo}/`;
};

// Every page is a build entry so Tailwind/daisyUI classes are compiled for
// all of them. Output paths mirror the source paths, so public URLs
// (e.g. /training-tracker-app.html) stay exactly as they were.
const entry = (page: string) => fileURLToPath(new URL(page, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: resolveBase(),
  build: {
    rollupOptions: {
      input: {
        home: entry("index.html"),
        tracker: entry("training-tracker-app.html"),
        notFound: entry("404.html"),
        cv: entry("cv/index.html"),
      },
    },
  },
});
