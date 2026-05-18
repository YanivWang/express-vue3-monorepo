<script setup lang="ts">
/**
 * 大文件分片上传演示页：`LargeFileUploadPanel` + 本页内存中的成功历史。
 */

import { ref } from "vue";

import { LARGE_UPLOAD_MAX_FILE_MB } from "@express-vue3-monorepo/shared/constants";

import LargeFileUploadPanel from "./components/LargeFileUploadPanel.vue";


/** 本页内存中的成功记录；刷新即清空；最新在前 */
type SuccessRecord = {
  url: string;
  fileName: string;
  size: number;
  hashDurationMs: number | null;
  uploadTotalDurationMs: number | null;
  at: number;
};

type SuccessPayload = Omit<SuccessRecord, "at">;

const MAX_HISTORY = 100;

const successHistory = ref<SuccessRecord[]>([]);

function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)} s`;
  }
  return `${Math.round(ms)} ms`;
}

function durationOrDash(ms: number | null): string {
  return ms != null ? formatDuration(ms) : "—";
}

function onSuccess(payload: SuccessPayload) {
  const next: SuccessRecord[] = [{ ...payload, at: Date.now() }, ...successHistory.value];
  successHistory.value = next.length > MAX_HISTORY ? next.slice(0, MAX_HISTORY) : next;
}

function formatAt(ts: number): string {
  return new Date(ts).toLocaleString();
}

/** 仅展示用：超过 10 字截断并加 ...，完整名用 title 展示 */
function shortFileName(name: string): string {
  return name.length > 10 ? `${name.slice(0, 10)}...` : name;
}
</script>

<template>
  <div class="large-upload-demo">
    <h1>大文件分片上传（演示）</h1>
    <p class="hint">
      需登录；单文件最大 {{ LARGE_UPLOAD_MAX_FILE_MB }}MB；默认 5MB 分片、并发 4；合并后文件位于
      <code>/uploads/large/…</code>。 请先「选择文件」再点「开始上传」；分片过程中可「暂停 /
      继续」，合并阶段不可暂停。
      上传失败后可用「断点续传」接着传；**刷新页面后只要再选同一文件**（名称、大小、最后修改时间一致），也会自动沿用未完成的
      `uploadId` 续传（依赖 `localStorage`）。
    </p>
    <LargeFileUploadPanel @success="onSuccess" />
    <section v-if="successHistory.length > 0" class="history">
      <h2>历史成功记录</h2>
      <p class="history__note">仅保存在本页内存，刷新后清空；新记录在上。</p>
      <ul class="history__list">
        <li v-for="(row, i) in successHistory" :key="`${row.at}-${i}`" class="history__item">
          <p class="history__meta">
            <span class="history__time">{{ formatAt(row.at) }}</span>
          </p>
          <p class="history__file-name" :title="row.fileName">
            <strong>文件名</strong>：{{ shortFileName(row.fileName) }}
          </p>
          <p>
            <strong>文件大小</strong>：{{ (row.size / 1024 / 1024).toFixed(2) }} MB（{{
              row.size.toLocaleString()
            }}
            字节）
          </p>
          <p><strong>MD5 计算耗时</strong>：{{ durationOrDash(row.hashDurationMs) }}</p>
          <p><strong>上传总耗时</strong>：{{ durationOrDash(row.uploadTotalDurationMs) }}</p>
          <details class="history__url-details">
            <summary class="history__url-summary">显示链接</summary>
            <p class="history__url-body">
              <a :href="row.url" target="_blank" rel="noopener">{{ row.url }}</a>
            </p>
          </details>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped lang="scss">
.large-upload-demo {
  max-width: 720px;
  padding: 24px;
  margin: 0 auto;
}

h1 {
  margin: 0 0 12px;
  font-size: 22px;
}

.hint {
  margin: 0 0 20px;
  font-size: 14px;
  line-height: 1.5;
  color: #606266;

  code {
    padding: 0 4px;
    font-size: 0.95em;
    background: #f5f7fa;
    border-radius: 4px;
  }
}

.history {
  padding: 16px;
  margin-top: 24px;
  background: #f9fafb;
  border-radius: 8px;

  h2 {
    margin: 0 0 8px;
    font-size: 16px;
  }
}

.history__note {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.4;
  color: #909399;
}

.history__list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.history__item {
  padding: 12px 0;
  border-top: 1px solid #ebeef5;

  &:first-child {
    padding-top: 0;
    border-top: none;
  }

  p {
    margin: 6px 0;
    font-size: 14px;
    word-break: break-all;
  }

  a {
    color: var(--el-color-primary);
  }
}

.history__meta {
  margin: 0 0 4px;
}

.history__time {
  font-size: 12px;
  color: #909399;
}

.history__url-details {
  margin: 8px 0 0;
}

.history__url-summary {
  font-size: 14px;
  color: var(--el-color-primary);
  cursor: pointer;
  user-select: none;
}

.history__url-body {
  padding: 8px 0 0;
  margin: 8px 0 0;
  border-top: 1px solid #ebeef5;
}
</style>
