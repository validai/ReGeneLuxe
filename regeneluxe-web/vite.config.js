import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Vitest / unit-test Vite config only.
 * Product runtime is Next.js (`npm run dev`). Do not use this file to serve the app.
 */
const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Screen tests keep react-router MemoryRouter; product uses nav/next via App Router.
      "@/nav": path.join(rootDir, "src/nav/vite.jsx"),
      "@": path.join(rootDir, "src"),
      "regeneluxe-nav": path.join(rootDir, "src/nav/vite.jsx"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    pool: "forks",
    fileParallelism: false,
  },
});
