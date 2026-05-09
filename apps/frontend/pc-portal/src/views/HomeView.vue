<script setup lang="ts">
import { fetchPostsList } from "@/api/posts";
import type { Pagination, PostItem } from "@/api/types";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const posts = ref<PostItem[]>([]);
const pagination = ref<Pagination | null>(null);
const page = ref(1);
const loading = ref(false);

const parentId = computed(() => {
  const p = route.query.parentId;
  if (p == null || p === "") return undefined;
  const n = Number(p);
  return Number.isFinite(n) ? n : undefined;
});

async function load() {
  loading.value = true;
  try {
    const res = await fetchPostsList({
      page: page.value,
      limit: 10,
      parentId: parentId.value,
    });
    posts.value = res.posts;
    pagination.value = res.pagination;
  } finally {
    loading.value = false;
  }
}

watch(
  () => route.query.parentId,
  () => {
    page.value = 1;
  },
);

watch([page, parentId], load, { immediate: true });

function goPost(id: number) {
  router.push({ name: "post-detail", params: { id: String(id) } });
}

function excerpt(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 160 ? `${t.slice(0, 160)}…` : t;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}
</script>

<template>
  <div v-loading="loading" class="feed">
    <el-empty v-if="!loading && posts.length === 0" description="暂无文章" />
    <article
      v-for="p in posts"
      :key="p.id"
      class="card"
      role="link"
      tabindex="0"
      @click="goPost(p.id)"
      @keydown.enter="goPost(p.id)"
    >
      <h2 class="title">{{ p.title }}</h2>
      <p class="excerpt">{{ excerpt(p.content) }}</p>
      <div class="meta">
        <span>{{ p.author?.username ?? "—" }}</span>
        <span class="dot">·</span>
        <span>{{ p.category?.name ?? "未分类" }}</span>
        <span class="dot">·</span>
        <span>{{ formatTime(p.createdAt) }}</span>
      </div>
    </article>

    <div v-if="pagination && pagination.totalPages > 1" class="pager">
      <el-pagination
        :current-page="page"
        :page-size="pagination.limit"
        :total="pagination.total"
        layout="prev, pager, next"
        background
        @current-change="(p: number) => (page = p)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.feed {
  min-height: 240px;
}

.card {
  padding: 20px 20px 16px;
  margin-bottom: 12px;
  cursor: pointer;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
  transition: box-shadow 0.15s;
}

.card:hover {
  box-shadow: 0 2px 12px rgb(0 0 0 / 6%);
}

.title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.excerpt {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.6;
  color: #666;
}

.meta {
  font-size: 12px;
  color: #999;
}

.dot {
  margin: 0 6px;
}

.pager {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
</style>
