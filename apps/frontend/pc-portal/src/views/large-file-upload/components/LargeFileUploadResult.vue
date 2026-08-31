<script setup lang="ts">
defineProps<{
  errorMessage: string | null;
  resultUrl: string | null;
}>();
</script>

<template>
  <div>
    <!-- 两行都常驻：留空时高度保持不变，出结果时版面不会往下顶 -->
    <p class="large-file-upload-panel__err" role="alert">
      <span v-if="errorMessage">{{ errorMessage }}</span>
    </p>
    <p class="large-file-upload-panel__ok">
      地址：
      <a v-if="resultUrl" :href="resultUrl" target="_blank" rel="noopener noreferrer">{{
        resultUrl
      }}</a>
      <span v-else class="large-file-upload-panel__placeholder">—</span>
    </p>
  </div>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.large-file-upload-panel__err {
  min-height: 1.35em;
  margin: 8px 0 0;
  font-size: 13px;
  color: $danger;
}

.large-file-upload-panel__ok {
  min-height: 1.35em;
  margin: 8px 0 0;
  font-size: 13px;
  word-break: break-all;

  a {
    color: var(--el-color-primary);
  }
}

.large-file-upload-panel__placeholder {
  color: $text-placeholder;
}
</style>
