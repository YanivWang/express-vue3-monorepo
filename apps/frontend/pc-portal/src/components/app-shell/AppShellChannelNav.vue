<script setup lang="ts">
import type { CategoryTreeNode } from "@/api/types";

defineProps<{
  categories: CategoryTreeNode[];
  /** 当前选中的频道键："all" 或 "p-<一级分类 id>" */
  active: string;
}>();

defineEmits<{ select: [key: string] }>();
</script>

<template>
  <nav class="channel-nav" aria-label="频道">
    <button
      type="button"
      class="channel-nav__item"
      :class="{ 'is-active': active === 'all' }"
      @click="$emit('select', 'all')"
    >
      首页
    </button>
    <button
      v-for="c in categories"
      :key="c.id"
      type="button"
      class="channel-nav__item"
      :class="{ 'is-active': active === `p-${c.id}` }"
      @click="$emit('select', `p-${c.id}`)"
    >
      {{ c.name }}
    </button>
  </nav>
</template>

<style scoped lang="scss">
@use "./styles/tokens" as *;

.channel-nav {
  display: flex;
  flex: 0 1 auto;
  flex-wrap: nowrap;
  gap: 0;
  align-items: center;
  min-width: 0;
}

.channel-nav__item {
  box-sizing: border-box;
  flex-shrink: 0;
  padding: 0 18px;
  margin: 0;
  font-family: inherit;
  font-size: 17px;
  font-weight: 400;
  line-height: 58px;
  color: $text;
  text-align: center;
  letter-spacing: 0.02em;
  text-decoration: none;
  cursor: pointer;
  outline: none;
  background: transparent;
  border: none;
  border-radius: 0;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;

  @include focus-ring;

  &:hover {
    color: $brand;
    background-color: rgb(0 0 0 / 2%);
  }

  &.is-active {
    font-weight: 600;
    color: $brand;
    background-color: transparent;
  }

  &:focus-visible {
    border-radius: 6px;
  }
}
</style>
