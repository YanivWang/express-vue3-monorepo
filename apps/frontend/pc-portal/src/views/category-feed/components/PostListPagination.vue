<script setup lang="ts">
defineProps<{
  page: number;
  totalPages: number;
}>();

const emit = defineEmits<{
  goPage: [page: number];
}>();
</script>

<template>
  <nav v-if="totalPages > 1" class="cf__pager" aria-label="文章分页">
    <button
      type="button"
      class="cf__pager-btn"
      :disabled="page <= 1"
      @click="emit('goPage', page - 1)"
    >
      上一页
    </button>
    <button
      v-for="p in totalPages"
      :key="p"
      type="button"
      class="cf__pager-num"
      :class="{ 'cf__pager-num--active': p === page }"
      @click="emit('goPage', p)"
    >
      {{ p }}
    </button>
    <button
      type="button"
      class="cf__pager-btn"
      :disabled="page >= totalPages"
      @click="emit('goPage', page + 1)"
    >
      下一页
    </button>
  </nav>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.cf__pager {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: center;
  padding: 28px 0 8px;
  margin-top: 8px;
  border-top: 1px solid $cf-border;
}

.cf__pager-btn {
  padding: 6px 12px;
  font-size: 14px;
  color: $cf-text;
  cursor: pointer;
  background: #fff;
  border: 1px solid $cf-border;
  border-radius: 4px;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;

  &:hover:not(:disabled) {
    color: $cf-primary;
    border-color: rgb(234 111 90 / 0.45);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.cf__pager-num {
  box-sizing: border-box;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  font-size: 14px;
  color: $cf-muted;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  transition:
    color 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    color: $cf-primary;
    background: rgb(234 111 90 / 0.06);
  }
}

.cf__pager-num--active {
  font-weight: 600;
  color: #fff;
  background: $cf-primary;
  border-color: $cf-primary;

  &:hover {
    color: #fff;
    background: #ec6149;
    border-color: #ec6149;
  }
}
</style>
