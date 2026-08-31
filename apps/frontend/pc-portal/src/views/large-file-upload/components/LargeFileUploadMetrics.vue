<script setup lang="ts">
import { computed } from "vue";

import { formatOptionalDuration } from "../formatters";

import type { LargeFileUploadPhase } from "../types";

const props = defineProps<{
  phase: LargeFileUploadPhase;
  progress: number;
  hashDurationMs: number | null;
  uploadTotalDurationMs: number | null;
  /** 变化时重挂进度条，避免 100% → 0 时出现一段倒着走的宽度动画 */
  barInstanceKey: number;
}>();

const md5DurationLabel = computed(() => formatOptionalDuration(props.hashDurationMs));
const totalDurationLabel = computed(() => formatOptionalDuration(props.uploadTotalDurationMs));

// 空闲态一律归零：上一轮跑完留下的 100% 不该出现在下一次的起点上
const progressForBar = computed(() => (props.phase === "idle" ? 0 : Math.min(100, props.progress)));
</script>

<template>
  <div>
    <div class="large-file-upload-panel__metrics" aria-live="polite">
      <p class="large-file-upload-panel__phase">状态：{{ phase }}</p>
      <p class="large-file-upload-panel__hash">
        MD5 计算耗时：<span class="large-file-upload-panel__metric-value">{{
          md5DurationLabel
        }}</span>
      </p>
      <p class="large-file-upload-panel__hash">
        总共耗时（开始至结束）：<span class="large-file-upload-panel__metric-value">{{
          totalDurationLabel
        }}</span>
      </p>
    </div>
    <div class="large-file-upload-panel__progress-wrap">
      <el-progress :key="barInstanceKey" :percentage="progressForBar" :stroke-width="10" />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.large-file-upload-panel__metrics {
  min-height: 4.5em;
}

.large-file-upload-panel__phase {
  margin: 0 0 8px;
  font-size: 14px;
  color: $text-secondary;
}

.large-file-upload-panel__hash {
  margin: 0 0 8px;
  font-size: 13px;
  color: $text-muted;
}

.large-file-upload-panel__metric-value {
  color: $text-secondary;
}

.large-file-upload-panel__progress-wrap {
  min-height: 22px;
  margin-bottom: 4px;
}
</style>
