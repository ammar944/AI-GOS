import { defineConfig } from "vitest/config";

/**
 * Dedicated vitest config for the Phase B provenance gate tests.
 *
 * The repo's root vitest.config.ts intentionally does NOT include scripts/provenance
 * in its global glob (surgical-changes rule — we don't broaden the project-wide test
 * surface for a throwaway zz-* gate). Run this suite explicitly:
 *
 *   npx vitest run --config scripts/provenance/vitest.config.ts
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["scripts/provenance/__tests__/**/*.{test,spec}.ts"],
    exclude: ["node_modules", ".next", "coverage"],
  },
});
