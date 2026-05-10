<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { fetchPostsList } from "@/api/posts";
import type { Pagination, PostItem } from "@/api/types";
import PostFeedBoard from "@/components/PostFeedBoard.vue";

const route = useRoute();
const router = useRouter();
const posts = ref<PostItem[]>([]);
const pagination = ref<Pagination | null>(null);
const page = ref(1);
const loading = ref(false);

const q = computed(() => {
  const raw = route.query.q;
  const s =
    typeof raw === "string" ? raw : Array.isArray(raw) && raw[0] != null ? String(raw[0]) : "";
  return s.trim();
});

const hasQuery = computed(() => q.value.length > 0);

async function load() {
  if (!hasQuery.value) {
    posts.value = [];
    pagination.value = null;
    return;
  }
  loading.value = true;
  try {
    const res = await fetchPostsList({
      page: page.value,
      limit: 10,
      q: q.value,
    });
    posts.value = res.posts;
    pagination.value = res.pagination;
  } finally {
    loading.value = false;
  }
}

watch(
  () => route.query.q,
  () => {
    page.value = 1;
  },
);

watch([page, q], load, { immediate: true });

function goPost(id: number) {
  void router.push({
    name: "post-detail",
    params: { id: String(id) },
  });
}
</script>

<template>
  <div class="search-page">
    <header class="search-head">
      <h1 class="search-head__title">搜索</h1>
      <p v-if="hasQuery" class="search-head__hint">关键词「{{ q }}」，匹配标题或正文</p>
      <p v-else class="search-head__hint search-head__hint--muted">
        在顶部搜索框输入关键字，在全站公开文章中查找。
      </p>
    </header>

    <template v-if="hasQuery">
      <PostFeedBoard
        :posts="posts"
        :loading="loading"
        :pagination="pagination"
        :feed-page="page"
        empty-description="未找到相关内容"
        @select-post="goPost"
        @page-change="(pn: number) => (page = pn)"
      />
    </template>
    <div v-else class="search-hint-board">
      <el-empty description="请输入关键词开始使用搜索" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.search-page {
  max-width: 960px;
  padding-bottom: 32px;
  margin: 0 auto;
}

.search-head {
  margin-bottom: 20px;
}

.search-head__title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  color: #333;
}

.search-head__hint {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #595959;

  &--muted {
    color: #969696;
  }
}

.search-hint-board {
  min-height: 280px;
  padding: 32px 0;
}
</style>
