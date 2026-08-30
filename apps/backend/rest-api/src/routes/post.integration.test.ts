/**
 * 文章链路集成测试。
 *
 * 重点覆盖「授权判定」而不只是 CRUD：
 * canUpdatePost / canDeletePost 把「作者本人 or 后台权限」的判断放在 service 层，
 * 这类跨越 认证中间件 → 控制器 → service → RBAC 缓存 的逻辑，正是单测无法验证、
 * 一旦回归又会直接造成越权的部分。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  dropTestDatabase,
  prepareTestEnv,
  recreateTestDatabase,
  registerAndLogin,
  startTestApi,
  type TestApi,
} from "../test/integration-harness.js";

const DB_NAME = "evm_it_post";

let api: TestApi;
let authorToken: string;
let strangerToken: string;
let leafCategoryId: number;

/**
 * 准备「一级分类 → 叶子分类」。文章只能挂在叶子分类下。
 * 一级分类没有对应的 REST 接口（`POST /api/categories` 的 parentId 必填，只建叶子），
 * 它属于运维种子数据，因此这里直接用模型准备；叶子分类仍走接口，以覆盖权限校验路径。
 */
async function createCategoryTree(adminToken: string): Promise<number> {
  const root = await api.models.Category.create({
    name: "集成测试一级分类",
    parentId: null,
    sortOrder: 0,
  });
  const rootId = root.id;

  const leaf = await api.request<{ category: { id: number } }>("POST", "/api/categories", {
    token: adminToken,
    body: { name: "集成测试叶子分类", parentId: rootId },
  });
  if (leaf.status !== 200) {
    throw new Error(`创建叶子分类失败(${String(leaf.status)}): ${leaf.body.msg ?? ""}`);
  }
  return leaf.body.category.id;
}

/** 用 bootstrap 出来的 super_admin 登录（凭据来自 ADMIN_BOOTSTRAP_* 环境变量） */
async function loginBootstrapAdmin(): Promise<string> {
  const username = process.env.ADMIN_BOOTSTRAP_USERNAME;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!username || !password) {
    throw new Error("集成测试需要 ADMIN_BOOTSTRAP_USERNAME / ADMIN_BOOTSTRAP_PASSWORD");
  }
  const res = await api.request<{ token: string }>("POST", "/api/login", {
    body: { username, password },
  });
  if (res.status !== 200) {
    throw new Error(`超级管理员登录失败(${String(res.status)}): ${res.body.msg ?? ""}`);
  }
  return res.body.token;
}

async function createPost(token: string, title: string): Promise<number> {
  const res = await api.request<{ post: { id: number } }>("POST", "/api/posts", {
    token,
    body: { title, content: "<p>集成测试正文</p>", categoryId: leafCategoryId, published: true },
  });
  if (res.status !== 200) {
    throw new Error(`创建文章失败(${String(res.status)}): ${res.body.msg ?? ""}`);
  }
  return res.body.post.id;
}

beforeAll(async () => {
  prepareTestEnv(DB_NAME);
  await recreateTestDatabase(DB_NAME);
  api = await startTestApi();

  const adminToken = await loginBootstrapAdmin();
  leafCategoryId = await createCategoryTree(adminToken);

  authorToken = (await registerAndLogin(api, "it_post_author")).token;
  strangerToken = (await registerAndLogin(api, "it_post_stranger")).token;
});

afterAll(async () => {
  await api.close();
  await dropTestDatabase(DB_NAME);
});

describe("文章读写", () => {
  it("创建后可在公开列表与详情中读到", async () => {
    const postId = await createPost(authorToken, "集成测试文章A");

    const detail = await api.request<{ post: { id: number; title: string } }>(
      "GET",
      `/api/posts/${String(postId)}`,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.post.title).toBe("集成测试文章A");

    const list = await api.request<{ posts: { id: number }[] }>(
      "GET",
      "/api/posts?page=1&limit=50",
    );
    expect(list.status).toBe(200);
    expect(list.body.posts.some((p) => p.id === postId)).toBe(true);
  });

  it("不存在的文章返回 404", async () => {
    const res = await api.request("GET", "/api/posts/99999999");
    expect(res.status).toBe(404);
  });

  it("非法 id 被 Zod 拦截为 400", async () => {
    const res = await api.request("GET", "/api/posts/abc");
    expect(res.status).toBe(400);
  });

  it("作者本人可以更新自己的文章", async () => {
    const postId = await createPost(authorToken, "集成测试文章B");
    const res = await api.request("PUT", `/api/posts/${String(postId)}`, {
      token: authorToken,
      body: { title: "集成测试文章B-已改" },
    });
    expect(res.status).toBe(200);
  });
});

describe("越权防护", () => {
  it("他人不能修改我的文章", async () => {
    const postId = await createPost(authorToken, "集成测试文章C");
    const res = await api.request("PUT", `/api/posts/${String(postId)}`, {
      token: strangerToken,
      body: { title: "被别人改掉了" },
    });
    expect(res.status).toBe(403);
  });

  it("他人不能删除我的文章", async () => {
    const postId = await createPost(authorToken, "集成测试文章D");
    const res = await api.request("DELETE", `/api/posts/${String(postId)}`, {
      token: strangerToken,
    });
    expect(res.status).toBe(403);

    // 确认确实没被删掉
    const stillThere = await api.request("GET", `/api/posts/${String(postId)}`);
    expect(stillThere.status).toBe(200);
  });

  it("普通用户不能创建分类（缺少 admin.categories.write）", async () => {
    const res = await api.request("POST", "/api/categories", {
      token: strangerToken,
      body: { name: "普通用户不该建出来的分类" },
    });
    expect(res.status).toBe(403);
  });

  it("未登录不能创建文章", async () => {
    const res = await api.request("POST", "/api/posts", {
      body: { title: "匿名投稿", content: "x", categoryId: leafCategoryId },
    });
    expect(res.status).toBe(401);
  });
});

describe("互动计数", () => {
  it("点赞与收藏会真实落库并反映在详情里", async () => {
    const postId = await createPost(authorToken, "集成测试文章E");

    const voted = await api.request<{ post: { likeCount: number } }>(
      "PUT",
      `/api/posts/${String(postId)}/vote`,
      { token: strangerToken, body: { vote: "like" } },
    );
    expect(voted.status).toBe(200);
    expect(voted.body.post.likeCount).toBe(1);

    const favorited = await api.request<{ post: { favoriteCount: number } }>(
      "PUT",
      `/api/posts/${String(postId)}/favorite`,
      { token: strangerToken, body: { favorited: true } },
    );
    expect(favorited.status).toBe(200);
    expect(favorited.body.post.favoriteCount).toBe(1);

    const favorites = await api.request<{ posts: { id: number }[] }>(
      "GET",
      "/api/posts/favorites?page=1&limit=50",
      { token: strangerToken },
    );
    expect(favorites.body.posts.some((p) => p.id === postId)).toBe(true);
  });

  it("重复点赞不会把计数叠加成 2", async () => {
    const postId = await createPost(authorToken, "集成测试文章F");
    await api.request("PUT", `/api/posts/${String(postId)}/vote`, {
      token: strangerToken,
      body: { vote: "like" },
    });
    const second = await api.request<{ post: { likeCount: number } }>(
      "PUT",
      `/api/posts/${String(postId)}/vote`,
      { token: strangerToken, body: { vote: "like" } },
    );
    expect(second.body.post.likeCount).toBe(1);
  });
});
