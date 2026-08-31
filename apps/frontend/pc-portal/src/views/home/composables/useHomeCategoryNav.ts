import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import { fetchCategories } from "@/api/categories";
import type { CategoryTreeNode } from "@/api/types";
import { findCategoryNodeById, findParentIdOfLeaf } from "@/utils/categoryTree";

import { readNumberQuery } from "../query";

/**
 * 首页二级分类导航的全部推导。
 *
 * 侧栏该显示哪一组分类，不能只看 query 里的 parentId：
 * 用户可能只带着叶子 categoryId 进来（例如从顶栏直接点进某个二级分类），
 * 这时要靠分类树把叶子反查回父级，才知道该展开哪一组。
 * 这段反查依赖异步加载的分类树，所以它必须是 computed 而不是一次性算好的值。
 */
export function useHomeCategoryNav() {
  const route = useRoute();
  const categories = ref<CategoryTreeNode[]>([]);

  onMounted(async () => {
    try {
      const { categories: tree } = await fetchCategories();
      categories.value = tree;
    } catch {
      /* 与顶栏共用数据源失败时仅影响侧栏；列表仍可按 query 请求 */
    }
  });

  const parentId = computed(() => readNumberQuery(route.query.parentId));
  const leafCategoryId = computed(() => readNumberQuery(route.query.categoryId));

  const resolvedParentId = computed(() => {
    if (parentId.value != null) return parentId.value;
    if (leafCategoryId.value != null && categories.value.length > 0) {
      return findParentIdOfLeaf(categories.value, leafCategoryId.value) ?? undefined;
    }
    return undefined;
  });

  const secondaryList = computed(() => {
    const pid = resolvedParentId.value;
    if (pid == null) return [];
    const node = findCategoryNodeById(categories.value, pid);
    return node?.children ?? [];
  });

  const showSecondarySidebar = computed(() => secondaryList.value.length > 0);

  /**
   * 侧栏「首页」代表「该父级下的全部」，只有用户明确点了父级才算选中。
   * 由叶子反查出来的父级不算：那种情况下高亮应该落在叶子上。
   */
  const isAllSecondaryActive = computed(
    () =>
      resolvedParentId.value != null &&
      leafCategoryId.value == null &&
      parentId.value === resolvedParentId.value,
  );

  return {
    parentId,
    leafCategoryId,
    resolvedParentId,
    secondaryList,
    showSecondarySidebar,
    isAllSecondaryActive,
  };
}
