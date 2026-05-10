<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import { fetchCategories } from "@/api/categories";
import { fetchPostsList } from "@/api/posts";
import type { CategoryTreeNode, Pagination, PostItem } from "@/api/types";
import { findCategoryNodeById, findParentIdOfLeaf } from "@/utils/categoryTree";

const route = useRoute();
const router = useRouter();
const posts = ref<PostItem[]>([]);
const pagination = ref<Pagination | null>(null);
const page = ref(1);
const loading = ref(false);
const categories = ref<CategoryTreeNode[]>([]);

onMounted(async () => {
  try {
    const { categories: tree } = await fetchCategories();
    categories.value = tree;
  } catch {
    /* 与顶栏共用数据源失败时仅影响侧栏；列表仍可按 query 请求 */
  }
});

const parentId = computed(() => {
  const p = route.query.parentId;
  if (p == null || p === "") return undefined;
  const n = Number(Array.isArray(p) ? p[0] : p);
  return Number.isFinite(n) ? n : undefined;
});

const leafCategoryId = computed(() => {
  const p = route.query.categoryId;
  if (p == null || p === "") return undefined;
  const n = Number(Array.isArray(p) ? p[0] : p);
  return Number.isFinite(n) ? n : undefined;
});

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

const isAllSecondaryActive = computed(
  () =>
    resolvedParentId.value != null &&
    leafCategoryId.value == null &&
    parentId.value === resolvedParentId.value,
);

function isLeafActive(id: number) {
  return leafCategoryId.value === id;
}

async function load() {
  loading.value = true;
  try {
    const res = await fetchPostsList({
      page: page.value,
      limit: 10,
      categoryId: leafCategoryId.value,
      parentId: leafCategoryId.value != null ? undefined : parentId.value,
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

watch(
  () => route.query.categoryId,
  () => {
    page.value = 1;
  },
);

watch([page, parentId, leafCategoryId], load, { immediate: true });

function goPost(id: number) {
  void router.push({ name: "post-detail", params: { id: String(id) } });
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
  <div class="home" :class="{ 'home--with-side': showSecondarySidebar }">
    <aside v-if="showSecondarySidebar" class="secondary-aside" aria-label="二级分类">
      <nav class="secondary-nav">
        <RouterLink
          v-if="resolvedParentId != null"
          class="secondary-link"
          :class="{ 'secondary-link--active': isAllSecondaryActive }"
          :to="{ path: '/', query: { parentId: String(resolvedParentId) } }"
        >
          全部
        </RouterLink>
        <RouterLink
          v-for="c in secondaryList"
          :key="c.id"
          class="secondary-link"
          :class="{ 'secondary-link--active': isLeafActive(c.id) }"
          :to="{ path: '/', query: { categoryId: String(c.id) } }"
        >
          {{ c.name }}
        </RouterLink>
      </nav>
    </aside>

    <div v-loading="loading" class="feed-wrap">
      <div class="feed">
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
            @current-change="(pn: number) => (page = pn)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.home {
  display: block;
}

.home--with-side {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.secondary-aside {
  position: sticky;
  top: 68px;
  flex: 0 0 200px;
  width: 200px;
  padding: 12px 0;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
}

.secondary-nav {
  display: flex;
  flex-direction: column;
}

.secondary-link {
  padding: 10px 16px;
  font-size: 15px;
  color: #333;
  text-decoration: none;
  border-radius: 4px;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    color: #ea6f5a;
    background: #f5f5f5;
  }
}

.secondary-link--active {
  color: #ea6f5a;
  background: #f0f0f0;

  &:hover {
    color: #ea6f5a;
    background: #f0f0f0;
  }
}

.feed-wrap {
  flex: 1 1 0;
  min-width: 0;
}

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
