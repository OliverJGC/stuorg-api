import { defineConfig, globalIgnores } from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  globalIgnores([
    "node_modules/**",
    "dist/**",
    "build/**",
    "coverage/**",
    ".cache/**",
    "**/generated/**",
    "**/*.generated.*",
  ]),
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}"],
    languageOptions: { parser: tsParser },
  },
  {
    ...prettier,
    files: ["**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}"],
    // Prettier disables curly by default; its "all" option is compatible.
    rules: { ...prettier.rules, curly: ["error", "all"] },
  },
]);
