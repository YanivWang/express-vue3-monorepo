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
import { computed } from "vue";

import type { PostItem } from "@/api/types";

import { authorInitial } from "../formatters";

const props = defineProps<{
  post: PostItem;
  /** 已清洗的正文 HTML */
  bodyHtml: string;
  /** 与详情页共用的加载态：加载中不挂载编辑器，避免拿空内容初始化一次 */
  loading: boolean;
}>();

// 详情页只读，编辑器固定跑在预览模式
const EDITOR_MODE: EditorMode = "preview";
const EDITOR_PRESET: EditorPreset = "full";
const EDITOR_APPEARANCE: EditorAppearance = "default";
const EDITOR_COLOR_MODE: EditorColorMode = "light";
const EDITOR_FEATURES: FeatureConfig = { ai: false };

const initial = computed(() => authorInitial(props.post));
</script>

<template>
  <div class="body">
    <section class="post-body yaniv-editor-host">
      <YanivEditor
        v-if="!loading"
        :key="post.id"
        :mode="EDITOR_MODE"
        :preset="EDITOR_PRESET"
        :appearance="EDITOR_APPEARANCE"
        :color-mode="EDITOR_COLOR_MODE"
        :features="EDITOR_FEATURES"
        locale="zh-CN"
        :initial-content="bodyHtml"
      />
    </section>
  </div>

  <p class="disclaimer">本文观点仅代表作者本人，本站仅提供信息存储空间服务。</p>

  <div class="author-foot">
    <el-avatar :size="52" :src="post.author?.avatar ?? undefined">{{ initial }}</el-avatar>
    <div class="author-foot-text">
      <div class="author-foot-name">{{ post.author?.username ?? "作者" }}</div>
      <div class="author-foot-sub">在本站发布的文章内容</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.body {
  margin-bottom: 28px;
}

.post-body.yaniv-editor-host {
  height: auto;
  min-height: 0;
  overflow: visible;
}

.post-body.yaniv-editor-host :deep(.yaniv-editor.document-layout) {
  --ye-bg-secondary: transparent;
  --ye-doc-page-width: 100%;
  --ye-doc-padding-top: 0;
  --ye-doc-padding-bottom: 0;
  --ye-doc-padding-inline: 0;
  --ye-doc-container-padding-y: 0;

  height: auto;
  min-height: 0;
  overflow: visible;
  background: transparent;
}

.post-body.yaniv-editor-host :deep(.yaniv-editor__workspace),
.post-body.yaniv-editor-host :deep(.document-container) {
  overflow: visible;
}

.disclaimer {
  padding: 16px;
  margin: 0 0 24px;
  font-size: 13px;
  line-height: 1.6;
  color: $muted;
  background: $bg-soft;
  border-radius: 6px;
}

.author-foot {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 20px;
  margin-bottom: 32px;
  background: $bg-soft;
  border: 1px solid $line;
  border-radius: 8px;
}

.author-foot-name {
  margin-bottom: 4px;
  font-size: 16px;
  font-weight: 600;
  color: $text;
}

.author-foot-sub {
  font-size: 13px;
  color: $muted;
}
</style>
