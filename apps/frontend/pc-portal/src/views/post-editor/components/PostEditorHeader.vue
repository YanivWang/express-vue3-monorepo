<script setup lang="ts">
import PostEditorActions from "./PostEditorActions.vue";

defineProps<{
  title: string;
  autosaveHint: string;
  saving: boolean;
  publishReady: boolean;
  publishLabel: string;
}>();

defineEmits<{ back: []; saveDraft: []; publish: [] }>();
</script>

<template>
  <header class="post-editor__header">
    <div class="post-editor__header-inner">
      <div class="post-editor__header-start">
        <button type="button" class="post-editor__back" @click="$emit('back')">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
          <span>返回</span>
        </button>
        <h1 class="post-editor__heading">{{ title }}</h1>
      </div>

      <div class="post-editor__header-end">
        <p v-if="autosaveHint" class="post-editor__autosave">{{ autosaveHint }}</p>
        <div class="post-editor__header-actions">
          <PostEditorActions
            :saving="saving"
            :publish-ready="publishReady"
            :publish-label="publishLabel"
            @save-draft="$emit('saveDraft')"
            @publish="$emit('publish')"
          />
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.post-editor__header {
  flex-shrink: 0;
  background: $surface;
  border-bottom: 1px solid $stroke;
}

.post-editor__header-inner {
  box-sizing: border-box;
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  max-width: $layout-max-width;
  min-height: 56px;
  padding: 10px 20px;
  margin: 0 auto;
}

.post-editor__header-start {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.post-editor__back {
  display: inline-flex;
  flex-shrink: 0;
  gap: 2px;
  align-items: center;
  padding: 6px 10px 6px 6px;
  font-size: 14px;
  font-weight: 500;
  color: $text-sub;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;

  &:hover {
    color: $brand;
    background: rgb(0 0 0 / 4%);
  }
}

.post-editor__heading {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  color: $text-main;
  white-space: nowrap;
}

.post-editor__header-end {
  display: flex;
  flex-shrink: 0;
  gap: 12px;
  align-items: center;
}

.post-editor__autosave {
  margin: 0;
  font-size: 12px;
  color: $text-muted;
  white-space: nowrap;
}

.post-editor__header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

// 窄屏：顶栏换行，操作按钮改由底部快捷条承担
@media (width < $narrow) {
  .post-editor__header-inner {
    flex-wrap: wrap;
    gap: 10px;
    padding: 10px 14px;
  }

  .post-editor__header-start {
    flex: 1 1 100%;
  }

  .post-editor__header-end {
    flex-wrap: wrap;
    justify-content: space-between;
    width: 100%;
  }

  .post-editor__header-actions {
    display: none;
  }
}
</style>
