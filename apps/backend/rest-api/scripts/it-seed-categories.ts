/**
 * 空库时在 Categories 写入 `it-category-seed.json` 中的「IT技术」两级类目。
 * 不经过 HTTP；与 `db:seed-post` 解耦，**仅负责**示例类目（表与 RBAC 由本脚本内 `connectDatabase()` 就绪）。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertItCategorySeedMatchesSyntheticData,
  loadItCategorySeed,
} from "./it-category-seed.js";
import { mergeDotenvFromMonorepoRoot } from "./synthetic-it-merge-monorepo-dotenv.js";

mergeDotenvFromMonorepoRoot();

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(apiRoot);

const { connectDatabase, sequelize, Category } = await import("../src/db.js");

await connectDatabase();

const existing = await Category.count();
if (existing > 0) {
  console.log(`[db:seed-categories] 已有 ${existing} 条分类，跳过`);
  await sequelize.close();
  process.exit(0);
}

const seed = loadItCategorySeed();
assertItCategorySeedMatchesSyntheticData(seed);

const tx = await sequelize.transaction();
try {
  const root = await Category.create(
    {
      name: seed.rootName,
      parentId: null,
      sortOrder: seed.rootSortOrder ?? 0,
    },
    { transaction: tx },
  );

  const rootId = root.get("id") as number;
  const leaves = await Category.bulkCreate(
    seed.children.map(({ name, sortOrder }) => ({
      name,
      parentId: rootId,
      sortOrder,
    })),
    { transaction: tx },
  );

  await tx.commit();

  console.log(
    `[db:seed-categories] 已写入根「${seed.rootName}」(id=${rootId}) 及 ${leaves.length} 个叶子分类：${seed.children.map((c) => c.name).join("、")}`,
  );
} catch (err) {
  await tx.rollback();
  throw err;
}

await sequelize.close();
process.exit(0);
