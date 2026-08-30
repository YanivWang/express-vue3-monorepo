<script setup lang="ts">
import type { PrimaryKey } from "../types";

/** 一级入口的图标：四个入口各一张线稿，按 key 取用 */
defineProps<{ name: PrimaryKey }>();
</script>

<template>
  <span class="cf__nav-ico" aria-hidden="true">
    <svg v-if="name === 'home'" viewBox="0 0 24 24" width="1em" height="1em">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.75" />
      <path
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        d="M12 7v5l3 3"
      />
    </svg>
    <svg v-else-if="name === 'discover'" viewBox="0 0 24 24" width="1em" height="1em">
      <rect
        x="7"
        y="3"
        width="10"
        height="18"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
      />
      <path fill="currentColor" d="M10 6h4v1.5h-4z" />
    </svg>
    <svg v-else-if="name === 'library'" viewBox="0 0 24 24" width="1em" height="1em">
      <path
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linejoin="round"
        d="M5 9l2-4h10l2 4v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9z"
      />
      <path fill="currentColor" d="M9 20v-5h6v5" />
    </svg>
    <svg v-else viewBox="0 0 24 24" width="1em" height="1em">
      <path
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        d="M8 8l-3 3 3 3M16 8l3 3-3 3M10.5 15.5l3-7"
      />
    </svg>
  </span>
</template>

<style scoped lang="scss">
.cf__nav-ico {
  display: inline-flex;
  margin-right: 6px;
  font-size: 18px;
  color: currentColor;
  opacity: 0.95;

  svg {
    display: block;
  }
}
</style>
