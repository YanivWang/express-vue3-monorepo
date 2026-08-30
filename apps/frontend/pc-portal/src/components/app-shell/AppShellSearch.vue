<script setup lang="ts">
defineProps<{ modelValue: string }>();

defineEmits<{
  "update:modelValue": [value: string];
  submit: [];
}>();
</script>

<template>
  <form class="top-search" @submit.prevent="$emit('submit')">
    <label class="search">
      <input
        class="search__input"
        type="search"
        placeholder="搜索"
        autocomplete="off"
        aria-label="搜索"
        maxlength="200"
        enterkeyhint="search"
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <button type="submit" class="search__ico" aria-label="搜索">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="#969696" stroke-width="2" />
          <path stroke="#969696" stroke-width="2" stroke-linecap="round" d="M16 16l4 4" />
        </svg>
      </button>
    </label>
  </form>
</template>

<style scoped lang="scss">
@use "./styles/tokens" as *;

.top-search {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  justify-content: center;
  max-width: min(420px, 36vw);
  padding: 0;
  margin: 0;
  border: none;
}

.search {
  position: relative;
  display: block;
  width: 100%;
}

.search__input {
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-width: 200px;
  height: 38px;
  padding: 0 40px 0 16px;
  margin: 0;
  font: inherit;
  font-size: 14px;
  color: $text;
  outline: none;
  background: #f3f3f3;
  border: 1px solid transparent;
  border-radius: 999px;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &::placeholder {
    color: #9a9a9a;
  }

  &:hover {
    background: #eee;
  }

  &:focus {
    background: #fff;
    border-color: rgb(234 111 90 / 40%);
    box-shadow: 0 0 0 3px rgb(234 111 90 / 12%);
  }
}

.search__ico {
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

  @include focus-ring(55%);
}
</style>
