import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { fetchPostsList } from "@/api/posts";
import type { PostItem } from "@/api/types";

/** 同分类推荐不足 6 条时，用全站最新补齐到这个上限 */
const MIN_SAME_CATEGORY = 6;
const MAX_RECOMMENDED = 10;

/** 侧栏「推荐阅读」 */
export function useRecommendedPosts() {
  const route = useRoute();
  const router = useRouter();
  const recommended = ref<PostItem[]>([]);

  async function loadRecommended(current: PostItem) {
    try {
      const { posts: sameCat } = await fetchPostsList({
        categoryId: current.categoryId,
        page: 1,
        limit: 14,
      });
      const list = sameCat.filter((x) => x.id !== current.id);
      if (list.length < MIN_SAME_CATEGORY) {
        const { posts: anyPosts } = await fetchPostsList({ page: 1, limit: 24 });
        for (const item of anyPosts) {
          if (item.id === current.id) continue;
          if (list.some((x) => x.id === item.id)) continue;
          list.push(item);
          if (list.length >= 12) break;
        }
      }
      recommended.value = list.slice(0, MAX_RECOMMENDED);
    } catch {
      // 推荐是锦上添花，拉不到就空着，不能连累正文渲染
      recommended.value = [];
    }
  }

  function goRecommended(id: number) {
    void router.push({
      name: "post-detail",
      params: { id: String(id) },
      query: { ...route.query },
    });
  }

  return { recommended, loadRecommended, goRecommended };
}
