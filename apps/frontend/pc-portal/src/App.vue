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
html,
body {
  margin: 0;
}
</style>
