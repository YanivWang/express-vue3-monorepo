<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter, type LocationQueryRaw } from "vue-router";

import { fetchCategories } from "@/api/categories";
import { fetchPostsList } from "@/api/posts";
import type { CategoryTreeNode, Pagination, PostItem } from "@/api/types";
import PostFeedBoard from "@/components/PostFeedBoard.vue";
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

const feedSort = computed((): "latest" | "hot" => {
  const s = route.query.sort;
  const raw = typeof s === "string" ? s : Array.isArray(s) && s[0] != null ? String(s[0]) : "";
  return raw === "hot" ? "hot" : "latest";
});

function mergedQuery(patch: Record<string, string | undefined>): LocationQueryRaw {
  const next: LocationQueryRaw = { ...route.query };
  for (const [k, val] of Object.entries(patch)) {
    if (val === undefined) delete next[k];
    else next[k] = val;
  }
  return next;
}

async function load() {
  loading.value = true;
  try {
    const res = await fetchPostsList({
      page: page.value,
      limit: 10,
      categoryId: leafCategoryId.value,
      parentId: leafCategoryId.value != null ? undefined : parentId.value,
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

watch(
  () => route.query.sort,
  () => {
    page.value = 1;
  },
);

watch([page, parentId, leafCategoryId, feedSort], load, { immediate: true });

function goPost(id: number) {
  void router.push({
    name: "post-detail",
    params: { id: String(id) },
    query: { ...route.query },
  });
}
</script>

<template>
  <div class="home" :class="{ 'home--with-side': showSecondarySidebar }">
    <aside v-if="showSecondarySidebar" class="secondary-aside" aria-label="二级分类">
      <div class="secondary-aside__title">分类</div>
      <nav class="secondary-nav">
        <RouterLink
          v-if="resolvedParentId != null"
          class="secondary-link"
          :class="{ 'secondary-link--active': isAllSecondaryActive }"
          :to="{ path: '/', query: mergedQuery({ parentId: String(resolvedParentId) }) }"
        >
          首页
        </RouterLink>
        <RouterLink
          v-for="c in secondaryList"
          :key="c.id"
          class="secondary-link"
          :class="{ 'secondary-link--active': isLeafActive(c.id) }"
          :to="{ path: '/', query: mergedQuery({ categoryId: String(c.id) }) }"
        >
          {{ c.name }}
        </RouterLink>
      </nav>
    </aside>

    <div class="feed-wrap">
      <PostFeedBoard
        :posts="posts"
        :loading="loading"
        :pagination="pagination"
        :feed-page="page"
        empty-description="暂无文章"
        @select-post="goPost"
        @page-change="(pn: number) => (page = pn)"
      >
        <template #toolbar>
          <div class="home-sort" role="tablist" aria-label="列表排序">
            <RouterLink
              class="home-sort__link"
              :class="{ 'home-sort__link--active': feedSort === 'latest' }"
              :to="{ path: '/', query: mergedQuery({ sort: undefined }) }"
            >
              最新
            </RouterLink>
            <RouterLink
              class="home-sort__link"
              :class="{ 'home-sort__link--active': feedSort === 'hot' }"
              :to="{ path: '/', query: mergedQuery({ sort: 'hot' }) }"
            >
              热门
            </RouterLink>
          </div>
        </template>
      </PostFeedBoard>
    </div>
  </div>
</template>

<style scoped lang="scss">
$brand: #ea6f5a;
$text: #333;
$line: #f0f0f0;

.home {
  display: block;
}

.home--with-side {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.secondary-aside {
  position: sticky;
  top: 68px;
  flex: 0 0 200px;
  width: 200px;
  padding: 16px 0 12px;
  background: #fff;
  border: 1px solid rgb(0 0 0 / 4%);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 3%);
}

.secondary-aside__title {
  padding: 0 18px 10px;
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 600;
  color: $text;
  border-bottom: 1px solid $line;
}

.secondary-nav {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.secondary-link {
  padding: 10px 18px;
  font-size: 14px;
  color: #404040;
  text-decoration: none;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    color: $brand;
    background: #fafafa;
  }
}

.secondary-link--active {
  position: relative;
  font-weight: 600;
  color: $brand;
  background: rgb(234 111 90 / 6%);

  &::before {
    position: absolute;
    top: 50%;
    left: 0;
    width: 3px;
    height: 18px;
    content: "";
    background: $brand;
    border-radius: 0 2px 2px 0;
    transform: translateY(-50%);
  }

  &:hover {
    color: $brand;
    background: rgb(234 111 90 / 6%);
  }
}

.feed-wrap {
  flex: 1 1 0;
  min-width: 0;
}

.home-sort {
  display: flex;
  gap: 10px;
}

.home-sort__link {
  padding: 6px 16px;
  font-size: 14px;
  color: #666;
  text-decoration: none;
  background: #fafafa;
  border: 1px solid rgb(0 0 0 / 6%);
  border-radius: 20px;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    color: $brand;
    border-color: rgb(234 111 90 / 35%);
  }
}

.home-sort__link--active {
  font-weight: 600;
  color: $brand;
  background: rgb(234 111 90 / 8%);
  border-color: rgb(234 111 90 / 45%);
}
</style>
