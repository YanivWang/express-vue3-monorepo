/**
 * 空库时在 Categories 写入 `it-category-seed.json` 中的「IT技术」两级类目。
 * 不经过 HTTP；与 `db:seed-post` 解耦，**仅负责**示例类目（表与 RBAC 由本脚本内 `connectDatabase()` 就绪）。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { mergeDotenvFromMonorepoRoot } from "./synthetic-it-merge-monorepo-dotenv.js";

mergeDotenvFromMonorepoRoot();

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(apiRoot);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

type ItCategorySeedFile = {
  rootName: string;
  rootSortOrder?: number;
  children: Array<{ name: string; sortOrder: number }>;
};

function loadItCategorySeed(): ItCategorySeedFile {
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

const { connectDatabase, sequelize, Category } = await import("../src/db.js");

await connectDatabase();

const existing = await Category.count();
if (existing > 0) {
  console.log(`[db:seed-categories] 已有 ${existing} 条分类，跳过`);
  await sequelize.close();
  process.exit(0);
}

const seed = loadItCategorySeed();
const root = await Category.create({
  name: seed.rootName,
  parentId: null,
  sortOrder: seed.rootSortOrder ?? 0,
});

await Category.bulkCreate(
  seed.children.map(({ name, sortOrder }) => ({
    name,
    parentId: root.get("id") as number,
    sortOrder,
  })),
);

console.log(
  `[db:seed-categories] 已写入根「${seed.rootName}」及 ${seed.children.length} 个叶子分类`,
);

await sequelize.close();
process.exit(0);
