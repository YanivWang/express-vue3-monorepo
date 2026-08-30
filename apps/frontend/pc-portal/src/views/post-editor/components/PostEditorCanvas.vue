<script setup lang="ts">
import {
  YanivEditor,
  type EditorAppearance,
  type EditorColorMode,
  type EditorMode,
  type EditorPreset,
  type FeatureConfig,
} from "@yanivjs/yaniv-editor";
import "@yanivjs/yaniv-editor/style.css";
import "katex/dist/katex.min.css";
import { ref } from "vue";

import { usePostMediaUpload } from "@/utils/usePostMediaUpload";

defineProps<{
  title: string;
  initialContent: string;
  /** 加载中不挂载编辑器，避免先用空内容初始化一次 */
  loading: boolean;
}>();

const emit = defineEmits<{
  "update:title": [value: string];
  /** 正文有变动（内容不随事件走，宿主用 getHTML 现取） */
  contentChange: [];
}>();

const EDITOR_MODE: EditorMode = "edit";
const EDITOR_PRESET: EditorPreset = "full";
const EDITOR_APPEARANCE: EditorAppearance = "default";
const EDITOR_COLOR_MODE: EditorColorMode = "light";
const EDITOR_FEATURES: FeatureConfig = { ai: false };

const { handleUploadImage, handleUploadVideo } = usePostMediaUpload();

const editorRef = ref<InstanceType<typeof YanivEditor> | null>(null);

/**
 * 正文不进 Vue 响应式（它住在 ProseMirror 内部），
 * 宿主需要时通过这两个方法现取，与拆分前 editorRef 的用法一致。
 */
defineExpose({
  getHTML: (): string => editorRef.value?.getHTML() ?? "",
  getText: (): string => editorRef.value?.getText() ?? "",
  /** 编辑器实例是否已就绪，宿主据此重置脏状态基线 */
  isReady: (): boolean => editorRef.value != null,
});
</script>

<template>
  <article class="post-editor__surface">
    <div class="post-editor__title-zone">
      <el-input
        class="post-editor__title-input"
        maxlength="200"
        show-word-limit
        placeholder="输入标题"
        :model-value="title"
        @update:model-value="emit('update:title', $event)"
      />
    </div>

    <div class="post-editor__title-divider" aria-hidden="true" />

    <section class="post-editor__body yaniv-editor-host">
      <YanivEditor
        v-if="!loading"
        ref="editorRef"
        :mode="EDITOR_MODE"
        :preset="EDITOR_PRESET"
        :appearance="EDITOR_APPEARANCE"
        :color-mode="EDITOR_COLOR_MODE"
        :features="EDITOR_FEATURES"
        locale="zh-CN"
        :initial-content="initialContent"
        :upload-image="handleUploadImage"
        :upload-video="handleUploadVideo"
        @update="emit('contentChange')"
      />
    </section>
  </article>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.post-editor__surface {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: $surface;
  border: 1px solid $stroke;
  border-radius: $radius-lg;
  box-shadow: $shadow-soft;
}

.post-editor__title-zone {
  flex-shrink: 0;
  padding: 20px 24px 12px;
}

.post-editor__title-input :deep(.el-input__wrapper) {
  padding: 0;
  background: transparent;
  border: 0;
  box-shadow: none !important;
}

.post-editor__title-input :deep(.el-input__inner) {
  height: 32px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  color: $text-main;

  &::placeholder {
    font-weight: 400;
    color: #c5cad3;
  }
}

.post-editor__title-input :deep(.el-input__count) {
  font-size: 12px;
  color: $text-muted;
}

.post-editor__title-divider {
  flex-shrink: 0;
  height: 1px;
  margin: 0 24px;
  background: $stroke-subtle;
}

.post-editor__body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.post-editor__body.yaniv-editor-host :deep(.yaniv-editor.document-layout) {
  --ye-footer-bg: #{$surface};
}

@media (width < $narrow) {
  .post-editor__title-zone {
    padding: 16px 16px 10px;
  }

  .post-editor__title-divider {
    margin: 0 16px;
  }

  .post-editor__title-input :deep(.el-input__inner) {
    height: 38px;
    font-size: 22px;
  }
}
</style>
