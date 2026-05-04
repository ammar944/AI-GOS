import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local agent/tooling workspaces are not part of the Next app lint target.
    ".claude/**",
    ".claude-flow/**",
    ".omc/**",
    ".vercel/**",
    "memory/**",
    "output/**",
    "research-worker/**",
    "skills/**",
    "tmp/**",
    "*.html",
    "*.jsx",
  ]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // React Compiler rules are stricter than the current app codebase. Keep
      // regular hooks, TypeScript, and Next rules active while avoiding a noisy
      // compiler migration in the default lint gate.
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
