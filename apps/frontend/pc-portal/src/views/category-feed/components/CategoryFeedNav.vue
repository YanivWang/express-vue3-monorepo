<script setup lang="ts">
import CategoryFeedNavIcon from "./CategoryFeedNavIcon.vue";

import type { PrimaryKey } from "../types";

defineProps<{
  activePrimary: PrimaryKey;
  primaryLabels: Record<PrimaryKey, string>;
}>();

defineEmits<{ select: [key: PrimaryKey] }>();

/** 顺序即导航顺序，改这里就能调整一级入口的排列 */
const PRIMARY_KEYS: PrimaryKey[] = ["home", "discover", "library", "tech"];
</script>

<template>
  <nav class="cf__nav" aria-label="主导航">
    <a
      v-for="key in PRIMARY_KEYS"
      :key="key"
      href="javascript:void(0)"
      class="cf__nav-item"
      :class="{ 'cf__nav-item--active': activePrimary === key }"
      @click.prevent="$emit('select', key)"
    >
      <CategoryFeedNavIcon :name="key" />
      <span>{{ primaryLabels[key] }}</span>
    </a>
  </nav>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.cf__nav {
  display: flex;
  align-items: center;
}

.cf__nav-item {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  height: $cf-header-h;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 400;
  line-height: 26px;
  color: $cf-text;
  white-space: nowrap;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition:
    color 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    color: $cf-text;
    background-color: rgb(0 0 0 / 2%);
  }
}

.cf__nav-item--active {
  color: $cf-primary;
  border-bottom-color: $cf-primary;

  &:hover {
    color: $cf-primary;
  }
}
</style>
