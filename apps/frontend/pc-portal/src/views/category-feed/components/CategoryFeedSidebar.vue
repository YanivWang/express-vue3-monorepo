<script setup lang="ts">
import type { SecondaryDef } from "../types";

defineProps<{
  items: SecondaryDef[];
  activeSlug: string;
}>();

const emit = defineEmits<{
  selectSecondary: [slug: string];
}>();
</script>

<template>
  <aside class="cf__aside" aria-label="子分类">
    <ul v-if="items.length" class="cf__side-list">
      <li v-for="item in items" :key="item.slug">
        <a
          href="javascript:void(0)"
          class="cf__side-link"
          :class="{ 'cf__side-link--active': activeSlug === item.slug }"
          @click.prevent="emit('selectSecondary', item.slug)"
        >
          {{ item.label }}
        </a>
      </li>
    </ul>
    <p v-else class="cf__aside-empty">当前分类下暂无子栏目</p>
  </aside>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.cf__aside {
  flex: 0 0 $cf-sidebar-w;
  width: $cf-sidebar-w;
}

.cf__side-list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.cf__side-list li + li {
  margin-top: 2px;
}

.cf__side-link {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  min-height: 42px;
  padding: 8px 12px 8px 20px;
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  color: $cf-text;
  text-decoration: none;
  border-radius: 4px;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: #f5f5f5;
  }
}

.cf__side-link--active {
  font-weight: 400;
  color: $cf-primary;
  background: #f0f0f0;

  &:hover {
    color: $cf-primary;
    background: #f0f0f0;
  }
}

.cf__aside-empty {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: $cf-meta;
}
</style>
