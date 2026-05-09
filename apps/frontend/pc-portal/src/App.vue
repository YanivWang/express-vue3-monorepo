<script setup lang="ts">
import AppShell from "@/components/AppShell.vue";
import { RouterView } from "vue-router";
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
</template>

<style>
html,
body {
  margin: 0;
}
</style>
