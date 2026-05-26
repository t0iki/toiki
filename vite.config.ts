import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { renameSync, mkdirSync, existsSync } from "node:fs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "rewrite-manage-html",
      apply: "build",
      closeBundle() {
        // /manage でアクセスできるよう dist/manage.html を dist/manage/index.html に移動
        const distDir = resolve(__dirname, "dist");
        const src = resolve(distDir, "manage.html");
        const destDir = resolve(distDir, "manage");
        const dest = resolve(destDir, "index.html");
        if (existsSync(src)) {
          mkdirSync(destDir, { recursive: true });
          renameSync(src, dest);
        }
      },
    },
  ],
  base: "/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        manage: resolve(__dirname, "manage.html"),
      },
    },
  },
});
