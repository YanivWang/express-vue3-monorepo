import fsSync from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { findMonorepoRoot } from "./find-monorepo-root.js";

/** 种子脚本专用键：来自 `synthetic-it.env(.local)` 时可覆盖 monorepo 根 `.env.*` 中的同名项。 */
function isSyntheticSeedEnvKey(key: string): boolean {
  return (
    key.startsWith("REST_API_") ||
    key.startsWith("SYNTHETIC_") ||
    key.startsWith("DEDUPE_INDEXES") ||
    key.startsWith("ENSURE_SUPER_ADMIN_")
  );
}

/**
 * 先合并 monorepo 根 `.env.${bundle}` / `.env.${bundle}.local`（不覆盖进程已注入变量）；
 * 再读同目录 `synthetic-it.env`、`synthetic-it.env.local`：其中 **种子相关键** 始终写入 process.env（覆盖根目录同名键）。
 */
export function mergeDotenvFromMonorepoRoot(): void {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const root = findMonorepoRoot(path.join(scriptDir, ".."));
  const bundle = process.env.APP_ENV?.trim() || process.env.NODE_ENV?.trim() || "development";
  const alreadySet = new Set(Object.keys(process.env));
  for (const fname of [`.env.${bundle}`, `.env.${bundle}.local`]) {
    const full = path.join(root, fname);
    if (!fsSync.existsSync(full)) continue;
    const parsed = dotenv.parse(fsSync.readFileSync(full, "utf8"));
    for (const [k, v] of Object.entries(parsed)) {
      if (!alreadySet.has(k)) process.env[k] = v;
    }
  }

  for (const fname of ["synthetic-it.env", "synthetic-it.env.local"]) {
    const full = path.join(scriptDir, fname);
    if (!fsSync.existsSync(full)) continue;
    const parsed = dotenv.parse(fsSync.readFileSync(full, "utf8"));
    for (const [k, v] of Object.entries(parsed)) {
      if (!isSyntheticSeedEnvKey(k)) continue;
      process.env[k] = v;
    }
  }
}
