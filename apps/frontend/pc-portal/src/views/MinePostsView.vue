<script setup lang="ts">
import { fetchMyPostsList } from "@/api/posts";
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
    const res = await fetchMyPostsList({
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

function formatTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}
</script>

<template>
  <div class="mine">
    <div class="toolbar">
      <h1>我的文章</h1>
      <el-button type="primary" @click="router.push({ name: 'editor-new' })">新建文章</el-button>
    </div>
    <div v-loading="loading" class="list">
      <el-empty v-if="!loading && posts.length === 0" description="暂无文章" />
      <div v-for="p in posts" :key="p.id" class="row">
        <div
          class="info"
          @click="router.push({ name: 'post-detail', params: { id: String(p.id) } })"
        >
          <div class="title-line">
            <span class="title">{{ p.title }}</span>
            <el-tag v-if="!p.published" type="info" size="small">草稿</el-tag>
            <el-tag v-else type="success" size="small">已发布</el-tag>
          </div>
          <div class="meta">{{ formatTime(p.updatedAt) }} · {{ p.category?.name }}</div>
        </div>
        <el-button
          link
          type="primary"
          @click.stop="router.push({ name: 'editor-edit', params: { id: String(p.id) } })"
        >
          编辑
        </el-button>
      </div>
      <div v-if="pagination && pagination.totalPages > 1" class="pager">
        <el-pagination
          :current-page="page"
          :page-size="pagination.limit"
          :total="pagination.total"
          layout="prev, pager, next"
          background
          @current-change="(n: number) => (page = n)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.mine {
  padding: 20px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.toolbar h1 {
  margin: 0;
  font-size: 20px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info {
  flex: 1;
  cursor: pointer;
}

.title-line {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.meta {
  font-size: 12px;
  color: #999;
}

.pager {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style>
