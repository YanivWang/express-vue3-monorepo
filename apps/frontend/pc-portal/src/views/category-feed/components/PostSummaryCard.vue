<script setup lang="ts">
import type { ArticleRow } from "../types";

defineProps<{
  row: ArticleRow;
}>();
</script>

<template>
  <article class="cf__article">
    <h2 class="cf__article-title">
      <a href="javascript:void(0)">{{ row.title }}</a>
    </h2>
    <p class="cf__article-summary">{{ row.summary }}</p>
    <div class="cf__article-meta">
      <span class="cf__reward">
        <svg class="cf__reward-gem" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path fill="#ea6f5a" d="M12 3l3 5h6l-4.5 8L12 21l-4.5-5L3 8h6l3-5z" opacity="0.95" />
        </svg>
        <span class="cf__reward-num">{{ row.reward }}</span>
      </span>
      <span class="cf__meta-author">{{ row.author }}</span>
      <span class="cf__meta-stat">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path
            fill="none"
            stroke="#c8c8c8"
            stroke-width="1.75"
            stroke-linejoin="round"
            d="M6 9a7 7 0 0 1 12 0v6H6V9z"
          />
          <path fill="#c8c8c8" d="M8 15h8v2a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2z" />
        </svg>
        <span>{{ row.comments }}</span>
      </span>
      <span class="cf__meta-stat">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path
            fill="none"
            stroke="#c8c8c8"
            stroke-width="1.75"
            stroke-linecap="round"
            d="M12 8.5c-2.5-2.2-6-.7-6 3.2 0 2.6 2.2 4.7 6 7.8 3.8-3.1 6-5.2 6-7.8 0-3.9-3.5-5.4-6-3.2z"
          />
        </svg>
        <span>{{ row.likes }}</span>
      </span>
    </div>
  </article>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.cf__article {
  padding-bottom: 32px;
  margin-bottom: 32px;
  border-bottom: 1px solid $cf-border;
}

.cf__article:last-child {
  margin-bottom: 0;
}

.cf__article-title {
  margin: 0 0 10px;

  a {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.45;
    color: $cf-text;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  a:hover {
    color: $cf-primary;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

.cf__article-summary {
  display: -webkit-box;
  margin: 0 0 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-size: 13px;
  font-weight: 400;
  line-height: 24px;
  color: $cf-muted;
  -webkit-box-orient: vertical;
}

.cf__article-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  font-size: 12px;
  line-height: 1;
  color: $cf-meta;
}

.cf__reward {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.cf__reward-gem {
  display: block;
  flex-shrink: 0;
}

.cf__reward-num {
  font-size: 12px;
  font-weight: 400;
  color: #c57d6a;
}

.cf__meta-author {
  font-size: 12px;
  font-weight: 400;
  color: #b4b4b4;
}

.cf__meta-stat {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: 12px;
  color: $cf-meta;

  svg {
    display: block;
    flex-shrink: 0;
  }
}
</style>
