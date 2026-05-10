<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";

import { fetchFavoritePostsList } from "@/api/posts";
import type { Pagination, PostItem } from "@/api/types";
import PostFeedBoard from "@/components/PostFeedBoard.vue";

const router = useRouter();
const posts = ref<PostItem[]>([]);
const pagination = ref<Pagination | null>(null);
const page = ref(1);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await fetchFavoritePostsList({ page: page.value, limit: 10 });
    posts.value = res.posts;
    pagination.value = res.pagination;
  } finally {
    loading.value = false;
  }
}

watch(page, load, { immediate: true });

function goPost(id: number) {
  void router.push({
    name: "post-detail",
    params: { id: String(id) },
  });
}
</script>

<template>
  <div class="favorites-page">
    <header class="favorites-head">
      <h1 class="favorites-head__title">我的收藏</h1>
    </header>
    <PostFeedBoard
      :posts="posts"
      :loading="loading"
      :pagination="pagination"
      :feed-page="page"
      empty-description="暂无收藏"
      @select-post="goPost"
      @page-change="(pn: number) => (page = pn)"
    />
  </div>
</template>

<style scoped lang="scss">
.favorites-page {
  box-sizing: border-box;
  max-width: 800px;
  padding: 20px 0 48px;
  margin: 0 auto;
}

.favorites-head__title {
  margin: 0 0 20px;
  font-size: 22px;
  font-weight: 700;
  color: #333;
}
</style>
