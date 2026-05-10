import fs from "node:fs";
import path from "node:path";

/**
 * 自 `startDir` 起向上查找包含 `pnpm-workspace.yaml` 的目录（monorepo 根）。
 * 供 `scripts/**` 使用，避免从脚本 import `src/utils/monorepoRoot`（与运行时代码解耦）。
 * 行为须与 `src/utils/monorepoRoot.ts` 保持一致；若修改请同步两处。
 */
export function findMonorepoRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`[monorepo] pnpm-workspace.yaml not found above ${path.resolve(startDir)}`);
    }
    dir = parent;
  }
}
