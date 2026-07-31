import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".pnpm-store/",
      ".cache/",
      "**/.turbo/",
      "**/dist/",
      "apps/mobile/.generated-git-metadata/",
      "coverage/",
      "node_modules/",
      "**/node_modules.linux-artifact/",
      "playwright-report/",
      "test-results/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/mobile/*.{cjs,js,mjs}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/*.{cjs,js,jsx,mjs,ts,tsx}"],
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
    files: ["**/__tests__/**/*.{cjs,js,jsx,mjs,ts,tsx}", "tests/**/*.{cjs,js,jsx,mjs,ts,tsx}"],
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
