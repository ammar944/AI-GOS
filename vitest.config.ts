import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    // Heavy jsdom integration/UI tests (audit-reader shell, onboarding wizard,
    // page-one-pager) and Supabase-mock journey tests legitimately run 1-7s and
    // flaked against vitest's 5s default on loaded CI/agent machines — a timeout
    // in one test cascades into assertion failures in its file siblings via
    // shared mock state. 20s gives ~3x headroom without masking real hangs.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "coverage"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        ".next/**",
        "coverage/**",
        "src/test/**",
        "**/*.d.ts",
        "vitest.config.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
