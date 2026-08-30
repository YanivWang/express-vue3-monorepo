import { flushPromises } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

// ESLint 的类型程序解析不了 .vue SFC 的具体类型（只有 vue-tsc 能），与 main.ts 一致显式标注

import { mountApp } from "@/test/app-harness";

import CategoryFeedHeader from "./CategoryFeedHeader.vue";

import type { PrimaryKey } from "../types";
import type { Component } from "vue";

/**
 * CategoryFeedHeader 的行为基线（写在拆分之前，拆分后不得修改）。
 *
 * 这个组件的模板是四段几乎一样的导航项，拆分时最可能出错的地方是
 * 「哪一项高亮」和「点了发出哪个 key」，所以逐项都断言到。
 */

const PRIMARY_LABELS: Record<PrimaryKey, string> = {
  home: "首页",
  discover: "发现",
  library: "书库",
  tech: "技术",
};

async function mountHeader(activePrimary: PrimaryKey = "home") {
  return mountApp(CategoryFeedHeader as Component, {
    props: { activePrimary, primaryLabels: PRIMARY_LABELS },
  });
}

describe("CategoryFeedHeader / 渲染", () => {
  it("渲染站点 logo 与四个一级入口", async () => {
    const { wrapper } = await mountHeader();

    expect(wrapper.find(".cf__logo").text()).toBe("码笺");
    expect(wrapper.findAll(".cf__nav-item").map((i) => i.text())).toEqual([
      "首页",
      "发现",
      "书库",
      "技术",
    ]);
  });

  it("入口文案完全由 primaryLabels 决定", async () => {
    const { wrapper } = await mountApp(CategoryFeedHeader as Component, {
      props: {
        activePrimary: "home",
        primaryLabels: { home: "甲", discover: "乙", library: "丙", tech: "丁" },
      },
    });

    expect(wrapper.findAll(".cf__nav-item").map((i) => i.text())).toEqual(["甲", "乙", "丙", "丁"]);
  });

  it("每个入口都带自己的图标", async () => {
    const { wrapper } = await mountHeader();
    expect(wrapper.findAll(".cf__nav-ico svg")).toHaveLength(4);
  });

  it("渲染右侧的登录、注册与写文章入口", async () => {
    const { wrapper } = await mountHeader();

    expect(wrapper.find(".cf__link-login").text()).toBe("登录");
    expect(wrapper.find(".cf__btn-reg").text()).toBe("注册");
    expect(wrapper.find(".cf__btn-write").text()).toBe("写文章");
    expect(wrapper.find(".cf__icon-btn").attributes("aria-label")).toBe("阅读偏好");
  });
});

describe("CategoryFeedHeader / 一级入口选中态", () => {
  const cases: PrimaryKey[] = ["home", "discover", "library", "tech"];

  it.each(cases)("activePrimary=%s 时只高亮该项", async (key) => {
    const { wrapper } = await mountHeader(key);

    const active = wrapper.findAll(".cf__nav-item--active");
    expect(active).toHaveLength(1);
    expect(active[0].text()).toBe(PRIMARY_LABELS[key]);
  });

  it.each(cases)("点击第 %s 项时抛出对应的 selectPrimary", async (key) => {
    const { wrapper } = await mountHeader();
    const index = cases.indexOf(key);

    await wrapper.findAll(".cf__nav-item")[index].trigger("click");

    expect(wrapper.emitted("selectPrimary")).toEqual([[key]]);
  });

  it("点击导航项不会触发浏览器默认跳转", async () => {
    const { wrapper, router } = await mountHeader();

    await wrapper.findAll(".cf__nav-item")[1].trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/");
  });
});

describe("CategoryFeedHeader / 搜索", () => {
  it("提交关键词跳转搜索页", async () => {
    const { wrapper, router } = await mountHeader();

    await wrapper.find(".cf__search-input").setValue("组件拆分");
    await wrapper.find(".cf__search-wrap").trigger("submit");
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/search");
    expect(router.currentRoute.value.query.q).toBe("组件拆分");
  });

  it("只输入空白时不带 q 参数", async () => {
    const { wrapper, router } = await mountHeader();

    await wrapper.find(".cf__search-input").setValue("   ");
    await wrapper.find(".cf__search-wrap").trigger("submit");
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/search");
    expect(router.currentRoute.value.query.q).toBeUndefined();
  });
});
