<script setup lang="ts">
import { ref } from "vue";

import { POST_COVER_ACCEPT } from "@/utils/postEditorCover";

defineProps<{
  coverUrl: string | null;
  uploading: boolean;
}>();

const emit = defineEmits<{
  /** 用户选定或拖入了一个文件，校验与上传由上层负责 */
  pick: [file: File];
  remove: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);

function openPicker() {
  inputRef.value?.click();
}

function onInputChange(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  // 先清空再派发：否则连续选同一个文件不会再触发 change
  input.value = "";
  if (file != null) emit("pick", file);
}

function onDrop(ev: DragEvent) {
  ev.preventDefault();
  const file = ev.dataTransfer?.files?.[0];
  if (file != null) emit("pick", file);
}

function onDragOver(ev: DragEvent) {
  ev.preventDefault();
}
</script>

<template>
  <section class="sidebar-card">
    <h2 class="sidebar-card__title">封面图</h2>
    <p class="sidebar-card__desc">可选，用于列表与分享展示</p>
    <input
      ref="inputRef"
      type="file"
      class="cover-file-input"
      :accept="POST_COVER_ACCEPT"
      @change="onInputChange"
    />
    <div v-if="coverUrl" class="cover-preview" @dragover="onDragOver" @drop="onDrop">
      <img class="cover-preview__img" :src="coverUrl" alt="封面预览" />
      <div class="cover-preview__actions">
        <el-button size="small" :loading="uploading" @click="openPicker">更换</el-button>
        <el-button size="small" type="danger" plain @click="$emit('remove')">移除</el-button>
      </div>
    </div>
    <button
      v-else
      type="button"
      class="cover-upload"
      :disabled="uploading"
      @click="openPicker"
      @dragover="onDragOver"
      @drop="onDrop"
    >
      <span class="cover-upload__icon" aria-hidden="true">+</span>
      <span>{{ uploading ? "上传中…" : "点击或拖拽上传" }}</span>
    </button>
    <p class="sidebar-card__hint">建议 1200×630，JPG/PNG，不超过 5MB</p>
  </section>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.sidebar-card {
  @include sidebar-card;
}

.sidebar-card__title {
  @include sidebar-card-title;
}

.sidebar-card__desc {
  @include sidebar-card-desc;
}

.sidebar-card__hint {
  @include sidebar-card-hint;
}

.cover-file-input {
  display: none;
}

.cover-upload {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 120px;
  font-size: 13px;
  color: $text-muted;
  cursor: pointer;
  background: $surface-soft;
  border: 1px dashed rgb(0 0 0 / 10%);
  border-radius: $radius-md;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;

  &:hover:not(:disabled) {
    background: $brand-soft;
    border-color: rgb(234 111 90 / 45%);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.7;
  }
}

.cover-upload__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 20px;
  line-height: 1;
  color: $brand;
  background: $brand-soft;
  border-radius: 50%;
}

.cover-preview {
  overflow: hidden;
  border: 1px solid $stroke;
  border-radius: $radius-md;
}

.cover-preview__img {
  display: block;
  width: 100%;
  max-height: 140px;
  object-fit: cover;
}

.cover-preview__actions {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: $surface-soft;
}
</style>
