<script setup lang="ts">
import { useRoute } from "vue-router";

import type { CategoryTreeNode } from "@/api/types";

import { mergedQuery } from "../query";

const props = defineProps<{
  /** 当前展开的一级分类；为空时本组件不会被渲染 */
  parentId: number | undefined;
  items: CategoryTreeNode[];
  /** 「首页」（该父级下全部）是否为选中项 */
  allActive: boolean;
  activeLeafId: number | undefined;
}>();

// 链接经 mergedQuery 生成，切分类时保留 sort 等其它筛选
const route = useRoute();

function isLeafActive(id: number) {
  return props.activeLeafId === id;
}
</script>

<template>
  <aside class="secondary-aside" aria-label="二级分类">
    <div class="secondary-aside__title">分类</div>
    <nav class="secondary-nav">
      <RouterLink
        v-if="parentId != null"
        class="secondary-link"
        :class="{ 'secondary-link--active': allActive }"
        :to="{ path: '/', query: mergedQuery(route.query, { parentId: String(parentId) }) }"
      >
        首页
      </RouterLink>
      <RouterLink
        v-for="c in items"
        :key="c.id"
        class="secondary-link"
        :class="{ 'secondary-link--active': isLeafActive(c.id) }"
        :to="{ path: '/', query: mergedQuery(route.query, { categoryId: String(c.id) }) }"
      >
        {{ c.name }}
      </RouterLink>
    </nav>
  </aside>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

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
</style>
