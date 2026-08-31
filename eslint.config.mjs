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

/**
 * import 插件的模块解析。
 *
 * typescript 解析器实测占 `eslint .` 约 12.7s CPU（总 39.9s，约三成）：
 * 同机器对照，去掉它是 27.1s，只去掉 project 是 37.4s——成本在解析器本身，
 * 不在 project 的自动发现，因此调 project 无济于事。
 *
 * 仍然保留它。当前只启用了 import/order 与 import/no-duplicates，
 * 曾用探针逐条比对过：别名、相对路径、workspace 包、.vue 的分组与重复判定，
 * 去掉该解析器后结果一字不差。但它保的是往后——一旦启用 import/no-unresolved
 * 或在 tsconfig 里加新的 paths 映射，node 解析器解不出 `@/*` 这类别名，
 * 规则会静默给出错误结论。为省这十来秒换掉这份可信度不划算。
 */
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
      // 与 vitest.config.ts 同类：构建期配置文件不在 tsconfig 的 project 范围内
      "**/vitest.*.config.ts",
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
            { pattern: "@express-vue3-monorepo/**", group: "internal", position: "before" },
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
        // 必须与下面 .vue 专属块保持同一个值：这个块同时覆盖 .ts 与 .vue，
        // 若只在 .vue 那块声明，同一次运行里两种文件会向 project service 要两套不同配置，
        // TypeScript 于是无法把 .vue 纳入既有工程、只能为每个 SFC 另建 inferred project，
        // 与 .ts 交替时程序反复重建——实测同目录 67 个文件因此从 9s 涨到 91s。
        extraFileExtensions: [".vue"],
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
