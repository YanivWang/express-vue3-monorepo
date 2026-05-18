<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, shallowRef } from "vue";

import { useLargeFileUpload } from "../composables/useLargeFileUpload";

function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)} s`;
  }
  return `${Math.round(ms)} ms`;
}

const props = withDefaults(
  defineProps<{
    /** 分片大小（字节），默认 5MB，须在后端 1MB～8MB 范围内 */
    chunkSize?: number;
    concurrency?: number;
    maxRetries?: number;
  }>(),
  {},
);

const emit = defineEmits<{
  success: [
    payload: {
      url: string;
      fileName: string;
      size: number;
      hashDurationMs: number | null;
      uploadTotalDurationMs: number | null;
    },
  ];
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
  lastFile,
  uploadFile,
  retryResume,
  afterPickerSelectedFile,
  progressBarInstanceKey,
  pause,
  resume,
  cancel,
} = useLargeFileUpload({
  chunkSize: props.chunkSize,
  concurrency: props.concurrency,
  maxRetries: props.maxRetries,
});

const md5DurationLabel = computed(() =>
  hashDurationMs.value != null ? formatDuration(hashDurationMs.value) : "—",
);

const totalDurationLabel = computed(() =>
  uploadTotalDurationMs.value != null ? formatDuration(uploadTotalDurationMs.value) : "—",
);

const progressForBar = computed(() => (phase.value === "idle" ? 0 : Math.min(100, progress.value)));

const fileRef = shallowRef<HTMLInputElement | null>(null);
/** 已选、尚未发起或尚未跑完本次上传流程的本地文件 */
const pendingFile = shallowRef<File | null>(null);

function isBusyPickPhase(p: string): boolean {
  return p === "init" || p === "uploading" || p === "merging" || p === "paused";
}

const canPickFile = computed(() => !isBusyPickPhase(phase.value));
const canStartUpload = computed(
  () =>
    pendingFile.value != null &&
    !isBusyPickPhase(phase.value) &&
    (phase.value === "idle" ||
      phase.value === "error" ||
      phase.value === "canceled" ||
      phase.value === "done"),
);

function pickFile() {
  fileRef.value?.click();
}

function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  pendingFile.value = file;
  afterPickerSelectedFile(file);
}

async function onStartUploadClick() {
  const file = pendingFile.value;
  if (!file) return;
  try {
    const { url } = await uploadFile(file);
    ElMessage.success("上传完成");
    pendingFile.value = null;
    emit("success", {
      url,
      fileName: file.name,
      size: file.size,
      hashDurationMs: hashDurationMs.value,
      uploadTotalDurationMs: uploadTotalDurationMs.value,
    });
  } catch (e) {
    if (phase.value === "canceled") {
      ElMessage.info("已取消上传");
      return;
    }
    ElMessage.error(e instanceof Error ? e.message : "上传失败");
    emit("error", e);
  }
}

async function onResumeClick() {
  const snap = lastFile.value;
  try {
    const { url } = await retryResume();
    ElMessage.success("上传完成");
    pendingFile.value = null;
    emit("success", {
      url,
      fileName: snap?.name ?? "",
      size: snap?.size ?? 0,
      hashDurationMs: hashDurationMs.value,
      uploadTotalDurationMs: uploadTotalDurationMs.value,
    });
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "续传失败");
    emit("error", e);
  }
}

function onPauseClick() {
  pause();
}

function onResumePausedClick() {
  resume();
}

function onCancelClick() {
  cancel();
}
</script>

<template>
  <div class="large-file-upload-panel">
    <input ref="fileRef" type="file" class="sr-only" @change="onFileChange" />
    <div class="large-file-upload-panel__actions">
      <el-button type="primary" :disabled="!canPickFile" @click="pickFile"> 选择文件 </el-button>
      <el-button type="success" plain :disabled="!canStartUpload" @click="onStartUploadClick">
        开始上传
      </el-button>
      <el-button v-if="canResume" type="warning" plain @click="onResumeClick"> 断点续传 </el-button>
      <el-button :disabled="phase !== 'uploading'" @click="onPauseClick"> 暂停 </el-button>
      <el-button :disabled="phase !== 'paused'" @click="onResumePausedClick"> 继续 </el-button>
      <el-button
        :disabled="
          phase !== 'uploading' && phase !== 'merging' && phase !== 'init' && phase !== 'paused'
        "
        @click="onCancelClick"
      >
        取消
      </el-button>
    </div>
    <p class="large-file-upload-panel__pending">
      已选：
      <template v-if="pendingFile">
        <strong class="large-file-upload-panel__pending-name">{{ pendingFile.name }}</strong>
        （{{ (pendingFile.size / 1024 / 1024).toFixed(2) }} MB）
      </template>
      <span v-else class="large-file-upload-panel__placeholder">—</span>
    </p>
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
      <el-progress :key="progressBarInstanceKey" :percentage="progressForBar" :stroke-width="10" />
    </div>
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
.large-file-upload-panel {
  padding: 16px;
  background: #fff;
  border: 1px solid #e4e4e4;
  border-radius: 8px;
}

.large-file-upload-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.large-file-upload-panel__pending {
  min-height: 2.6em;
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.4;
  color: #303133;
}

.large-file-upload-panel__pending-name {
  font-weight: 600;
  word-break: break-all;
}

.large-file-upload-panel__metrics {
  min-height: 4.5em;
}

.large-file-upload-panel__phase {
  margin: 0 0 8px;
  font-size: 14px;
  color: #606266;
}

.large-file-upload-panel__hash {
  margin: 0 0 8px;
  font-size: 13px;
  color: #909399;
}

.large-file-upload-panel__metric-value {
  color: #606266;
}

.large-file-upload-panel__placeholder {
  color: #c0c4cc;
}

.large-file-upload-panel__progress-wrap {
  min-height: 22px;
  margin-bottom: 4px;
}

.large-file-upload-panel__err {
  min-height: 1.35em;
  margin: 8px 0 0;
  font-size: 13px;
  color: #f56c6c;
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

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip-path: inset(50%);
}
</style>
