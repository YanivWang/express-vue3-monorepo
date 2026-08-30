<script setup lang="ts">
import type { PostItem } from "@/api/types";

defineProps<{ posts: PostItem[] }>();

defineEmits<{ select: [id: number] }>();
</script>

<template>
  <aside class="sidebar">
    <div class="rec-card">
      <h3 class="side-heading">推荐阅读</h3>
      <ul class="rec-list">
        <li v-for="item in posts" :key="item.id">
          <button type="button" class="rec-link" @click="$emit('select', item.id)">
            {{ item.title }}
          </button>
        </li>
      </ul>
      <p v-if="!posts.length" class="rec-empty">暂无推荐</p>
    </div>
  </aside>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.sidebar {
  position: sticky;
  top: 76px;
}

.rec-card {
  padding: 20px 18px;
  background: #fff;
  border: 1px solid rgb(0 0 0 / 4%);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 3%);
}

.side-heading {
  @include side-heading;

  margin-bottom: 14px;
}

.rec-list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.rec-list li + li {
  margin-top: 4px;
}

.rec-link {
  display: block;
  width: 100%;
  padding: 8px 0;
  font-size: 14px;
  line-height: 1.5;
  color: #404040;
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
  transition: color 0.15s;

  &:hover {
    color: $brand;
  }
}

.rec-empty {
  margin: 0;
  font-size: 13px;
  color: $muted;
}
</style>
