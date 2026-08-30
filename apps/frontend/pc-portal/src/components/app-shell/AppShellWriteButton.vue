<script setup lang="ts">
/** 「写文章」按钮：登录态与未登录态共用，只是点击后的去向不同 */
defineEmits<{ click: [] }>();
</script>

<template>
  <button type="button" class="btn-write" @click="$emit('click')">
    <span class="btn-write__pen" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path
          fill="currentColor"
          d="M4 20.5L4.5 17l10-10 3 3-10 10L4 20.5zm12.2-11.7l-1-1 1.8-1.8a1 1 0 0 1 1.4 0l.6.6a1 1 0 0 1 0 1.4l-1.8 1.8-1-1z"
        />
      </svg>
    </span>
    <span>写文章</span>
  </button>
</template>

<style scoped lang="scss">
@use "./styles/tokens" as *;

.btn-write {
  box-sizing: border-box;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  height: 38px;
  padding: 0 20px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  color: #fff;
  white-space: nowrap;
  cursor: pointer;
  background: $brand;
  border: none;
  border-radius: 999px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
  transition:
    background-color 0.2s ease,
    box-shadow 0.2s ease;

  @include focus-ring(55%);

  &:hover {
    background: $brand-hover;
    box-shadow: 0 2px 6px rgb(234 111 90 / 28%);
  }
}

.btn-write__pen {
  display: inline-flex;
  line-height: 0;
  opacity: 0.95;
}
</style>
