<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAuthStore } from "@/stores/auth";
import PostArticleBody from "@/views/post-detail/components/PostArticleBody.vue";
import PostArticleHeader from "@/views/post-detail/components/PostArticleHeader.vue";
import PostCommentSection from "@/views/post-detail/components/PostCommentSection.vue";
import PostRecommendedPanel from "@/views/post-detail/components/PostRecommendedPanel.vue";
import { usePostComments } from "@/views/post-detail/composables/usePostComments";
import { usePostDetail } from "@/views/post-detail/composables/usePostDetail";
import { usePostInteractions } from "@/views/post-detail/composables/usePostInteractions";
import { useRecommendedPosts } from "@/views/post-detail/composables/useRecommendedPosts";

/**
 * 文章详情页：只负责编排。
 *
 * 四块状态各自成 composable（正文 / 推荐 / 评论 / 互动），
 * 四块界面各自成组件；这里剩下的就是把它们接起来，以及路由级的加载时机。
 */

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { isLoggedIn } = storeToRefs(auth);

const postId = computed(() => Number(route.params.id));

const { recommended, loadRecommended, goRecommended } = useRecommendedPosts();

const { post, loading, canEditPost, postBodyHtml, loadPost, onDeletePost } = usePostDetail(postId, {
  afterLoad: loadRecommended,
});

const { interactionLoading, toggleVote, toggleFavoriteDetail } = usePostInteractions(postId, post);

const {
  commentSort,
  commentPage,
  commentPagination,
  commentsLoading,
  sortedComments,
  newComment,
  activeInlineTarget,
  inlineDraft,
  loadComments,
  submitComment,
  startInlineReply,
  cancelInlineReply,
  submitInlineReply,
  canDeleteComment,
  onDeleteComment,
  resetInlineReply,
} = usePostComments({ postId, post, refreshPost: loadPost });

watch(
  () => route.params.id,
  async () => {
    resetInlineReply();
    await loadPost();
    commentPage.value = 1;
    await loadComments();
  },
  { immediate: true },
);

function goBackList() {
  void router.push({ name: "home", query: { ...route.query } });
}

function goEditPost() {
  if (!post.value) return;
  void router.push({ name: "editor-edit", params: { id: String(post.value.id) } });
}

// 评论删除权限要看 profile 里的权限码，登录后补拉一次
onMounted(() => {
  if (isLoggedIn.value) void auth.fetchProfile();
});

watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) void auth.fetchProfile();
});
</script>

<template>
  <div v-loading="loading" class="detail-page">
    <template v-if="post">
      <article class="article-card">
        <PostArticleHeader
          :post="post"
          :can-edit="canEditPost"
          :interaction-loading="interactionLoading"
          @back="goBackList"
          @edit="goEditPost"
          @remove="onDeletePost"
          @vote="toggleVote"
          @toggle-favorite="toggleFavoriteDetail"
        />

        <PostArticleBody :post="post" :body-html="postBodyHtml" :loading="loading" />

        <PostCommentSection
          v-model:sort="commentSort"
          v-model:page="commentPage"
          v-model:new-comment="newComment"
          v-model:inline-draft="inlineDraft"
          :threads="sortedComments"
          :loading="commentsLoading"
          :is-logged-in="isLoggedIn"
          :pagination="commentPagination"
          :fallback-total="post.commentCount ?? 0"
          :active-inline-target-id="activeInlineTarget?.id ?? null"
          :can-delete-comment="canDeleteComment"
          @submit-comment="submitComment"
          @start-reply="startInlineReply"
          @cancel-reply="cancelInlineReply"
          @submit-reply="submitInlineReply"
          @delete-comment="onDeleteComment"
        />
      </article>

      <PostRecommendedPanel :posts="recommended" @select="goRecommended" />
    </template>
  </div>
</template>

<style scoped lang="scss">
.detail-page {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 16px;
  align-items: start;
  min-height: 320px;

  @media (width <= 960px) {
    grid-template-columns: minmax(0, 1fr);

    // 侧栏是子组件的根元素，父作用域 id 也会打在它上面，这条仍然生效
    .sidebar {
      grid-column: 1 / -1;
    }
  }
}

.article-card {
  padding: 28px 36px 40px;
  background: #fff;
  border: 1px solid rgb(0 0 0 / 4%);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 3%);

  @media (width <= 640px) {
    padding: 20px 16px 32px;
  }
}
</style>
