<script setup lang="ts">
import {
  LARGE_UPLOAD_DEFAULT_CHUNK_BYTES,
  LARGE_UPLOAD_DEFAULT_CONCURRENCY,
  LARGE_UPLOAD_DEFAULT_MAX_RETRIES,
} from "../composables/useLargeFileUpload";
import { useLargeFileUploadPanel } from "../composables/useLargeFileUploadPanel";

import LargeFileUploadActions from "./LargeFileUploadActions.vue";
import LargeFileUploadMetrics from "./LargeFileUploadMetrics.vue";
import LargeFileUploadResult from "./LargeFileUploadResult.vue";

import type { LargeFileUploadSuccess } from "../composables/useLargeFileUploadPanel";

const props = withDefaults(
  defineProps<{
    /** 分片大小（字节），须在后端 1MB～8MB 范围内 */
    chunkSize?: number;
    /** 分片 HTTP 并发数 */
    concurrency?: number;
    /** 单片失败重试次数 */
    maxRetries?: number;
  }>(),
  {
    chunkSize: LARGE_UPLOAD_DEFAULT_CHUNK_BYTES,
    concurrency: LARGE_UPLOAD_DEFAULT_CONCURRENCY,
    maxRetries: LARGE_UPLOAD_DEFAULT_MAX_RETRIES,
  },
);

const emit = defineEmits<{
  success: [payload: LargeFileUploadSuccess];
  error: [unknown];
}>();

const {
  phase,
  progress,
  errorMessage,
  resultUrl,
  hashDurationMs,
  uploadTotalDurationMs,
  canResume,
  progressBarInstanceKey,
  pause,
  resume,
  cancel,
  pendingFile,
  canPickFile,
  canStartUpload,
  canPause,
  canResumePaused,
  canCancel,
  selectFile,
  startUpload,
  resumeUpload,
} = useLargeFileUploadPanel({
  chunkSize: props.chunkSize,
  concurrency: props.concurrency,
  maxRetries: props.maxRetries,
  onSuccess: (payload) => emit("success", payload),
  onError: (e) => emit("error", e),
});
</script>

<template>
  <div class="large-file-upload-panel">
    <LargeFileUploadActions
      :can-pick="canPickFile"
      :can-start="canStartUpload"
      :can-resume="canResume"
      :can-pause="canPause"
      :can-resume-paused="canResumePaused"
      :can-cancel="canCancel"
      @pick="selectFile"
      @start="startUpload"
      @resume="resumeUpload"
      @pause="pause"
      @resume-paused="resume"
      @cancel="cancel"
    />

    <p class="large-file-upload-panel__pending">
      已选：
      <template v-if="pendingFile">
        <strong class="large-file-upload-panel__pending-name">{{ pendingFile.name }}</strong>
        （{{ (pendingFile.size / 1024 / 1024).toFixed(2) }} MB）
      </template>
      <span v-else class="large-file-upload-panel__placeholder">—</span>
    </p>

    <LargeFileUploadMetrics
      :phase="phase"
      :progress="progress"
      :hash-duration-ms="hashDurationMs"
      :upload-total-duration-ms="uploadTotalDurationMs"
      :bar-instance-key="progressBarInstanceKey"
    />

    <LargeFileUploadResult :error-message="errorMessage" :result-url="resultUrl" />
  </div>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.large-file-upload-panel {
  padding: 16px;
  background: #fff;
  border: 1px solid $border;
  border-radius: 8px;
}

.large-file-upload-panel__pending {
  min-height: 2.6em;
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.4;
  color: $text-regular;
}

.large-file-upload-panel__pending-name {
  font-weight: 600;
  word-break: break-all;
}

.large-file-upload-panel__placeholder {
  color: $text-placeholder;
}
</style>
