/**
 * 不向第三方站点抓取：按「IT技术」种子下的叶子分类注入合成技术短文与评论。
 * 默认调用 OpenAI 兼容 Chat Completions，按 data.ts 中的提纲生成正文与评论；也可改用内置静态正文。
 * 需管理员 JWT：`externalSource` + `externalKey` 发帖幂等；评论注入完成后写入本地 manifest，重复执行不会重复发评论。
 *
 * 环境变量：
 * - REST_API_BASE（默认 http://127.0.0.1:3000/api）
 * - REST_API_IMPORT_TOKEN（管理员 Bearer JWT）
 * - SYNTHETIC_RATE_MS（默认 120）
 * - SYNTHETIC_USE_STATIC_BUNDLE=1：跳过 LLM，使用 data-static.ts 内置正文
 * - SYNTHETIC_LLM_API_KEY：非静态模式必填
 * - SYNTHETIC_LLM_BASE_URL（默认 https://api.openai.com/v1）
 * - SYNTHETIC_LLM_MODEL（默认 gpt-4o-mini）
 * - SYNTHETIC_LLM_JSON_OBJECT=0：禁用 response_format json_object（兼容不支持该参数的网关）
 * - SYNTHETIC_LLM_MAX_TOKENS（默认 4096）
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { SYNTHETIC_IT_STATIC_BUNDLES } from "./data-static.js";
import { SYNTHETIC_IT_OUTLINES } from "./data.js";
import { generateTechPost } from "./llm.js";

import type { SyntheticBundle } from "./data-static.js";

const UA = "Mozilla/5.0 (compatible; synthetic-it-posts/1.0)";

const MANIFEST_PATH = path.resolve(
  process.cwd(),
  "scripts/synthetic-it-posts/applied-comments.json",
);

type CommentManifest = {
  /** 已成功写入完整评论集合的帖子键（与 REST 幂等键一致） */
  postsWithComments: string[];
};

type PostPayload = SyntheticBundle["posts"][number];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiSuccessJson(
  method: string,
  apiBase: string,
  token: string,
  pathname: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const url = `${apiBase.replace(/\/$/, "")}${pathname}`;
  const headers: Record<string, string> = {
    "User-Agent": UA,
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || j.code !== 200) {
    throw new Error(`${method} ${url} failed: HTTP ${res.status} ${JSON.stringify(j)}`);
  }
  return j;
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
    throw new Error("分类树中未找到「IT技术」或其子节点，请先启动 API 完成默认种子");
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
  return `synthetic-it|${categoryName}|${externalKey}`;
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
): Promise<{ postsProcessed: number; postsSkippedComments: number; commentsWritten: number }> {
  let postsProcessed = 0;
  let postsSkippedComments = 0;
  let commentsWritten = 0;

  const categoryId = resolveLeafCategoryId(categories, bundle.categoryName);
  console.log(`\n分类「${bundle.categoryName}」 -> categoryId=${categoryId}`);

  for (let idx = 0; idx < posts.length; idx++) {
    const post = posts[idx];
    const externalKey = `${bundle.keyPrefix}-${idx}`;
    const dedupeKey = postDedupeKey(bundle.categoryName, externalKey);

    const created = await apiSuccessJson("POST", apiBase, token, "/posts", {
      title: post.title.trim(),
      content: post.html.trim(),
      published: true,
      images: [],
      categoryId,
      externalSource: "synthetic-it",
      externalKey,
    });
    await sleep(rateMs);

    const postPayload = created.post as { id: number };
    const postId = postPayload.id;
    postsProcessed += 1;
    console.log(`  帖子 ${externalKey} -> postId=${postId}`);

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
  const apiBase = process.env.REST_API_BASE ?? "http://127.0.0.1:3000/api";
  const token = process.env.REST_API_IMPORT_TOKEN ?? "";
  if (!token) {
    console.error("请设置 REST_API_IMPORT_TOKEN（须为管理员，以便使用 externalSource 发帖幂等）");
    process.exit(1);
  }

  const rateMs = Number(process.env.SYNTHETIC_RATE_MS ?? "120");
  const useStatic =
    process.env.SYNTHETIC_USE_STATIC_BUNDLE === "1" ||
    process.env.SYNTHETIC_USE_STATIC_BUNDLE?.toLowerCase() === "true";

  const commentDone = await loadCommentManifest();

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
      );
      postsProcessed += r.postsProcessed;
      postsSkippedComments += r.postsSkippedComments;
      commentsWritten += r.commentsWritten;
    }
  } else {
    const apiKey = process.env.SYNTHETIC_LLM_API_KEY ?? "";
    const baseUrl = process.env.SYNTHETIC_LLM_BASE_URL ?? "https://api.openai.com/v1";
    const model = process.env.SYNTHETIC_LLM_MODEL ?? "gpt-4o-mini";
    const useJsonObjectMode = process.env.SYNTHETIC_LLM_JSON_OBJECT !== "0";
    const maxTokens = Number(process.env.SYNTHETIC_LLM_MAX_TOKENS ?? "4096");

    if (!apiKey) {
      console.error(
        "请设置 SYNTHETIC_LLM_API_KEY，或设置 SYNTHETIC_USE_STATIC_BUNDLE=1 使用内置静态正文",
      );
      process.exit(1);
    }

    for (const outline of SYNTHETIC_IT_OUTLINES) {
      const bundle = { categoryName: outline.categoryName, keyPrefix: outline.keyPrefix };
      const posts: PostPayload[] = [];

      for (let idx = 0; idx < outline.topics.length; idx++) {
        const topic = outline.topics[idx];
        console.log(`  [LLM] 生成「${outline.categoryName}」${outline.keyPrefix}-${idx} …`);
        const gen = await generateTechPost({
          baseUrl,
          apiKey,
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
      );
      postsProcessed += r.postsProcessed;
      postsSkippedComments += r.postsSkippedComments;
      commentsWritten += r.commentsWritten;
    }
  }

  console.log(
    `\n完成：帖子 POST ${postsProcessed} 次（幂等键 synthetic-it）；跳过评论 ${postsSkippedComments} 帖；本次新增评论条数 ${commentsWritten}（含回复）。Manifest: ${MANIFEST_PATH}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
