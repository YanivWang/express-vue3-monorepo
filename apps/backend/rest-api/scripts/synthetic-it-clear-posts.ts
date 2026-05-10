/**
 * 删除库中 `externalSource === 'synthetic-it'` 的帖子（评论 / 投票 / 收藏随 DB CASCADE 清除），并清空评论 manifest。
 * 由 `pnpm synthetic-it:seed` / `synthetic-it:clear` 在 `it-seed-categories.ts` 之后、`synthetic-it-run.ts` 之前链式执行。
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SYNTHETIC_IT_EXTERNAL_SOURCE,
  SYNTHETIC_IT_MANIFEST_RELATIVE,
} from "./synthetic-it-constants.js";
import { mergeDotenvFromMonorepoRoot } from "./synthetic-it-merge-monorepo-dotenv.js";

mergeDotenvFromMonorepoRoot();

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(apiRoot);

const MANIFEST_REL = SYNTHETIC_IT_MANIFEST_RELATIVE;

const SYNTHETIC_EXTERNAL_SOURCE = SYNTHETIC_IT_EXTERNAL_SOURCE;

const { connectDatabase, sequelize, Post } = await import("../src/db.js");

await connectDatabase();

const deleted = await Post.destroy({
  where: { externalSource: SYNTHETIC_EXTERNAL_SOURCE },
});

console.log(
  `[synthetic-it:clear] 已删除 ${deleted} 篇 externalSource=${SYNTHETIC_EXTERNAL_SOURCE} 的帖子（关联数据依库表 CASCADE）`,
);

const manifestPath = path.resolve(apiRoot, MANIFEST_REL);
await fs.mkdir(path.dirname(manifestPath), { recursive: true });
await fs.writeFile(manifestPath, JSON.stringify({ postsWithComments: [] }, null, 2), "utf8");
console.log(`[synthetic-it:clear] 已重置 manifest：${manifestPath}`);

await sequelize.close();
process.exit(0);
