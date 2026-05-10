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
  void router.push({
    name: "post-detail",
    params: { id: String(id) },
    query: { ...route.query },
  });
}

function onCardClick(ev: MouseEvent, id: number) {
  if ((ev.target as HTMLElement).closest("a")) return;
  goPost(id);
}

/** 列表摘要用纯文本，贴近简书摘要展示 */
function stripToPlain(html: string | undefined): string {
  if (html == null || html === "") return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cardAbstract(p: PostItem): string {
  return stripToPlain(p.content);
}

function cardCoverUrl(p: PostItem): string | null {
  const first = p.images?.[0];
  if (first != null && first !== "") return first;
  const m = (p.content ?? "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1] ?? null;
}

function authorInitial(p: PostItem): string {
  const name = p.author?.username;
  if (name == null || name === "") return "作";
  return name.slice(0, 1);
}

function formatFeedTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
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
          :to="{ path: '/', query: { parentId: String(resolvedParentId) } }"
        >
          首页
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
      <div class="feed-board">
        <el-empty v-if="!loading && posts.length === 0" class="feed-empty" description="暂无文章" />
        <article
          v-for="p in posts"
          :key="p.id"
          class="feed-card"
          role="link"
          tabindex="0"
          @click="onCardClick($event, p.id)"
          @keydown.enter="goPost(p.id)"
        >
          <div class="feed-card__inner">
            <div class="feed-card__main">
              <h2 class="feed-card__title">{{ p.title }}</h2>
              <p v-if="cardAbstract(p)" class="feed-card__abstract">
                {{ cardAbstract(p) }}
              </p>
              <div class="feed-card__meta">
                <el-avatar
                  class="feed-card__avatar"
                  :size="22"
                  :src="p.author?.avatar ?? undefined"
                >
                  {{ authorInitial(p) }}
                </el-avatar>
                <span class="feed-card__author">{{ p.author?.username ?? "—" }}</span>
                <span class="feed-card__dot">·</span>
                <time class="feed-card__time" :datetime="p.createdAt">{{
                  formatFeedTime(p.createdAt)
                }}</time>
                <span class="feed-card__dot">·</span>
                <span class="feed-card__cat">{{ p.category?.name ?? "未分类" }}</span>
              </div>
            </div>
            <div v-if="cardCoverUrl(p)" class="feed-card__thumb-wrap">
              <img class="feed-card__thumb" :src="cardCoverUrl(p)!" alt="" loading="lazy" />
            </div>
          </div>
        </article>
      </div>

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
</template>

<style scoped lang="scss">
$brand: #ea6f5a;
$text: #333;
$muted: #969696;
$line: #f0f0f0;

.home {
  display: block;
}

.home--with-side {
  display: flex;
  gap: 28px;
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

.feed-board {
  min-height: 240px;
  overflow: hidden;
  background: #fff;
  border: 1px solid rgb(0 0 0 / 4%);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 3%);
}

.feed-empty {
  padding: 48px 24px;
}

.feed-card {
  margin: 0;
  cursor: pointer;
  outline: none;
  border-bottom: 1px solid $line;
  transition: background 0.15s ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #f9f9f9;

    .feed-card__title {
      color: $brand;
    }

    .feed-card__thumb {
      transform: scale(1.02);
    }
  }

  &:focus-visible {
    background: #fafafa;
    box-shadow: inset 0 0 0 2px rgb(234 111 90 / 35%);
  }
}

.feed-card__inner {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  padding: 22px 26px 20px;

  @media (width <= 640px) {
    flex-direction: column-reverse;
    gap: 14px;
    padding: 18px 16px 16px;
  }
}

.feed-card__main {
  flex: 1 1 0;
  min-width: 0;
}

.feed-card__title {
  display: -webkit-box;
  margin: 0 0 10px;
  overflow: hidden;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
  color: $text;
  transition: color 0.15s ease;
  -webkit-box-orient: vertical;
}

.feed-card__abstract {
  display: -webkit-box;
  max-height: none;
  margin: 0 0 14px;
  overflow: hidden;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-size: 13px;
  line-height: 1.75;
  color: $muted;
  -webkit-box-orient: vertical;
}

.feed-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 0;
  align-items: center;
  font-size: 12px;
  line-height: 1.5;
  color: $muted;
}

.feed-card__avatar {
  flex-shrink: 0;
  margin-right: 6px;
}

.feed-card__author {
  color: #5a5a5a;
}

.feed-card__dot {
  margin: 0 5px;
  color: #d8d8d8;
}

.feed-card__time {
  color: $muted;
}

.feed-card__cat {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-card__thumb-wrap {
  flex-shrink: 0;
  width: 148px;
  height: 98px;
  overflow: hidden;
  border: 1px solid rgb(0 0 0 / 6%);
  border-radius: 6px;

  @media (width <= 640px) {
    width: 100%;
    height: 160px;
  }
}

.feed-card__thumb {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.25s ease;
}

.pager {
  display: flex;
  justify-content: center;
  margin-top: 28px;
}
</style>
