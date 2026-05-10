import path from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier/flat";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

const importPluginSettings = {
  "import/resolver": {
    typescript: {
      alwaysTryTypes: true,
      project: true,
    },
    node: {
      extensions: [".js", ".jsx", ".ts", ".tsx", ".vue", ".mjs", ".cjs"],
    },
  },
};

/**
 * Flat ESLint：后端 recommended type-checked（Express 友好覆盖）；前端 / packages 同步；
 * Vue SFC 使用 vue-eslint-parser；纯 JS 关闭 type-aware；import 排序由 eslint-plugin-import 负责。
 */
export default tseslint.config(
  {
    ignores: [
      "dist",
      "**/dist/**",
      "coverage",
      "**/coverage/**",
      "node_modules",
      "**/node_modules/**",
      "**/*.d.ts",
      "**/vitest.config.ts",
      "pnpm-lock.yaml",
      "logs/**",
      "uploads/**",
      ".pnpm-store/**",
    ],
  },
  {
    files: ["apps/**/*.{ts,vue,js,mjs}", "packages/**/*.{ts,vue,js,mjs}"],
    plugins: { import: importPlugin },
    settings: importPluginSettings,
    rules: {
      "import/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
          pathGroups: [
            { pattern: "@/**", group: "internal", position: "before" },
            { pattern: "@vue3-express-monorepo/**", group: "internal", position: "before" },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
        },
      ],
      "import/no-duplicates": "warn",
    },
  },
  {
    files: ["apps/backend/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
      globals: globals.node,
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true,
          allowBoolean: true,
          allowNullish: true,
          allowAny: true,
        },
      ],
      "@typescript-eslint/no-unnecessary-type-conversion": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-invalid-void-type": "off",
      "@typescript-eslint/no-deprecated": "warn",
      "@typescript-eslint/no-base-to-string": "warn",
    },
  },
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["apps/frontend/**/*.{ts,vue}", "packages/**/*.{ts,vue}"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-console": ["warn", { allow: ["log", "warn", "error", "info"] }],
      "vue/multi-word-component-names": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-base-to-string": "warn",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-enum-comparison": "warn",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
      "@typescript-eslint/prefer-promise-reject-errors": "warn",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true,
          allowBoolean: true,
          allowNullish: true,
          allowAny: true,
        },
      ],
    },
  },
  {
    files: ["apps/frontend/**/*.vue", "packages/**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
        projectService: true,
        tsconfigRootDir,
      },
    },
  },
  {
    files: ["apps/frontend/**/*.{js,mjs}", "packages/**/*.{js,mjs}"],
    extends: [js.configs.recommended, tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  prettier,
);
