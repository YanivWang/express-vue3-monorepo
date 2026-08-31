import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as categoriesApi from "@/api/categories";
import * as postsApi from "@/api/posts";
import type { CategoryTreeNode, PostItem } from "@/api/types";
import { mountApp } from "@/test/app-harness";
import { makePost, makePostsResult } from "@/test/fixtures";

import HomeView from "./HomeView.vue";

import type { Component } from "vue";

/**
 * HomeView 的行为基线（写在拆分之前，拆分后不得修改）。
 *
 * 首页真正的复杂度不在模板而在派生状态：query 里的 parentId / categoryId / sort
 * 三者互相影响，还要靠分类树把叶子反查回父级才能决定侧栏显示什么。
 * 这层推导一旦在拆分时被挪错位置，页面照样能渲染、但请求参数与高亮会悄悄错，
 * 因此断言集中在「请求带了什么参数」与「哪一项是选中态」。
 */

vi.mock("@/api/categories", () => ({ fetchCategories: vi.fn() }));
vi.mock("@/api/posts", () => ({ fetchPostsList: vi.fn() }));

const CATEGORY_TREE: CategoryTreeNode[] = [
  {
    id: 1,
    name: "技术",
    parentId: null,
    sortOrder: 1,
    children: [
      { id: 11, name: "前端", parentId: 1, sortOrder: 1 },
      { id: 12, name: "后端", parentId: 1, sortOrder: 2 },
    ],
  },
  { id: 2, name: "生活", parentId: null, sortOrder: 2, children: [] },
];

async function mountHome(path = "/", posts: PostItem[] = [makePost()]) {
  vi.mocked(postsApi.fetchPostsList).mockResolvedValue(makePostsResult(posts));
  const mounted = await mountApp(HomeView as Component, { routeName: "home", path });
  await flushPromises();
  return mounted;
}

/** 侧栏链接的可见文案，顺序即渲染顺序 */
function sidebarLinks(wrapper: { findAll: (s: string) => { text: () => string }[] }): string[] {
  return wrapper.findAll(".secondary-link").map((l) => l.text().trim());
}

/** 挂一个「共 3 页」的首页，供翻页相关用例复用 */
async function mountPagedHome() {
  vi.mocked(postsApi.fetchPostsList).mockResolvedValue(
    makePostsResult([makePost()], { total: 30, totalPages: 3 }),
  );
  const mounted = await mountApp(HomeView as Component, { routeName: "home", path: "/" });
  await flushPromises();
  return mounted;
}

beforeEach(() => {
  vi.mocked(categoriesApi.fetchCategories).mockResolvedValue({ categories: CATEGORY_TREE });
  vi.mocked(postsApi.fetchPostsList).mockResolvedValue(makePostsResult([makePost()]));
});

describe("HomeView / 首屏加载", () => {
  it("进入首页即按默认参数拉取第一页", async () => {
    await mountHome();

    expect(postsApi.fetchPostsList).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      categoryId: undefined,
      parentId: undefined,
      sort: "latest",
    });
  });

  it("文章渲染在信息流里", async () => {
    const { wrapper } = await mountHome("/", [
      makePost({ id: 1, title: "首页第一篇" }),
      makePost({ id: 2, title: "首页第二篇" }),
    ]);

    const titles = wrapper.findAll(".feed-card__title").map((t) => t.text());
    expect(titles).toEqual(["首页第一篇", "首页第二篇"]);
  });

  it("列表请求失败时落到空态而不是把上一次结果留在页面上", async () => {
    vi.mocked(postsApi.fetchPostsList).mockRejectedValue(new Error("网络错误"));

    const { wrapper } = await mountApp(HomeView as Component, { routeName: "home", path: "/" });
    await flushPromises();

    expect(wrapper.findAll(".feed-card")).toHaveLength(0);
    expect(wrapper.find(".feed-empty").text()).toContain("暂无文章");
  });
});

describe("HomeView / 二级分类侧栏", () => {
  it("未指定分类时不显示侧栏", async () => {
    const { wrapper } = await mountHome("/");

    expect(wrapper.find(".secondary-aside").exists()).toBe(false);
    expect(wrapper.find(".home").classes()).not.toContain("home--with-side");
  });

  it("指定 parentId 后按分类树渲染该父级下的二级分类", async () => {
    const { wrapper } = await mountHome("/?parentId=1");

    expect(wrapper.find(".secondary-aside").exists()).toBe(true);
    expect(wrapper.find(".home").classes()).toContain("home--with-side");
    expect(sidebarLinks(wrapper)).toEqual(["首页", "前端", "后端"]);
  });

  it("父级没有二级分类时仍不显示侧栏", async () => {
    const { wrapper } = await mountHome("/?parentId=2");

    expect(wrapper.find(".secondary-aside").exists()).toBe(false);
  });

  it("只给了叶子 categoryId 时反查出父级，侧栏照样出得来", async () => {
    const { wrapper } = await mountHome("/?categoryId=11");

    expect(wrapper.find(".secondary-aside").exists()).toBe(true);
    expect(sidebarLinks(wrapper)).toEqual(["首页", "前端", "后端"]);
  });

  it("分类接口失败只影响侧栏，列表照常渲染", async () => {
    vi.mocked(categoriesApi.fetchCategories).mockRejectedValue(new Error("挂了"));

    const { wrapper } = await mountHome("/?parentId=1", [makePost({ title: "仍然可见" })]);

    expect(wrapper.find(".secondary-aside").exists()).toBe(false);
    expect(wrapper.find(".feed-card__title").text()).toBe("仍然可见");
  });
});

describe("HomeView / 侧栏选中态", () => {
  it("只有 parentId 时「首页」为选中项", async () => {
    const { wrapper } = await mountHome("/?parentId=1");

    const active = wrapper.findAll(".secondary-link--active").map((l) => l.text().trim());
    expect(active).toEqual(["首页"]);
  });

  it("指定叶子分类时该叶子为选中项，「首页」让出高亮", async () => {
    const { wrapper } = await mountHome("/?parentId=1&categoryId=12");

    const active = wrapper.findAll(".secondary-link--active").map((l) => l.text().trim());
    expect(active).toEqual(["后端"]);
  });

  it("靠叶子反查出的父级不会把「首页」也点亮", async () => {
    const { wrapper } = await mountHome("/?categoryId=11");

    const active = wrapper.findAll(".secondary-link--active").map((l) => l.text().trim());
    expect(active).toEqual(["前端"]);
  });
});

describe("HomeView / 分类筛选参数", () => {
  it("只有 parentId 时按父级筛选", async () => {
    await mountHome("/?parentId=1");

    expect(postsApi.fetchPostsList).toHaveBeenLastCalledWith({
      page: 1,
      limit: 10,
      categoryId: undefined,
      parentId: 1,
      sort: "latest",
    });
  });

  it("叶子分类优先，此时不再把 parentId 一起发出去", async () => {
    await mountHome("/?parentId=1&categoryId=12");

    expect(postsApi.fetchPostsList).toHaveBeenLastCalledWith({
      page: 1,
      limit: 10,
      categoryId: 12,
      parentId: undefined,
      sort: "latest",
    });
  });

  it("非数字的分类参数按未指定处理", async () => {
    await mountHome("/?categoryId=abc");

    expect(postsApi.fetchPostsList).toHaveBeenLastCalledWith({
      page: 1,
      limit: 10,
      categoryId: undefined,
      parentId: undefined,
      sort: "latest",
    });
  });
});

describe("HomeView / 排序", () => {
  it("默认「最新」为选中态", async () => {
    const { wrapper } = await mountHome("/");

    const active = wrapper.findAll(".home-sort__link--active").map((l) => l.text().trim());
    expect(active).toEqual(["最新"]);
  });

  it("sort=hot 时「热门」选中并按热度请求", async () => {
    const { wrapper } = await mountHome("/?sort=hot");

    const active = wrapper.findAll(".home-sort__link--active").map((l) => l.text().trim());
    expect(active).toEqual(["热门"]);
    expect(postsApi.fetchPostsList).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: "hot" }),
    );
  });

  it("无法识别的 sort 回落到最新", async () => {
    const { wrapper } = await mountHome("/?sort=whatever");

    const active = wrapper.findAll(".home-sort__link--active").map((l) => l.text().trim());
    expect(active).toEqual(["最新"]);
    expect(postsApi.fetchPostsList).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: "latest" }),
    );
  });
});

describe("HomeView / 翻页", () => {
  it("切换页码后按新页码重新请求", async () => {
    const { wrapper } = await mountPagedHome();

    const pageTwo = wrapper.findAll(".el-pager li").find((li) => li.text() === "2");
    await pageTwo!.trigger("click");
    await flushPromises();

    expect(postsApi.fetchPostsList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it("换分类后页码回到第一页", async () => {
    const { wrapper, router } = await mountPagedHome();

    const pageThree = wrapper.findAll(".el-pager li").find((li) => li.text() === "3");
    await pageThree!.trigger("click");
    await flushPromises();
    expect(postsApi.fetchPostsList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));

    await router.push("/?parentId=1");
    await flushPromises();

    expect(postsApi.fetchPostsList).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, parentId: 1 }),
    );
  });
});

describe("HomeView / 进入详情", () => {
  it("点击卡片跳转到详情页并原样带上当前 query", async () => {
    const { wrapper, router } = await mountHome("/?parentId=1&sort=hot", [makePost({ id: 88 })]);

    await wrapper.find(".feed-card").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("post-detail");
    expect(router.currentRoute.value.params.id).toBe("88");
    expect(router.currentRoute.value.query).toEqual({ parentId: "1", sort: "hot" });
  });
});
