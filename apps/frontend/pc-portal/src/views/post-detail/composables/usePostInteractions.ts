import { ElMessage } from "element-plus";
import { storeToRefs } from "pinia";
import { ref, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { setPostFavoriteHttp, votePost } from "@/api/posts";
import type { PostItem } from "@/api/types";
import { useAuthStore } from "@/stores/auth";

/** 点赞 / 踩 / 收藏；未登录时统一引导到登录页 */
export function usePostInteractions(postId: Ref<number>, post: Ref<PostItem | null>) {
  const route = useRoute();
  const router = useRouter();
  const { isLoggedIn } = storeToRefs(useAuthStore());

  const interactionLoading = ref(false);

  function requireLoginForInteraction() {
    if (!isLoggedIn.value) {
      ElMessage.warning("请先登录后再操作");
      void router.push({ name: "login", query: { redirect: route.fullPath } });
      return false;
    }
    return true;
  }

  async function toggleVote(kind: "like" | "dislike") {
    if (!requireLoginForInteraction()) return;
    if (!post.value) return;
    interactionLoading.value = true;
    try {
      const cur = post.value.myVote ?? null;
      // 再点一次当前态即取消；点另一态直接改投
      const next: "like" | "dislike" | "none" =
        kind === "like"
          ? cur === "like"
            ? "none"
            : "like"
          : cur === "dislike"
            ? "none"
            : "dislike";
      const { post: p } = await votePost(postId.value, next);
      post.value = p;
    } finally {
      interactionLoading.value = false;
    }
  }

  async function toggleFavoriteDetail() {
    if (!requireLoginForInteraction()) return;
    if (!post.value) return;
    interactionLoading.value = true;
    try {
      const next = !(post.value.myFavorited ?? false);
      const { post: p } = await setPostFavoriteHttp(postId.value, next);
      post.value = p;
      ElMessage.success(next ? "已加入收藏" : "已取消收藏");
    } finally {
      interactionLoading.value = false;
    }
  }

  return { interactionLoading, toggleVote, toggleFavoriteDetail };
}
