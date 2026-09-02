import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Alias } from "vite";

/**
 * 让 vitest 从**源码**解析 workspace 包，与应用构建保持一致。
 *
 * 背景：`packages/*` 的 exports 写了三个条件——`types` 与 `default` 指向 `src`，`node` 指向 `dist`。
 * 浏览器构建（Vite）不带 `node` 条件，落在 `default` 上，因此线上跑的是 `src`；
 * 而 vitest 默认把 node_modules 里的依赖当外部模块交给 Node 解析，Node 认 `node` 条件，
 * 于是测试跑的是 `dist`——同一份用例验证的其实是另一个产物。
 *
 * 后果不是「测试更严格」，而是**测试在说谎**：改了包源码后用例毫无反应，
 * 或者因为忘记重新构建而挂在与本次改动完全无关的地方。
 * （`server.deps.inline` 与 `resolve.conditions` 都救不了：前者作用在解析之后，
 * 后者管不到被外部化的依赖。能确定性改变解析结果的只有 alias。）
 *
 * 因此这里显式把包名映射到源码入口。约定：包根 → `src/index.ts`，
 * 子路径 → `src/<子路径>/index.ts`（与 packages 现有布局一致，新增子路径请沿用）。
 */
const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const packagesWithSubpaths = ["shared"];
const packagesRootOnly = ["request-core", "js-bridge", "web-monitor"];

function srcDir(pkg: string): string {
  return path.join(monorepoRoot, "packages", pkg, "src");
}

export function workspaceSrcAliases(): Alias[] {
  const aliases: Alias[] = [];

  // 子路径必须排在包根之前：Vite 按顺序匹配，包根的正则若先命中会吞掉子路径
  for (const pkg of packagesWithSubpaths) {
    aliases.push({
      find: new RegExp(`^@express-vue3-monorepo/${pkg}/(.*)$`),
      replacement: path.join(srcDir(pkg), "$1", "index.ts"),
    });
  }

  for (const pkg of [...packagesWithSubpaths, ...packagesRootOnly]) {
    aliases.push({
      find: new RegExp(`^@express-vue3-monorepo/${pkg}$`),
      replacement: path.join(srcDir(pkg), "index.ts"),
    });
  }

  return aliases;
}
