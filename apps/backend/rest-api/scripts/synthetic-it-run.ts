/**
 * 合成 IT 帖子灌入（HTTP）。
 *
 * **执行**：`pnpm db:seed-post`（仓库根或 `apps/backend/rest-api`）。
 * **前提**：API 已启动；类目已由 `pnpm db:seed-categories` 写入（见 `it-category-seed.json`）。
 *
 * 链路（package 脚本串联）：`dedupe-mysql-redundant-indexes` → `synthetic-it-clear-posts` → **本脚本**。
 *
 * 帖子形态（与 rest-api 一致）：
 * - 无 `images[]` 字段；配图须嵌入正文 HTML 的 `<img src="/uploads/...">`
 * - 入库前经 `content-safety.ts` 白名单净化；本脚本 POST 前做同等预检
 * - 封面优先 Pexels 拉图并 `POST /api/uploads`；失败则复用本分类上一张成功图或上传内置占位 PNG
 *
 * 环境变量见 `synthetic-it.env` 与下方注释。
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { apiSuccessJson } from "./synthetic-it-api-client.js";
import {
  SYNTHETIC_IT_EXTERNAL_SOURCE,
  SYNTHETIC_IT_MANIFEST_RELATIVE,
} from "./synthetic-it-constants.js";
import {
  SYNTHETIC_HTML_MIN_LEN,
  SYNTHETIC_POSTS_PER_CATEGORY_MAX,
  SYNTHETIC_POSTS_PER_CATEGORY_MIN,
  htmlPlainExcerpt,
  prepareSyntheticPostForApi,
} from "./synthetic-it-constraints.js";
import { SYNTHETIC_IT_STATIC_BUNDLES } from "./synthetic-it-data-static.js";
import { SYNTHETIC_IT_OUTLINES } from "./synthetic-it-data.js";
import { fetchPexelsPhotoAndUpload } from "./synthetic-it-image-fetch.js";
import { generateTechPost } from "./synthetic-it-llm.js";
import {
  embedCoverImageInHtml,
  isPostUploadPublicUrl,
  uploadSeedPlaceholderImage,
} from "./synthetic-it-media.js";
import { mergeDotenvFromMonorepoRoot } from "./synthetic-it-merge-monorepo-dotenv.js";
import { resolveAdminImportToken } from "./synthetic-it-resolve-import-token.js";

import type { SyntheticBundle } from "./synthetic-it-data-static.js";

mergeDotenvFromMonorepoRoot();

const MANIFEST_PATH = path.resolve(process.cwd(), SYNTHETIC_IT_MANIFEST_RELATIVE);

type CommentManifest = {
  postsWithComments: string[];
};

type PostPayload = SyntheticBundle["posts"][number];

type CategoryTreeRoot = {
  id: number;
  name: string;
  children?: { id: number; name: string }[];
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function postDedupeKey(categoryName: string, externalKey: string) {
  return `${SYNTHETIC_IT_EXTERNAL_SOURCE}|${categoryName}|${externalKey}`;
}

function resolveLeafCategoryId(categories: unknown[], leafName: string): number {
  const roots = categories as CategoryTreeRoot[];
  const it = roots.find((r) => r.name === "IT技术");
  if (!it?.children?.length) {
    throw new Error(
      "分类树中未找到「IT技术」或其子节点。请先执行 `pnpm db:seed-categories`（或确保库内已有与 synthetic-it 数据一致的类目）。",
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

async function resolveCoverUrl(opts: {
  apiBase: string;
  token: string;
  post: PostPayload;
  bundle: { categoryName: string; keyPrefix: string };
  idx: number;
  fetchImages: boolean;
  pexelsKey: string;
  usedPexelsPhotoIds: Set<number>;
  reuseLastCoverOnMiss: boolean;
  reuseCoverUrl: string | null;
}): Promise<string> {
  const { apiBase, token, post, bundle, idx, fetchImages, pexelsKey, usedPexelsPhotoIds } = opts;
  const label = `${bundle.keyPrefix}-${idx}`;

  if (fetchImages && pexelsKey) {
    const query =
      typeof post.imageSearchQuery === "string" && post.imageSearchQuery.trim().length > 0
        ? post.imageSearchQuery.trim()
        : `${bundle.categoryName} technology ${htmlPlainExcerpt(post.html, 160)}`;
    const selectionSalt = `${SYNTHETIC_IT_EXTERNAL_SOURCE}|${bundle.categoryName}|${label}`;
    const uploaded = await fetchPexelsPhotoAndUpload({
      apiBase,
      restToken: token,
      pexelsApiKey: pexelsKey,
      query,
      refineHint: "developer",
      fallbackQueries: [
        `${bundle.categoryName} programming`,
        "software developer laptop",
        "technology workspace",
        "coding computer",
      ],
      avoidPexelsPhotoIds: usedPexelsPhotoIds,
      selectionSalt,
    });
    if (uploaded && isPostUploadPublicUrl(uploaded.uploadUrl)) {
      usedPexelsPhotoIds.add(uploaded.pexelsPhotoId);
      return uploaded.uploadUrl;
    }
  }

  const reuse = opts.reuseCoverUrl?.trim() ?? "";
  if (opts.reuseLastCoverOnMiss && reuse && isPostUploadPublicUrl(reuse)) {
    console.warn(`  [cover] ${label} 未拉到新图，复用本分类上一张本站封面`);
    return reuse;
  }

  console.warn(`  [cover] ${label} 上传内置占位 PNG 至 /uploads/posts/…`);
  return uploadSeedPlaceholderImage(apiBase, token, `${bundle.categoryName}-${label}`);
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
    usedPexelsPhotoIds: Set<number>;
    reuseLastCoverOnMiss: boolean;
    reuseCoverUrl: string | null;
  },
): Promise<{ title: string; html: string; coverUrl: string }> {
  const title = post.title.trim();
  let html = post.html.trim();

  const coverUrl = await resolveCoverUrl({
    apiBase: ctx.apiBase,
    token: ctx.token,
    post,
    bundle,
    idx,
    fetchImages: ctx.fetchImages,
    pexelsKey: ctx.pexelsKey,
    usedPexelsPhotoIds: ctx.usedPexelsPhotoIds,
    reuseLastCoverOnMiss: ctx.reuseLastCoverOnMiss,
    reuseCoverUrl: ctx.reuseCoverUrl,
  });
  await sleep(ctx.rateMs);

  html = embedCoverImageInHtml(html, coverUrl, title);

  const filler = `<p>工程细节请以官方文档与团队约定为准；以上为提纲式说明。</p>`;
  while (html.trim().length < SYNTHETIC_HTML_MIN_LEN) {
    html = `${html}\n${filler}`;
  }

  const prepared = prepareSyntheticPostForApi(title, html);
  return { ...prepared, coverUrl };
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
    if (prime && isPostUploadPublicUrl(prime.uploadUrl)) {
      usedPexelsPhotoIds.add(prime.pexelsPhotoId);
      reuseCoverUrl = prime.uploadUrl;
      console.log(`  [pexels] 本分类预热封面已写入 uploads/posts`);
    }
    await sleep(rateMs);
  }

  for (let idx = 0; idx < posts.length; idx++) {
    const post = posts[idx];
    const externalKey = `${bundle.keyPrefix}-${idx}`;
    const dedupeKey = postDedupeKey(bundle.categoryName, externalKey);

    let payload: { title: string; html: string; coverUrl: string };
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
      categoryId,
      externalSource: SYNTHETIC_IT_EXTERNAL_SOURCE,
      externalKey,
    });
    await sleep(rateMs);

    const postPayload = created.post as { id: number };
    const postId = postPayload.id;
    postsProcessed += 1;
    console.log(`  帖子 ${externalKey} -> postId=${postId}`);

    if (isPostUploadPublicUrl(payload.coverUrl)) {
      reuseCoverUrl = payload.coverUrl;
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

  const fetchImages = Boolean(pexelsKey) && !fetchExplicitOff;

  if (!pexelsKey) {
    console.warn(
      "[synthetic-it] 未配置 SYNTHETIC_PEXELS_API_KEY：跳过 Pexels 拉图，封面将通过 POST /api/uploads 写入占位 PNG（真实 /uploads/posts/… 路径）。",
    );
  }

  const commentDone = await loadCommentManifest();
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
