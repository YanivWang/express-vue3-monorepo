import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

/**
 * 企业通用：单一 flat 配置，按路径分型（§6.0）。
 * - apps/backend：Node + JS，不含 Vue。
 * - apps/frontend、packages：Vue + TS + 浏览器全局。
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
      "pnpm-lock.yaml",
      "logs/**",
      "uploads/**",
      ".pnpm-store/**",
    ],
  },
  {
    files: ["apps/backend/**/*.{js,mjs,cjs}"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  ...pluginVue.configs["flat/recommended"],
  ...tseslint.configs.recommended,
  {
    files: ["apps/frontend/**/*.{ts,vue,js,mjs}", "packages/**/*.{ts,vue,js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
    },
  },
  {
    files: ["apps/frontend/**/*.{ts,vue}", "packages/**/*.{ts,vue}"],
    rules: {
      "no-console": ["warn", { allow: ["log", "warn", "error", "info"] }],
      "vue/multi-word-component-names": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  prettier,
  {
    files: ["apps/backend/**/*.{js,mjs,cjs}"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
