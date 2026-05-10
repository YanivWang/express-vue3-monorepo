/**
 * 删除帖子侧**全部**关联数据：**点赞/踩**（PostVotes）、**收藏**（PostFavorites）先清空，再删**全部帖子**；
 * **评论**（Comments，含回复）依赖帖子外键 `ON DELETE CASCADE` 一并删除。
 * 磁盘仅删除 **`uploads/posts/`**（与 `postUploadDiskSegment` 一致）下全部内容后重建空目录；**不删除** `uploads/profiles/` 等其它子目录。
 * 将 **`User.avatar` 中路径以 `/uploads/posts/` 开头的**置空（误用帖子图作头像时可避免指向已删文件）；**`/uploads/profiles/` 头像保留**。
 * 另清空合成流程的评论 manifest。
 * 由 `pnpm db:init-post` / `synthetic-it:clear` 在 `it-seed-categories.ts` 之后、`synthetic-it-run.ts` 之前链式执行。
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { Op } from "sequelize";

import {
  ensureUploadsRoot,
  postUploadDiskSegment,
  uploadsRoot,
} from "../src/config/upload.config.js";

import { SYNTHETIC_IT_MANIFEST_RELATIVE } from "./synthetic-it-constants.js";
import { mergeDotenvFromMonorepoRoot } from "./synthetic-it-merge-monorepo-dotenv.js";

mergeDotenvFromMonorepoRoot();

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(apiRoot);

const MANIFEST_REL = SYNTHETIC_IT_MANIFEST_RELATIVE;

const { connectDatabase, sequelize, Post, PostVote, PostFavorite, User } =
  await import("../src/db.js");

await connectDatabase();

const allRows = sequelize.literal("1=1");

const nVotes = await PostVote.destroy({ where: allRows });
const nFavorites = await PostFavorite.destroy({ where: allRows });
const nPosts = await Post.destroy({ where: allRows });

console.log(
  `[synthetic-it:clear] 点赞/踩 ${nVotes} 条 · 收藏 ${nFavorites} 条 · 帖子 ${nPosts} 篇（评论随帖子 CASCADE）`,
);

ensureUploadsRoot();
const postsDiskDir = path.join(uploadsRoot, postUploadDiskSegment);
await fs.rm(postsDiskDir, { recursive: true, force: true });
await fs.mkdir(postsDiskDir, { recursive: true });

const postsAvatarPrefix = `/uploads/${postUploadDiskSegment}/`;
const [nAvatarCleared] = await User.update(
  { avatar: null },
  { where: { avatar: { [Op.like]: `${postsAvatarPrefix}%` } } },
);

console.log(
  `[synthetic-it:clear] 已清空帖子图片目录 ${postsDiskDir}` +
    `${nAvatarCleared > 0 ? ` · 复位误用为该前缀的头像字段 ${nAvatarCleared} 条` : ""}`,
);

const manifestPath = path.resolve(apiRoot, MANIFEST_REL);
await fs.mkdir(path.dirname(manifestPath), { recursive: true });
await fs.writeFile(manifestPath, JSON.stringify({ postsWithComments: [] }, null, 2), "utf8");
console.log(`[synthetic-it:clear] 已重置 manifest：${manifestPath}`);

await sequelize.close();
process.exit(0);
