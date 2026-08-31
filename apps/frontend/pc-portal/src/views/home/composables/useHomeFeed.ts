import { computed, ref, watch, type Ref } from "vue";
import { useRoute } from "vue-router";

import { fetchPostsList } from "@/api/posts";
import type { Pagination, PostItem } from "@/api/types";

/** 首页每页条数，与后端默认值一致 */
const PAGE_SIZE = 10;

export interface HomeFeedFilters {
  parentId: Ref<number | undefined>;
  leafCategoryId: Ref<number | undefined>;
}

/**
 * 首页文章流的加载、分页与排序。
 *
 * 筛选条件由 useHomeCategoryNav 从 query 推导后传进来，这里只负责「据此取数据」，
 * 两者因此可以各自单独看懂：一个管 URL 怎么解读，一个管解读结果怎么变成请求。
 */
export function useHomeFeed(filters: HomeFeedFilters) {
  const route = useRoute();
  const posts = ref<PostItem[]>([]);
  const pagination = ref<Pagination | null>(null);
  const page = ref(1);
  const loading = ref(false);

  const feedSort = computed((): "latest" | "hot" => {
    const s = route.query.sort;
    const raw = typeof s === "string" ? s : Array.isArray(s) && s[0] != null ? String(s[0]) : "";
    return raw === "hot" ? "hot" : "latest";
  });

  async function load() {
    loading.value = true;
    try {
      const res = await fetchPostsList({
        page: page.value,
        limit: PAGE_SIZE,
        categoryId: filters.leafCategoryId.value,
        // 已经精确到叶子分类时不再附带父级，避免多传一层无意义的收窄条件
        parentId: filters.leafCategoryId.value != null ? undefined : filters.parentId.value,
        sort: feedSort.value === "hot" ? "hot" : "latest",
      });
      posts.value = res.posts;
      pagination.value = res.pagination;
    } catch {
      posts.value = [];
      pagination.value = null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 换分类或换排序等于换了一份列表，页码必须归一。
   * 否则会带着上一份列表的第 3 页去请求新列表，多半落到空结果上。
   * 必须排在下面的加载监听之前注册，这样同一轮里页码先归位、再发请求。
   */
  watch([() => route.query.parentId, () => route.query.categoryId, () => route.query.sort], () => {
    page.value = 1;
  });

  watch([page, filters.parentId, filters.leafCategoryId, feedSort], load, { immediate: true });

  return { posts, pagination, page, loading, feedSort };
}
