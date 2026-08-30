import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ESLint 的类型程序解析不了 .vue SFC 的具体类型（只有 vue-tsc 能），与 main.ts 一致显式标注

import * as categoriesApi from "@/api/categories";
import * as postsApi from "@/api/posts";
import type { CategoryTreeNode } from "@/api/types";
import * as uploadsApi from "@/api/uploads";
import { mountApp, type TestUser } from "@/test/app-harness";
import { button, hasButton } from "@/test/dom";
import { confirmSpy, messageSpies, rejectNextConfirm } from "@/test/element-plus-services";
import { makePost } from "@/test/fixtures";
import { draftStorageKey } from "@/utils/postEditorDraft";

import PostEditorView from "./PostEditorView.vue";

import type { Component } from "vue";

/**
 * PostEditorView 的行为基线（写在拆分之前，拆分后不得修改）。
 *
 * 只挡网络与富文本编辑器；草稿的 localStorage 读写、封面合并、正文空判断
 * 都跑真实实现——它们正是编辑器最容易在重构中被改坏的地方。
 */

vi.mock("@/api/categories", () => ({ fetchCategories: vi.fn() }));

vi.mock("@/api/posts", () => ({
  fetchPostForEditor: vi.fn(),
  createPost: vi.fn(),
  updatePost: vi.fn(),
}));

vi.mock("@/api/uploads", () => ({
  uploadImages: vi.fn(),
  uploadProfileImages: vi.fn(),
}));

const AUTHOR: TestUser = { id: 7, username: "author-one" };

const CATEGORY_TREE: CategoryTreeNode[] = [
  {
    id: 1,
    name: "技术",
    parentId: null,
    sortOrder: 1,
    children: [
      { id: 3, name: "前端工程", parentId: 1, sortOrder: 1 },
      { id: 4, name: "后端服务", parentId: 1, sortOrder: 2 },
    ],
  },
  {
    id: 2,
    name: "生活",
    parentId: null,
    sortOrder: 2,
    children: [{ id: 5, name: "随笔", parentId: 2, sortOrder: 1 }],
  },
];

/** 新建页 */
async function mountNewEditor() {
  return mountApp(PostEditorView as Component, {
    path: "/mine/editor",
    routeName: "editor-new",
    user: AUTHOR,
  });
}

/** 编辑页 */
async function mountEditEditor(id = 1) {
  return mountApp(PostEditorView as Component, {
    path: `/mine/editor/${id}`,
    routeName: "editor-edit",
    user: AUTHOR,
  });
}

/** 在编辑器挡板里「敲正文」，等价于用户在富文本区输入 */
async function typeBody(
  wrapper: { find: (s: string) => { setValue: (v: string) => Promise<void> } },
  html: string,
) {
  await wrapper.find(".yaniv-editor-stub__input").setValue(html);
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(categoriesApi.fetchCategories).mockResolvedValue({ categories: CATEGORY_TREE });
  vi.mocked(postsApi.fetchPostForEditor).mockResolvedValue(
    makePost({ id: 1, title: "既有标题", content: "<p>既有正文</p>", categoryId: 3 }),
  );
  vi.mocked(postsApi.createPost).mockResolvedValue({ post: makePost() });
  vi.mocked(postsApi.updatePost).mockResolvedValue({ post: makePost() });
  vi.mocked(uploadsApi.uploadImages).mockResolvedValue({ urls: ["/uploads/cover.png"] });
});

afterEach(() => {
  localStorage.clear();
});

describe("PostEditorView / 新建与编辑两种形态", () => {
  it("新建时标题为「写文章」、主按钮为「发布」", async () => {
    const { wrapper } = await mountNewEditor();

    expect(wrapper.find(".post-editor__heading").text()).toBe("写文章");
    expect(hasButton(wrapper, "发布")).toBe(true);
    expect(postsApi.fetchPostForEditor).not.toHaveBeenCalled();
  });

  it("编辑时标题为「编辑文章」、主按钮为「保存并发布」，并回填原文", async () => {
    const { wrapper } = await mountEditEditor(1);

    expect(wrapper.find(".post-editor__heading").text()).toBe("编辑文章");
    expect(hasButton(wrapper, "保存并发布")).toBe(true);
    expect(postsApi.fetchPostForEditor).toHaveBeenCalledWith(1);
    expect(
      (wrapper.find(".post-editor__title-input input").element as HTMLInputElement).value,
    ).toBe("既有标题");
    expect(wrapper.find(".yaniv-editor-stub__content").html()).toContain("既有正文");
  });

  it("加载失败时提示并退回「我的文章」", async () => {
    vi.mocked(postsApi.fetchPostForEditor).mockRejectedValue(new Error("文章不存在或无权编辑"));
    const { router } = await mountEditEditor(99);

    expect(messageSpies.error).toHaveBeenCalledWith("文章不存在或无权编辑");
    expect(router.currentRoute.value.name).toBe("mine");
  });
});

describe("PostEditorView / 栏目选择", () => {
  it("只列出二级栏目，并以「父 / 子」展示", async () => {
    const { wrapper } = await mountNewEditor();

    await wrapper.find(".post-editor__select .el-select__wrapper").trigger("click");
    await flushPromises();

    const labels = document.querySelectorAll(".el-select-dropdown__item");
    const texts = Array.from(labels).map((el) => el.textContent?.trim());
    expect(texts).toEqual(["技术 / 前端工程", "技术 / 后端服务", "生活 / 随笔"]);
  });
});

describe("PostEditorView / 发布前检查清单", () => {
  it("初始状态下必填项均未完成，徽标显示「待完善」", async () => {
    const { wrapper } = await mountNewEditor();

    expect(wrapper.find(".sidebar-card__badge").text()).toBe("待完善");
    const items = wrapper.findAll(".checklist__item");
    expect(items.map((i) => i.find(".checklist__status").text())).toEqual([
      "未完成",
      "未完成",
      "未完成",
      "未完成",
    ]);
  });

  it("封面是可选项，缺失不影响「可发布」判定", async () => {
    const { wrapper } = await mountNewEditor();

    await wrapper.find(".post-editor__title-input input").setValue("新标题");
    await typeBody(wrapper, "<p>正文内容</p>");
    await flushPromises();

    const optional = wrapper.find(".checklist__item.is-optional");
    expect(optional.text()).toContain("封面");
  });

  it("标题与正文填好、栏目选好后徽标转为「可发布」", async () => {
    const { wrapper } = await mountEditEditor(1);
    // 编辑态已带标题与栏目，补上正文即满足全部必填
    await typeBody(wrapper, "<p>补充的正文</p>");
    await flushPromises();

    expect(wrapper.find(".sidebar-card__badge").text()).toBe("可发布");
  });
});

describe("PostEditorView / 保存与发布", () => {
  it("标题或正文为空时只提示、不落库", async () => {
    const { wrapper } = await mountNewEditor();

    await button(wrapper, "存草稿").trigger("click");
    await flushPromises();

    expect(postsApi.createPost).not.toHaveBeenCalled();
    expect(messageSpies.warning).toHaveBeenCalledWith("标题与正文不能为空");
  });

  it("未选栏目时提示选择栏目", async () => {
    const { wrapper } = await mountNewEditor();

    await wrapper.find(".post-editor__title-input input").setValue("新标题");
    await typeBody(wrapper, "<p>正文内容</p>");
    await button(wrapper, "存草稿").trigger("click");
    await flushPromises();

    expect(postsApi.createPost).not.toHaveBeenCalled();
    expect(messageSpies.warning).toHaveBeenCalledWith("请选择栏目");
  });

  it("存草稿以 published=false 新建文章并回到「我的文章」", async () => {
    const { wrapper, router } = await mountEditEditor(1);
    await typeBody(wrapper, "<p>草稿正文</p>");
    await flushPromises();

    await button(wrapper, "存草稿").trigger("click");
    await flushPromises();

    expect(postsApi.updatePost).toHaveBeenCalledWith(1, {
      title: "既有标题",
      content: "<p>草稿正文</p>",
      categoryId: 3,
      published: false,
    });
    expect(messageSpies.success).toHaveBeenCalledWith("草稿已保存");
    expect(router.currentRoute.value.name).toBe("mine");
  });

  it("发布以 published=true 提交，并清掉本地草稿", async () => {
    const { wrapper, router } = await mountEditEditor(1);
    await typeBody(wrapper, "<p>正式正文</p>");
    await flushPromises();

    await button(wrapper, "保存并发布").trigger("click");
    await flushPromises();

    expect(postsApi.updatePost).toHaveBeenCalledWith(1, {
      title: "既有标题",
      content: "<p>正式正文</p>",
      categoryId: 3,
      published: true,
    });
    expect(messageSpies.success).toHaveBeenCalledWith("已保存并发布");
    expect(localStorage.getItem(draftStorageKey(1))).toBeNull();
    expect(router.currentRoute.value.name).toBe("mine");
  });

  it("新建成功时走 createPost 而非 updatePost", async () => {
    const { wrapper } = await mountNewEditor();

    await wrapper.find(".post-editor__title-input input").setValue("全新文章");
    await typeBody(wrapper, "<p>全新正文</p>");
    await flushPromises();

    // 直接选中第一个二级栏目
    await wrapper.find(".post-editor__select .el-select__wrapper").trigger("click");
    await flushPromises();
    (document.querySelectorAll(".el-select-dropdown__item")[0] as HTMLElement).click();
    await flushPromises();

    await button(wrapper, "发布").trigger("click");
    await flushPromises();

    expect(postsApi.updatePost).not.toHaveBeenCalled();
    expect(postsApi.createPost).toHaveBeenCalledWith({
      title: "全新文章",
      content: "<p>全新正文</p>",
      categoryId: 3,
      published: true,
    });
    expect(messageSpies.success).toHaveBeenCalledWith("发布成功");
  });

  it("有封面时把封面合并进正文首段", async () => {
    vi.mocked(postsApi.fetchPostForEditor).mockResolvedValue(
      makePost({
        id: 1,
        title: "带封面",
        content: '<p data-post-cover="1"><img src="/uploads/old.png" alt="带封面"/></p><p>正文</p>',
        categoryId: 3,
      }),
    );
    const { wrapper } = await mountEditEditor(1);
    await typeBody(wrapper, "<p>新的正文</p>");
    await flushPromises();

    await button(wrapper, "保存并发布").trigger("click");
    await flushPromises();

    const payload = vi.mocked(postsApi.updatePost).mock.calls[0][1];
    expect(payload.content).toBe(
      '<p data-post-cover="1"><img src="/uploads/old.png" alt="带封面" loading="lazy"/></p><p>新的正文</p>',
    );
  });
});

describe("PostEditorView / 封面图", () => {
  it("上传合法图片后展示预览", async () => {
    const { wrapper } = await mountNewEditor();

    const input = wrapper.find(".cover-file-input");
    const file = new File(["x"], "cover.png", { type: "image/png" });
    Object.defineProperty(input.element, "files", { value: [file], configurable: true });
    await input.trigger("change");
    await flushPromises();

    expect(uploadsApi.uploadImages).toHaveBeenCalledWith([file]);
    expect(messageSpies.success).toHaveBeenCalledWith("封面上传成功");
    expect(wrapper.find(".cover-preview__img").attributes("src")).toBe("/uploads/cover.png");
  });

  it("非 JPG/PNG 文件被拦下且不发起上传", async () => {
    const { wrapper } = await mountNewEditor();

    const input = wrapper.find(".cover-file-input");
    const file = new File(["x"], "cover.gif", { type: "image/gif" });
    Object.defineProperty(input.element, "files", { value: [file], configurable: true });
    await input.trigger("change");
    await flushPromises();

    expect(uploadsApi.uploadImages).not.toHaveBeenCalled();
    expect(messageSpies.warning).toHaveBeenCalledWith("仅支持 JPG/PNG 格式");
  });

  it("上传失败时报错且不留下预览", async () => {
    vi.mocked(uploadsApi.uploadImages).mockRejectedValue(new Error("服务端拒绝"));
    const { wrapper } = await mountNewEditor();

    const input = wrapper.find(".cover-file-input");
    const file = new File(["x"], "cover.png", { type: "image/png" });
    Object.defineProperty(input.element, "files", { value: [file], configurable: true });
    await input.trigger("change");
    await flushPromises();

    expect(messageSpies.error).toHaveBeenCalledWith("服务端拒绝");
    expect(wrapper.find(".cover-preview").exists()).toBe(false);
  });

  it("移除封面后回到上传占位", async () => {
    vi.mocked(postsApi.fetchPostForEditor).mockResolvedValue(
      makePost({
        id: 1,
        content: '<p data-post-cover="1"><img src="/uploads/old.png" alt="x"/></p><p>正文</p>',
      }),
    );
    const { wrapper } = await mountEditEditor(1);
    expect(wrapper.find(".cover-preview").exists()).toBe(true);

    await button(wrapper, "移除").trigger("click");

    expect(wrapper.find(".cover-preview").exists()).toBe(false);
    expect(wrapper.find(".cover-upload").exists()).toBe(true);
  });
});

describe("PostEditorView / 本地草稿", () => {
  it("新建页存在本地草稿时自动恢复并提示", async () => {
    localStorage.setItem(
      draftStorageKey(null),
      JSON.stringify({
        title: "草稿标题",
        categoryId: 4,
        published: false,
        coverUrl: null,
        contentHtml: "<p>草稿正文</p>",
        savedAt: Date.now(),
      }),
    );

    const { wrapper } = await mountNewEditor();

    expect(messageSpies.success).not.toHaveBeenCalled();
    expect(
      (wrapper.find(".post-editor__title-input input").element as HTMLInputElement).value,
    ).toBe("草稿标题");
    expect(wrapper.find(".yaniv-editor-stub__content").html()).toContain("草稿正文");
  });

  it("编辑页仅当草稿比服务端版本更新时才覆盖", async () => {
    vi.mocked(postsApi.fetchPostForEditor).mockResolvedValue(
      makePost({
        id: 1,
        title: "服务端标题",
        content: "<p>服务端正文</p>",
        updatedAt: "2026-06-01T00:00:00.000Z",
      }),
    );
    localStorage.setItem(
      draftStorageKey(1),
      JSON.stringify({
        title: "过期草稿",
        categoryId: 3,
        published: true,
        coverUrl: null,
        contentHtml: "<p>过期正文</p>",
        savedAt: new Date("2026-05-01T00:00:00.000Z").getTime(),
      }),
    );

    const { wrapper } = await mountEditEditor(1);

    expect(
      (wrapper.find(".post-editor__title-input input").element as HTMLInputElement).value,
    ).toBe("服务端标题");
  });
});

describe("PostEditorView / 离开确认", () => {
  it("没有改动时直接离开", async () => {
    const { wrapper, router } = await mountNewEditor();

    await wrapper.find(".post-editor__back").trigger("click");
    await flushPromises();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(router.currentRoute.value.name).toBe("mine");
  });

  it("有未保存改动时先弹确认框，确认后才离开", async () => {
    const { wrapper, router } = await mountNewEditor();
    await wrapper.find(".post-editor__title-input input").setValue("改了标题");
    await flushPromises();

    await wrapper.find(".post-editor__back").trigger("click");
    await flushPromises();

    expect(confirmSpy).toHaveBeenCalled();
    expect(router.currentRoute.value.name).toBe("mine");
  });

  it("确认框选择「继续编辑」时留在原页", async () => {
    const { wrapper, router } = await mountNewEditor();
    await wrapper.find(".post-editor__title-input input").setValue("改了标题");
    await flushPromises();

    rejectNextConfirm();
    await wrapper.find(".post-editor__back").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("editor-new");
  });
});
