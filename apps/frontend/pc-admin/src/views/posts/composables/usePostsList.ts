import { reactive, ref } from "vue";

import { fetchAdminPostsList } from "@/api/posts";
import type { PostItem } from "@/api/types";

export interface PostsFilters {
  q: string;
  published: undefined | boolean;
  categoryId?: number;
  authorId?: number;
}

/** 后台文章列表：筛选条件、分页与拉取 */
export function usePostsList() {
  const loading = ref(false);
  const rows = ref<PostItem[]>([]);
  const pagination = reactive({ page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false });

  const filters = reactive<PostsFilters>({
    q: "",
    published: undefined,
    categoryId: undefined,
    authorId: undefined,
  });

  async function reloadList() {
    loading.value = true;
    try {
      // 空筛选项一律不进 query，避免服务端把 ""/undefined 当成有效条件
      const q: Record<string, unknown> = { page: pagination.page, limit: pagination.limit };
      if (filters.q.trim()) q.q = filters.q.trim();
      if (filters.published !== undefined) q.published = filters.published;
      if (filters.categoryId) q.categoryId = filters.categoryId;
      if (filters.authorId) q.authorId = filters.authorId;
      const res = await fetchAdminPostsList(q);
      rows.value = res.posts;
      Object.assign(pagination, res.pagination);
    } finally {
      loading.value = false;
    }
  }

  return { loading, rows, pagination, filters, reloadList };
}
