/**
 * 不向第三方站点抓取：按「IT技术」种子下的叶子分类注入合成技术短文与评论。
 * **执行**：在 monorepo 根 `pnpm db:init-post`，或在 `apps/backend/rest-api` 下 `pnpm db:init-post`，或根目录 `pnpm --filter @vue3-express-monorepo/rest-api db:init-post`。环境变量见 `synthetic-it.env`。
 * 流程：先 `dedupe-mysql-redundant-indexes` 清理重复 BTREE 索引，再 `it-seed-categories`（空库写 IT 类目）、`synthetic-it-clear-posts`（清空点赞/踩·收藏后删全部帖子、评论 CASCADE、仅清空 `uploads/posts/` 下文件），最后本脚本经 HTTP 写入帖子与评论（`externalSource` + `externalKey` 发帖幂等；评论完成后写 manifest）。
 *
 * **认证**：可设 `REST_API_IMPORT_TOKEN`，或不设则由脚本 **`POST …/login`** 取 JWT（管理员账号）。
 * **一键种子**：同上 **`pnpm db:init-post`**。环境变量见 `synthetic-it.env`。
 *
 * 帖子约束（脚本侧）：标题 trim 后 10～20 字符；正文 HTML trim 后 300～10000 字符（含标签）；至少 1 张本站 `/uploads/` 配图（正文内插入 `<img>`，`images` 数组与之对齐）。**每个叶子分类**在 synthetic-it-data.ts / synthetic-it-data-static.ts 中须配置 **16～60** 篇（synthetic-it-run 启动时校验）。
 *
 * 环境变量：
 * - REST_API_BASE：API 根路径（默认 http://127.0.0.1:2026/api，对齐 Compose 宿主网关 GATEWAY_HOST_PORT）。本机直连 `pnpm rest-api:dev`（PORT=3000）时可设为 `http://127.0.0.1:3000/api`。
 * - REST_API_IMPORT_TOKEN：管理员 Bearer JWT（可选；不设则调用登录接口）
 * - REST_API_IMPORT_USERNAME / REST_API_IMPORT_PASSWORD：专为种子登录（可选；须成对）；未设置时须能读取根 `.env.${APP_ENV}` 的非空 `ADMIN_BOOTSTRAP_*`
 * - SYNTHETIC_RATE_MS（默认 120）
 * - SYNTHETIC_USE_STATIC_BUNDLE：`1`|`true`|`0`|`false` 如上；不传则按是否配置 LLM Key 自动选择
 * - SYNTHETIC_LLM_API_KEY：走 LLM 时必填（自动静态模式下可不设）
 * - SYNTHETIC_LLM_BASE_URL（默认 https://api.openai.com/v1）
 * - SYNTHETIC_LLM_MODEL（默认 gpt-4o-mini）
 * - SYNTHETIC_LLM_JSON_OBJECT=0：禁用 response_format json_object（兼容不支持该参数的网关）
 * - SYNTHETIC_LLM_MAX_TOKENS（默认 4096）
 * - SYNTHETIC_LLM_TEMPERATURE（可选；默认由脚本设为约 0.42，兼顾事实稳妥与自然文风）
 * - SYNTHETIC_FETCH_IMAGES：可选。设为 0 / false 时**关闭**自动配图；设为 1 / true 时**强制开启**（须同时配置 SYNTHETIC_PEXELS_API_KEY）。**未设置时：只要配置了 SYNTHETIC_PEXELS_API_KEY 即默认拉取 Pexels 并上传**。
 * - SYNTHETIC_PEXELS_API_KEY：Pexels API Key（https://www.pexels.com/api/）。配置后即默认启用配图流水线：单次检索拉多张并翻页，整场种子维护已用 **Pexels photo id**，优先选未见过的资源；检索词仍会走兜底链路。对每个分类会先预热一张通用封面。
 * - SYNTHETIC_IMAGE_REUSE_LAST（可选）：拉图整链失败时为 `0` / `false` 则**不复用**「上一张成功封面」，直接仅占位 `/uploads/synthetic/...`（易 404）；默认开启复用以减少坏链。
 *
 * 环境与 monorepo：根目录 `.env.development`（及 `.local`）先合并；再合并 `scripts/synthetic-it.env`（及 `.local`）中的种子相关键并**优先生效**。完整键名见同目录 `synthetic-it.env`。
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { apiSuccessJson } from "./synthetic-it-api-client.js";
import {
  SYNTHETIC_IT_EXTERNAL_SOURCE,
  SYNTHETIC_IT_MANIFEST_RELATIVE,
} from "./synthetic-it-constants.js";
import {
  assertSyntheticPostImages,
  assertSyntheticPostLengths,
  htmlPlainExcerpt,
  SYNTHETIC_HTML_MIN_LEN,
  SYNTHETIC_POSTS_PER_CATEGORY_MAX,
  SYNTHETIC_POSTS_PER_CATEGORY_MIN,
} from "./synthetic-it-constraints.js";
import { SYNTHETIC_IT_STATIC_BUNDLES } from "./synthetic-it-data-static.js";
import { SYNTHETIC_IT_OUTLINES } from "./synthetic-it-data.js";
import { fetchPexelsPhotoAndUpload } from "./synthetic-it-image-fetch.js";
import { generateTechPost } from "./synthetic-it-llm.js";
import { mergeDotenvFromMonorepoRoot } from "./synthetic-it-merge-monorepo-dotenv.js";
import { resolveAdminImportToken } from "./synthetic-it-resolve-import-token.js";

import type { SyntheticBundle } from "./synthetic-it-data-static.js";

mergeDotenvFromMonorepoRoot();

const MANIFEST_PATH = path.resolve(process.cwd(), SYNTHETIC_IT_MANIFEST_RELATIVE);

type CommentManifest = {
  /** 已成功写入完整评论集合的帖子键（与 REST 幂等键一致） */
  postsWithComments: string[];
};

type PostPayload = SyntheticBundle["posts"][number];

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type CatRoot = {
  id: number;
  name: string;
  children?: { id: number; name: string }[];
};

function resolveLeafCategoryId(categories: unknown[], leafName: string): number {
  const roots = categories as CatRoot[];
  const it = roots.find((r) => r.name === "IT技术");
  if (!it?.children?.length) {
    throw new Error(
      "分类树中未找到「IT技术」或其子节点。请先在同一库执行 `pnpm it:seed-categories`，或跑一次 `pnpm synthetic-it:clear` / `pnpm db:init-post`（会链式写入类目）；并确保 REST 可读到的库已含该分类。",
    );
  }
  const leaf = it.children.find((c) => c.name === leafName);
  if (!leaf) {
    throw new Error(
      `未找到叶子分类「${leafName}」，当前子节点：${it.children.map((c) => c.name).join(",")}`,
    );
  }
  return leaf.id;
}

async function loadCommentManifest(): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    const j = JSON.parse(raw) as CommentManifest;
    return new Set(Array.isArray(j.postsWithComments) ? j.postsWithComments : []);
  } catch {
    return new Set();
  }
}

async function saveCommentManifest(keys: Set<string>) {
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  const body: CommentManifest = { postsWithComments: [...keys].sort() };
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(body, null, 2), "utf8");
}

function postDedupeKey(categoryName: string, externalKey: string) {
  return `${SYNTHETIC_IT_EXTERNAL_SOURCE}|${categoryName}|${externalKey}`;
}

/** 脚本占位路径：校验可通过但磁盘上通常无实体文件 */
function isSyntheticDiskPlaceholderPath(src: string): boolean {
  return src.includes("/uploads/synthetic/");
}

function assertCategoryPostCounts(): void {
  for (const o of SYNTHETIC_IT_OUTLINES) {
    const n = o.topics.length;
    if (n < SYNTHETIC_POSTS_PER_CATEGORY_MIN || n > SYNTHETIC_POSTS_PER_CATEGORY_MAX) {
      throw new Error(
        `synthetic-it-data.ts 分类「${o.categoryName}」topics 须在 ${SYNTHETIC_POSTS_PER_CATEGORY_MIN}～${SYNTHETIC_POSTS_PER_CATEGORY_MAX} 条（当前 ${n}）`,
      );
    }
  }
  for (const b of SYNTHETIC_IT_STATIC_BUNDLES) {
    const n = b.posts.length;
    if (n < SYNTHETIC_POSTS_PER_CATEGORY_MIN || n > SYNTHETIC_POSTS_PER_CATEGORY_MAX) {
      throw new Error(
        `synthetic-it-data-static.ts 分类「${b.categoryName}」posts 须在 ${SYNTHETIC_POSTS_PER_CATEGORY_MIN}～${SYNTHETIC_POSTS_PER_CATEGORY_MAX} 篇（当前 ${n}）`,
      );
    }
  }
}

async function prepareSyntheticPostPayload(
  post: PostPayload,
  bundle: { categoryName: string; keyPrefix: string },
  idx: number,
  ctx: {
    apiBase: string;
    token: string;
    rateMs: number;
    fetchImages: boolean;
    pexelsKey: string;
    /** 整场种子会话内出现过的 Pexels `photos[].id`，用于尽量不重复配图 */
    usedPexelsPhotoIds: Set<number>;
    reuseLastCoverOnMiss: boolean;
    /** 已成功上传的本站封面，用于本条拉图全失败时的可选复用，避免仅占位路径 */
    reuseCoverUrl: string | null;
  },
): Promise<{ title: string; html: string; images: string[] }> {
  const title = post.title.trim();
  let html = post.html.trim();
  const fallbackSrc = `/uploads/synthetic/${bundle.keyPrefix}-${idx}.webp`;

  let images =
    Array.isArray(post.images) && post.images.length > 0 ? post.images.map((x) => x.trim()) : [];

  if (ctx.fetchImages && ctx.pexelsKey) {
    const query =
      typeof post.imageSearchQuery === "string" && post.imageSearchQuery.trim().length > 0
        ? post.imageSearchQuery.trim()
        : `${bundle.categoryName} technology ${htmlPlainExcerpt(html, 160)}`;
    const selectionSalt = `${SYNTHETIC_IT_EXTERNAL_SOURCE}|${bundle.categoryName}|${bundle.keyPrefix}-${idx}`;
    const uploaded = await fetchPexelsPhotoAndUpload({
      apiBase: ctx.apiBase,
      restToken: ctx.token,
      pexelsApiKey: ctx.pexelsKey,
      query,
      refineHint: "developer",
      fallbackQueries: [
        `${bundle.categoryName} programming`,
        "software developer laptop",
        "technology workspace",
        "coding computer",
      ],
      avoidPexelsPhotoIds: ctx.usedPexelsPhotoIds,
      selectionSalt,
    });
    if (uploaded) {
      ctx.usedPexelsPhotoIds.add(uploaded.pexelsPhotoId);
      images = [uploaded.uploadUrl];
    }
    await sleep(ctx.rateMs);
  }

  if (images.length === 0) {
    const reuse = ctx.reuseCoverUrl?.trim() ?? "";
    if (ctx.reuseLastCoverOnMiss && reuse && !isSyntheticDiskPlaceholderPath(reuse)) {
      console.warn(`  [pexels] 本条未拉到新图，复用本站已有封面`);
      images = [reuse];
    } else {
      images = [fallbackSrc];
    }
  }

  const primary = images[0];
  if (!html.includes(primary)) {
    html = `${html}\n<p><img src="${primary}" alt="${escapeAttr(title)}" loading="lazy"/></p>`;
  }

  const filler = `<p>工程细节请以官方文档与团队约定为准；以上为提纲式说明。</p>`;
  while (html.trim().length < SYNTHETIC_HTML_MIN_LEN) {
    html = `${html}\n${filler}`;
  }

  assertSyntheticPostLengths(title, html);
  assertSyntheticPostImages(images);

  return { title, html, images };
}

async function postCommentChain(
  apiBase: string,
  token: string,
  postId: number,
  body: string,
  replies: string[] | undefined,
  rateMs: number,
) {
  const trimmed = body.trim().slice(0, 5000);
  const r = await apiSuccessJson("POST", apiBase, token, `/posts/${postId}/comments`, {
    content: trimmed,
  });
  await sleep(rateMs);
  const commentObj = r.comment as { id: number };
  const parentId = commentObj.id;

  for (const rep of replies ?? []) {
    await apiSuccessJson("POST", apiBase, token, `/posts/${postId}/comments`, {
      content: rep.trim().slice(0, 5000),
      parentId,
    });
    await sleep(rateMs);
  }
}

async function injectBundlePosts(
  apiBase: string,
  token: string,
  categories: unknown[],
  bundle: { categoryName: string; keyPrefix: string },
  posts: PostPayload[],
  commentDone: Set<string>,
  rateMs: number,
  fetchImages: boolean,
  pexelsKey: string,
  usedPexelsPhotoIds: Set<number>,
): Promise<{ postsProcessed: number; postsSkippedComments: number; commentsWritten: number }> {
  let postsProcessed = 0;
  let postsSkippedComments = 0;
  let commentsWritten = 0;

  const categoryId = resolveLeafCategoryId(categories, bundle.categoryName);
  console.log(`\n分类「${bundle.categoryName}」 -> categoryId=${categoryId}`);

  const reuseLastCoverOnMiss =
    process.env.SYNTHETIC_IMAGE_REUSE_LAST !== "0" &&
    process.env.SYNTHETIC_IMAGE_REUSE_LAST?.toLowerCase() !== "false";

  const prepBase = {
    apiBase,
    token,
    rateMs,
    fetchImages,
    pexelsKey,
    usedPexelsPhotoIds,
    reuseLastCoverOnMiss,
  };
  let reuseCoverUrl: string | null = null;

  if (fetchImages && pexelsKey) {
    const prime = await fetchPexelsPhotoAndUpload({
      apiBase,
      restToken: token,
      pexelsApiKey: pexelsKey,
      query: "technology laptop workspace",
      fallbackQueries: ["software developer computer", "coding workspace desk"],
      avoidPexelsPhotoIds: usedPexelsPhotoIds,
      selectionSalt: `${SYNTHETIC_IT_EXTERNAL_SOURCE}|${bundle.categoryName}|warmup-cover`,
    });
    if (prime) {
      usedPexelsPhotoIds.add(prime.pexelsPhotoId);
      reuseCoverUrl = prime.uploadUrl;
      console.log(`  [pexels] 本分类预热封面已写入 uploads`);
    }
    await sleep(rateMs);
  }

  for (let idx = 0; idx < posts.length; idx++) {
    const post = posts[idx];
    const externalKey = `${bundle.keyPrefix}-${idx}`;
    const dedupeKey = postDedupeKey(bundle.categoryName, externalKey);

    let payload: { title: string; html: string; images: string[] };
    try {
      payload = await prepareSyntheticPostPayload(post, bundle, idx, {
        ...prepBase,
        reuseCoverUrl,
      });
    } catch (e) {
      console.error(`  [校验失败] ${bundle.categoryName} ${externalKey}:`, e);
      throw e;
    }

    const created = await apiSuccessJson("POST", apiBase, token, "/posts", {
      title: payload.title,
      content: payload.html,
      published: true,
      images: payload.images,
      categoryId,
      externalSource: SYNTHETIC_IT_EXTERNAL_SOURCE,
      externalKey,
    });
    await sleep(rateMs);

    const postPayload = created.post as { id: number };
    const postId = postPayload.id;
    postsProcessed += 1;
    console.log(`  帖子 ${externalKey} -> postId=${postId}`);

    const cover = payload.images[0]?.trim() ?? "";
    if (cover && !isSyntheticDiskPlaceholderPath(cover)) {
      reuseCoverUrl = cover;
    }

    if (commentDone.has(dedupeKey)) {
      console.log(`  跳过评论（manifest 已标记完整注入）`);
      postsSkippedComments += 1;
      continue;
    }

    for (const c of post.comments) {
      await postCommentChain(apiBase, token, postId, c.body, c.replies, rateMs);
      commentsWritten += 1 + (c.replies?.length ?? 0);
    }

    commentDone.add(dedupeKey);
    await saveCommentManifest(commentDone);
  }

  return { postsProcessed, postsSkippedComments, commentsWritten };
}

async function main() {
  const apiBase = (process.env.REST_API_BASE?.trim() || "http://127.0.0.1:2026/api").replace(
    /\/$/,
    "",
  );

  const token = await resolveAdminImportToken(apiBase);

  assertCategoryPostCounts();

  const rateMs = Number(process.env.SYNTHETIC_RATE_MS ?? "120");

  const staticExplicit =
    process.env.SYNTHETIC_USE_STATIC_BUNDLE === "1" ||
    process.env.SYNTHETIC_USE_STATIC_BUNDLE?.toLowerCase() === "true";
  const llmForced =
    process.env.SYNTHETIC_USE_STATIC_BUNDLE === "0" ||
    process.env.SYNTHETIC_USE_STATIC_BUNDLE?.toLowerCase() === "false";
  const llmKey = (process.env.SYNTHETIC_LLM_API_KEY ?? "").trim();

  let useStatic: boolean;
  if (llmForced) useStatic = false;
  else if (staticExplicit) useStatic = true;
  else {
    useStatic = !llmKey;
    if (useStatic) {
      console.warn(
        "[synthetic-it] 未设置 SYNTHETIC_USE_STATIC_BUNDLE 且无 SYNTHETIC_LLM_API_KEY：自动使用静态正文 synthetic-it-data-static.ts。若要 LLM 生成请配置 SYNTHETIC_LLM_API_KEY。",
      );
    }
  }

  if (!useStatic && !llmKey) {
    console.error(
      "已选择 LLM 模式（SYNTHETIC_USE_STATIC_BUNDLE=0 或未走自动静态），但未设置 SYNTHETIC_LLM_API_KEY",
    );
    process.exit(1);
  }

  const pexelsKey = (process.env.SYNTHETIC_PEXELS_API_KEY ?? "").trim();
  const fetchExplicitOff =
    process.env.SYNTHETIC_FETCH_IMAGES === "0" ||
    process.env.SYNTHETIC_FETCH_IMAGES?.toLowerCase() === "false";
  const fetchExplicitOn =
    process.env.SYNTHETIC_FETCH_IMAGES === "1" ||
    process.env.SYNTHETIC_FETCH_IMAGES?.toLowerCase() === "true";

  if (fetchExplicitOn && !pexelsKey) {
    console.error("已开启 SYNTHETIC_FETCH_IMAGES，但未设置 SYNTHETIC_PEXELS_API_KEY");
    process.exit(1);
  }

  /** 配置了 Pexels Key 即默认搜图上传；仅 SYNTHETIC_FETCH_IMAGES=0|false 时关闭 */
  const fetchImages = Boolean(pexelsKey) && !fetchExplicitOff;

  if (!pexelsKey) {
    console.warn(
      "[synthetic-it] 未配置 SYNTHETIC_PEXELS_API_KEY：将使用占位路径 /uploads/synthetic/{key}-{idx}.webp（磁盘上通常不存在，配图可能 404）。配置 Key 后重新运行即可自动搜图并写入 uploads。",
    );
  }

  const commentDone = await loadCommentManifest();
  /** 跨分类、整场 `db:init-post` 会话内尽量不重复选用同一 Pexels 资源 id */
  const usedPexelsPhotoIds = new Set<number>();

  const tree = await apiSuccessJson("GET", apiBase, token, "/categories");
  const categories = tree.categories as unknown[];

  let postsProcessed = 0;
  let postsSkippedComments = 0;
  let commentsWritten = 0;

  if (useStatic) {
    for (const bundle of SYNTHETIC_IT_STATIC_BUNDLES) {
      const r = await injectBundlePosts(
        apiBase,
        token,
        categories,
        bundle,
        bundle.posts,
        commentDone,
        rateMs,
        fetchImages,
        pexelsKey,
        usedPexelsPhotoIds,
      );
      postsProcessed += r.postsProcessed;
      postsSkippedComments += r.postsSkippedComments;
      commentsWritten += r.commentsWritten;
    }
  } else {
    const baseUrl = process.env.SYNTHETIC_LLM_BASE_URL ?? "https://api.openai.com/v1";
    const model = process.env.SYNTHETIC_LLM_MODEL ?? "gpt-4o-mini";
    const useJsonObjectMode = process.env.SYNTHETIC_LLM_JSON_OBJECT !== "0";
    const maxTokens = Number(process.env.SYNTHETIC_LLM_MAX_TOKENS ?? "4096");

    for (const outline of SYNTHETIC_IT_OUTLINES) {
      const bundle = { categoryName: outline.categoryName, keyPrefix: outline.keyPrefix };
      const posts: PostPayload[] = [];

      for (let idx = 0; idx < outline.topics.length; idx++) {
        const topic = outline.topics[idx];
        console.log(`  [LLM] 生成「${outline.categoryName}」${outline.keyPrefix}-${idx} …`);
        const gen = await generateTechPost({
          baseUrl,
          apiKey: llmKey,
          model,
          categoryName: outline.categoryName,
          topicHint: topic,
          useJsonObjectMode,
          maxTokens,
        });
        posts.push({
          title: gen.title,
          html: gen.html,
          comments: gen.comments,
          imageSearchQuery: gen.imageSearchQuery,
        });
        await sleep(rateMs);
      }

      const r = await injectBundlePosts(
        apiBase,
        token,
        categories,
        bundle,
        posts,
        commentDone,
        rateMs,
        fetchImages,
        pexelsKey,
        usedPexelsPhotoIds,
      );
      postsProcessed += r.postsProcessed;
      postsSkippedComments += r.postsSkippedComments;
      commentsWritten += r.commentsWritten;
    }
  }

  console.log(
    `\n完成：帖子 POST ${postsProcessed} 次（幂等键 ${SYNTHETIC_IT_EXTERNAL_SOURCE}）；跳过评论 ${postsSkippedComments} 帖；本次新增评论条数 ${commentsWritten}（含回复）。Manifest: ${MANIFEST_PATH}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
