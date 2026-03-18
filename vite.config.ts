import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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

export default defineConfig({
  plugins: [react()],
  base: resolveBase(),
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        collection: resolve(__dirname, "collection/index.html"),
      },
    },
  },
});
