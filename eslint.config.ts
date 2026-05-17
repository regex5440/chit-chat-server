import tsESLint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig(
  { ignores: ["node_modules", "build", "*.d.ts", "*playground*", "**/Modal/*", "Dockerfile", ".*ignore", "*.yaml", "*.env", "README.md"] },
  tsESLint.configs.recommended,
  { rules: { "@typescript-eslint/no-explicit-any": "warn", "@typescript-eslint/no-unused-vars": "warn" } },
);
