import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".pnpm-store/", "coverage/", "node_modules/", "playwright-report/", "test-results/"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{cjs,js,mjs,ts}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "error",
    },
  },
  {
    files: ["tests/**/*.{cjs,js,mjs,ts}"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
