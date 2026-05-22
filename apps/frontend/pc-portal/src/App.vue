<script setup lang="ts">
import { computed } from "vue";
import { RouterView, useRoute } from "vue-router";

import AppShell from "@/components/AppShell.vue";

const route = useRoute();
const useAppShell = computed(() => !route.meta.blankLayout);
</script>

<template>
  <AppShell v-if="useAppShell">
    <RouterView />
  </AppShell>
  <RouterView v-else />
</template>

<style>
html {
  -webkit-font-smoothing: antialiased;
}

html,
body {
  margin: 0;
}

/* PC：正文 14px / 行高约 1.43 */
body {
  font-family:
    -apple-system, blinkmacsystemfont, "SF UI Text", arial, "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif;
  font-size: 14px;
  line-height: 1.4286;
  color: #333;
}

/* Element 组件字体栈与整站一致（字号阶梯沿用 EP 默认，已与简书常用 12–20 档接近） */
:root {
  --el-font-family:
    -apple-system, blinkmacsystemfont, "SF UI Text", arial, "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", "微软雅黑", "WenQuanYi Micro Hei", sans-serif;
}
</style>
