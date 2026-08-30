<script setup lang="ts">
defineProps<{ modelValue: string }>();

defineEmits<{
  "update:modelValue": [value: string];
  submit: [];
}>();
</script>

<template>
  <form class="cf__search-wrap" @submit.prevent="$emit('submit')">
    <label class="cf__search">
      <input
        class="cf__search-input"
        type="search"
        placeholder="搜索"
        autocomplete="off"
        maxlength="200"
        enterkeyhint="search"
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <button type="submit" class="cf__search-ico" aria-label="搜索">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="#969696" stroke-width="2" />
          <path stroke="#969696" stroke-width="2" stroke-linecap="round" d="M16 16l4 4" />
        </svg>
      </button>
    </label>
  </form>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.cf__search-wrap {
  display: flex;
  flex: 0 0 auto;
  justify-content: center;
  padding: 0;
  margin: 0;
  border: none;
}

.cf__search {
  position: relative;
  display: block;
}

.cf__search-input {
  box-sizing: border-box;
  display: block;
  width: 200px;
  height: 38px;
  padding: 0 38px 0 16px;
  margin: 0;
  font: inherit;
  font-size: 14px;
  color: $cf-text;
  outline: none;
  background: $cf-search-bg;
  border: none;
  border-radius: 20px;

  // 聚焦时加宽，给关键词更多可视空间
  transition: width 0.5s ease;

  &::placeholder {
    color: #a0a0a0;
  }

  &:focus {
    width: 260px;
    background: #eee;
  }
}

.cf__search-ico {
  position: absolute;
  top: 50%;
  right: 12px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  margin: 0;
  appearance: none;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 4px;
  transform: translateY(-50%);

  &:focus-visible {
    outline: 2px solid rgb(234 111 90 / 55%);
    outline-offset: 2px;
  }
}
</style>
