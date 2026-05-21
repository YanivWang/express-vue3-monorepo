/** `it-category-seed.json` 读取与 synthetic-it 数据一致性校验（供 seed 脚本复用）。 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SYNTHETIC_IT_STATIC_BUNDLES } from "./synthetic-it-data-static.js";
import { SYNTHETIC_IT_OUTLINES } from "./synthetic-it-data.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

export type ItCategorySeedFile = {
  rootName: string;
  rootSortOrder?: number;
  children: Array<{ name: string; sortOrder: number }>;
};

function expectedLeafCategoryNames(): string[] {
  const fromStatic = SYNTHETIC_IT_STATIC_BUNDLES.map((b) => b.categoryName);
  const fromLlm = SYNTHETIC_IT_OUTLINES.map((o) => o.categoryName);
  const set = new Set([...fromStatic, ...fromLlm]);
  return [...set].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function loadItCategorySeed(): ItCategorySeedFile {
  const seedPath = path.join(scriptDir, "it-category-seed.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(seedPath, "utf8")) as unknown;
  } catch (err) {
    throw new Error(`[db:seed-categories] 无法读取 ${seedPath}: ${String(err)}`);
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as ItCategorySeedFile).rootName !== "string" ||
    !Array.isArray((parsed as ItCategorySeedFile).children)
  ) {
    throw new Error(`[db:seed-categories] 无效的 JSON: ${seedPath}`);
  }
  const { rootName, rootSortOrder, children } = parsed as ItCategorySeedFile;
  for (const c of children) {
    if (!c || typeof c.name !== "string" || typeof c.sortOrder !== "number") {
      throw new Error(`[db:seed-categories] children 项格式错误: ${seedPath}`);
    }
  }
  return { rootName, rootSortOrder, children };
}

export function assertItCategorySeedMatchesSyntheticData(seed: ItCategorySeedFile): void {
  const expected = expectedLeafCategoryNames();
  const actual = seed.children.map((c) => c.name).sort((a, b) => a.localeCompare(b, "zh-CN"));

  const missing = expected.filter((n) => !actual.includes(n));
  const extra = actual.filter((n) => !expected.includes(n));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `[db:seed-categories] it-category-seed.json 叶子分类与 synthetic-it 数据不一致。\n` +
        `  期望：${expected.join("、")}\n` +
        `  实际：${actual.join("、")}\n` +
        (missing.length ? `  缺少：${missing.join("、")}\n` : "") +
        (extra.length ? `  多余：${extra.join("、")}` : ""),
    );
  }
}
