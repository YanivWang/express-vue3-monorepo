import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { fetchCategories } from "@/api/categories";
import type { CategoryTreeNode } from "@/api/types";
import { findParentIdOfLeaf } from "@/utils/categoryTree";

/** 顶栏频道键：全部为 "all"，某个一级分类为 "p-<id>" */
const ALL_CHANNEL = "all";

/**
 * 顶栏频道导航：加载一级分类、把当前路由映射成选中项、点击跳转。
 *
 * 只有首页、详情、登录/注册、搜索这几类页面挂频道导航——
 * 详情页也要挂，是为了从列表点进文章后顶栏的选中态不跳掉。
 */
export function useChannelNav() {
  const route = useRoute();
  const router = useRouter();

  const categories = ref<CategoryTreeNode[]>([]);
  const activeChannel = ref(ALL_CHANNEL);

  function isChannelShellRoute(): boolean {
    return (
      route.path === "/" ||
      route.name === "post-detail" ||
      route.name === "login" ||
      route.name === "register" ||
      route.name === "search"
    );
  }

  function syncTabFromRoute() {
    if (!isChannelShellRoute()) {
      activeChannel.value = "";
      return;
    }
    // 带二级分类时要回溯到它所属的一级，才能高亮对应频道
    const cat = route.query.categoryId;
    if (cat != null && cat !== "") {
      const rawCat = Array.isArray(cat) ? cat[0] : cat;
      const leafNum = Number(rawCat);
      if (Number.isFinite(leafNum) && categories.value.length > 0) {
        const rootId = findParentIdOfLeaf(categories.value, leafNum);
        if (rootId != null) {
          activeChannel.value = `p-${rootId}`;
          return;
        }
      }
    }
    const p = route.query.parentId;
    if (p == null || p === "") {
      activeChannel.value = ALL_CHANNEL;
    } else {
      const raw = Array.isArray(p) ? p[0] : p;
      activeChannel.value = `p-${raw ?? ""}`;
    }
  }

  // categories 也要进依赖：分类晚于路由到达时，需要重算一次高亮
  watch(
    () => [route.path, route.name, route.query.parentId, route.query.categoryId, categories.value],
    () => syncTabFromRoute(),
    { immediate: true },
  );

  async function loadCategories() {
    try {
      const { categories: tree } = await fetchCategories();
      categories.value = tree;
    } catch {
      // 顶栏的错误提示由 http 层统一负责，这里失败只表现为没有频道项
    }
  }

  function onChannelSelect(key: string) {
    if (key === ALL_CHANNEL) {
      void router.push({ path: "/", query: {} });
      return;
    }
    if (key.startsWith("p-")) {
      void router.push({ path: "/", query: { parentId: key.slice(2) } });
    }
  }

  return { categories, activeChannel, isChannelShellRoute, loadCategories, onChannelSelect };
}
