import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ESLint 的类型程序解析不了 .vue SFC 的具体类型（只有 vue-tsc 能），与 main.ts 一致显式标注

import * as categoriesApi from "@/api/categories";
import * as portalUsersApi from "@/api/portalUsers";
import * as postsApi from "@/api/posts";
import * as userApi from "@/api/user";
import { mountApp, profileFor, type TestUser } from "@/test/app-harness";
import { button, hasButton } from "@/test/dom";
import { confirmSpy, messageSpies, rejectNextConfirm } from "@/test/element-plus-services";
import { CATEGORY_TREE, makeAdminPost, makeAdminPostsResult } from "@/test/fixtures";

import PostsView from "./PostsView.vue";

import type { Component } from "vue";

/**
 * PostsView 的行为基线（写在拆分之前，拆分后不得修改）。
 *
 * 管理端这张表的每个操作都挂着权限码，权限判断一旦在拆分中走样，
 * 后果是越权而不是错版，所以权限分支覆盖得比渲染更细。
 */

vi.mock("@/api/categories", () => ({ fetchCategories: vi.fn() }));
vi.mock("@/api/portalUsers", () => ({
  fetchPortalUsers: vi.fn(),
  patchPortalUser: vi.fn(),
  deletePortalUser: vi.fn(),
}));
vi.mock("@/api/posts", () => ({
  fetchAdminPostsList: vi.fn(),
  fetchAdminPost: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn(),
  createPost: vi.fn(),
}));
vi.mock("@/api/user", () => ({ fetchCurrentUser: vi.fn() }));

/** 全权限管理员 */
const ADMIN: TestUser = {
  id: 1,
  username: "admin",
  permissions: [
    "admin.posts.write",
    "admin.posts.delete",
    "admin.comments.read",
    "admin.portal_users.read",
  ],
};
/** 无任何 admin 写权限的编辑，只能动自己的文章 */
const EDITOR: TestUser = { id: 7, username: "editor", permissions: [] };

const OWN_POST = makeAdminPost({ id: 1, title: "编辑自己的文章", authorId: 7 });
const OTHERS_POST = makeAdminPost({
  id: 2,
  title: "别人的文章",
  authorId: 99,
  author: { id: 99, username: "someone-else" },
  category: { id: 5, name: "随笔" },
});

let signedIn: TestUser | null = null;

async function mountPosts(user: TestUser) {
  signedIn = user;
  return mountApp(PostsView as Component, { path: "/posts", routeName: "posts", user });
}

beforeEach(() => {
  signedIn = null;
  vi.mocked(categoriesApi.fetchCategories).mockResolvedValue({ categories: CATEGORY_TREE });
  vi.mocked(postsApi.fetchAdminPostsList).mockResolvedValue(
    makeAdminPostsResult([OWN_POST, OTHERS_POST]),
  );
  vi.mocked(postsApi.fetchAdminPost).mockResolvedValue({ post: OWN_POST });
  vi.mocked(postsApi.updatePost).mockResolvedValue({ post: OWN_POST });
  vi.mocked(postsApi.deletePost).mockResolvedValue(undefined);
  vi.mocked(portalUsersApi.fetchPortalUsers).mockResolvedValue({
    users: [profileFor({ id: 99, username: "someone-else" })],
    pagination: { page: 1, limit: 40, total: 1, totalPages: 1, hasNext: false },
  });
  vi.mocked(userApi.fetchCurrentUser).mockImplementation(() =>
    signedIn
      ? Promise.resolve({ user: profileFor(signedIn) })
      : Promise.reject(new Error("未登录")),
  );
});

describe("PostsView / 列表加载", () => {
  it("首屏同时拉分类树与文章列表", async () => {
    await mountPosts(ADMIN);

    expect(categoriesApi.fetchCategories).toHaveBeenCalled();
    expect(postsApi.fetchAdminPostsList).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });

  it("渲染每行的 ID、标题、分类名与作者名", async () => {
    const { wrapper } = await mountPosts(ADMIN);

    const rows = wrapper.findAll(".el-table__body .el-table__row");
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain("编辑自己的文章");
    expect(rows[0].text()).toContain("前端工程");
    expect(rows[0].text()).toContain("author-one");
    expect(rows[1].text()).toContain("别人的文章");
    expect(rows[1].text()).toContain("someone-else");
  });

  it("接口失败时不抛异常，页面仍可用", async () => {
    vi.mocked(postsApi.fetchAdminPostsList).mockRejectedValue(new Error("服务不可用"));
    const { wrapper } = await mountPosts(ADMIN);

    expect(wrapper.findAll(".el-table__body .el-table__row")).toHaveLength(0);
    expect(wrapper.find(".toolbar").exists()).toBe(true);
  });

  it("叶子分类下拉以「父 / 子」呈现，且不含一级分类", async () => {
    const { wrapper } = await mountPosts(ADMIN);

    const selects = wrapper.findAll(".toolbar .el-select");
    await selects[1].find(".el-select__wrapper").trigger("click");
    await flushPromises();

    // 页面上有多个 el-select，浮层都挂在 body 下，按内容锁定「叶子分类」那一个
    const dropdown = Array.from(document.querySelectorAll(".el-select-dropdown")).find((d) =>
      d.textContent?.includes("技术 / 前端工程"),
    );
    const texts = Array.from(dropdown?.querySelectorAll(".el-select-dropdown__item") ?? []).map(
      (el) => el.textContent?.trim(),
    );
    expect(texts).toEqual(["技术 / 前端工程", "技术 / 后端服务", "生活 / 随笔"]);
  });
});

describe("PostsView / 筛选", () => {
  it("关键词去空白后作为 q 参数提交", async () => {
    const { wrapper } = await mountPosts(ADMIN);

    await wrapper.find(".toolbar input").setValue("  组件拆分  ");
    await wrapper.find(".toolbar").trigger("submit");
    await flushPromises();

    expect(postsApi.fetchAdminPostsList).toHaveBeenLastCalledWith({
      page: 1,
      limit: 10,
      q: "组件拆分",
    });
  });

  it("关键词为空白时不带 q 参数", async () => {
    const { wrapper } = await mountPosts(ADMIN);

    await wrapper.find(".toolbar input").setValue("   ");
    await wrapper.find(".toolbar").trigger("submit");
    await flushPromises();

    expect(postsApi.fetchAdminPostsList).toHaveBeenLastCalledWith({ page: 1, limit: 10 });
  });

  it("有 admin.portal_users.read 权限才显示作者筛选", async () => {
    const admin = await mountPosts(ADMIN);
    expect(admin.wrapper.findAll(".toolbar .el-form-item").length).toBe(5);
    expect(admin.wrapper.find(".toolbar").text()).toContain("作者");

    const editor = await mountPosts(EDITOR);
    expect(editor.wrapper.find(".toolbar").text()).not.toContain("作者");
  });
});

describe("PostsView / 编辑权限", () => {
  it("有写权限时任意文章都可编辑", async () => {
    const { wrapper } = await mountPosts(ADMIN);

    const rows = wrapper.findAll(".el-table__body .el-table__row");
    for (const r of rows) {
      const edit = r.findAll("button").find((b) => b.text() === "编辑");
      expect(edit?.attributes("disabled")).toBeUndefined();
    }
  });

  it("无写权限时只能编辑自己的文章", async () => {
    const { wrapper } = await mountPosts(EDITOR);

    const rows = wrapper.findAll(".el-table__body .el-table__row");
    const own = rows[0].findAll("button").find((b) => b.text() === "编辑");
    const others = rows[1].findAll("button").find((b) => b.text() === "编辑");

    expect(own?.attributes("disabled")).toBeUndefined();
    expect(others?.attributes("disabled")).toBeDefined();
  });

  it("打开编辑对话框会重新拉取单篇详情并回填表单", async () => {
    const { wrapper } = await mountPosts(ADMIN);

    const edit = wrapper
      .findAll(".el-table__body .el-table__row")[0]
      .findAll("button")
      .find((b) => b.text() === "编辑");
    await edit?.trigger("click");
    await flushPromises();

    expect(postsApi.fetchAdminPost).toHaveBeenCalledWith(1);
    expect(wrapper.find(".el-dialog__title").text()).toBe("编辑帖子");
    const titleInput = wrapper.find(".el-dialog .el-input__inner").element as HTMLInputElement;
    expect(titleInput.value).toBe("编辑自己的文章");
    const contentInput = wrapper.find(".el-dialog .el-textarea__inner")
      .element as HTMLTextAreaElement;
    expect(contentInput.value).toBe("<p>正文</p>");
  });

  it("保存后调用更新接口、关闭对话框并刷新列表", async () => {
    const { wrapper } = await mountPosts(ADMIN);

    const edit = wrapper
      .findAll(".el-table__body .el-table__row")[0]
      .findAll("button")
      .find((b) => b.text() === "编辑");
    await edit?.trigger("click");
    await flushPromises();

    await button(wrapper.find(".el-dialog"), "保存").trigger("click");
    await flushPromises();

    expect(postsApi.updatePost).toHaveBeenCalledWith(1, {
      title: "编辑自己的文章",
      content: "<p>正文</p>",
      categoryId: 3,
      published: true,
    });
    expect(messageSpies.success).toHaveBeenCalledWith("已保存");
    // 首屏一次 + 保存后一次
    expect(vi.mocked(postsApi.fetchAdminPostsList).mock.calls.length).toBe(2);
  });
});

describe("PostsView / 删除权限", () => {
  it("有删除权限时任意文章都可删除", async () => {
    const { wrapper } = await mountPosts(ADMIN);

    const others = wrapper
      .findAll(".el-table__body .el-table__row")[1]
      .findAll("button")
      .find((b) => b.text() === "删除");
    expect(others?.attributes("disabled")).toBeUndefined();
  });

  it("无删除权限时只能删自己的文章", async () => {
    const { wrapper } = await mountPosts(EDITOR);

    const rows = wrapper.findAll(".el-table__body .el-table__row");
    expect(
      rows[0]
        .findAll("button")
        .find((b) => b.text() === "删除")
        ?.attributes("disabled"),
    ).toBeUndefined();
    expect(
      rows[1]
        .findAll("button")
        .find((b) => b.text() === "删除")
        ?.attributes("disabled"),
    ).toBeDefined();
  });

  it("删除需二次确认，确认后调用接口并刷新", async () => {
    const { wrapper } = await mountPosts(ADMIN);

    const del = wrapper
      .findAll(".el-table__body .el-table__row")[0]
      .findAll("button")
      .find((b) => b.text() === "删除");
    await del?.trigger("click");
    await flushPromises();

    expect(confirmSpy).toHaveBeenCalled();
    expect(postsApi.deletePost).toHaveBeenCalledWith(1);
    expect(vi.mocked(postsApi.fetchAdminPostsList).mock.calls.length).toBe(2);
  });

  it("取消确认时不删除", async () => {
    rejectNextConfirm();
    const { wrapper } = await mountPosts(ADMIN);

    const del = wrapper
      .findAll(".el-table__body .el-table__row")[0]
      .findAll("button")
      .find((b) => b.text() === "删除");
    await del?.trigger("click").catch(() => undefined);
    await flushPromises();

    expect(postsApi.deletePost).not.toHaveBeenCalled();
  });
});

describe("PostsView / 评论入口", () => {
  it("有 admin.comments.read 权限才显示「管理评论」", async () => {
    const admin = await mountPosts(ADMIN);
    expect(hasButton(admin.wrapper, "管理评论")).toBe(true);

    const editor = await mountPosts(EDITOR);
    expect(hasButton(editor.wrapper, "管理评论")).toBe(false);
  });

  it("点击「管理评论」带上 postId 跳转评论页", async () => {
    const { wrapper, router } = await mountPosts(ADMIN);

    await button(wrapper.findAll(".el-table__body .el-table__row")[0] as never, "管理评论").trigger(
      "click",
    );
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/comments");
    expect(router.currentRoute.value.query.postId).toBe("1");
  });
});

describe("PostsView / 快速切换发布状态", () => {
  it("切换开关即提交新的发布状态并刷新列表", async () => {
    const { wrapper } = await mountPosts(ADMIN);

    const sw = wrapper.findAll(".el-table__body .el-table__row")[0].find(".el-switch");
    await sw.trigger("click");
    await flushPromises();

    expect(postsApi.updatePost).toHaveBeenCalledWith(1, { published: false });
    expect(messageSpies.success).toHaveBeenCalledWith("已更新发布状态");
    expect(vi.mocked(postsApi.fetchAdminPostsList).mock.calls.length).toBe(2);
  });

  it("切换失败也要刷新列表，让开关回到服务端真实状态", async () => {
    vi.mocked(postsApi.updatePost).mockRejectedValue(new Error("服务不可用"));
    const { wrapper } = await mountPosts(ADMIN);

    const sw = wrapper.findAll(".el-table__body .el-table__row")[0].find(".el-switch");
    await sw.trigger("click");
    await flushPromises();

    expect(vi.mocked(postsApi.fetchAdminPostsList).mock.calls.length).toBe(2);
  });

  it("无权限的行开关处于禁用态", async () => {
    const { wrapper } = await mountPosts(EDITOR);

    const rows = wrapper.findAll(".el-table__body .el-table__row");
    expect(rows[0].find(".el-switch").classes()).not.toContain("is-disabled");
    expect(rows[1].find(".el-switch").classes()).toContain("is-disabled");
  });
});
