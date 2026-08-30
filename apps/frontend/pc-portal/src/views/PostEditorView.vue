<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { fetchCategories } from "@/api/categories";
import { fetchPostForEditor } from "@/api/posts";
import type { CategoryTreeNode } from "@/api/types";
import PostEditorActions from "@/views/post-editor/components/PostEditorActions.vue";
import PostEditorCanvas from "@/views/post-editor/components/PostEditorCanvas.vue";
import PostEditorCategoryCard from "@/views/post-editor/components/PostEditorCategoryCard.vue";
import PostEditorChecklist from "@/views/post-editor/components/PostEditorChecklist.vue";
import PostEditorCoverCard from "@/views/post-editor/components/PostEditorCoverCard.vue";
import PostEditorHeader from "@/views/post-editor/components/PostEditorHeader.vue";
import { useEditorRouteScrollLock } from "@/views/post-editor/composables/useEditorRouteScrollLock";
import { usePostEditorCover } from "@/views/post-editor/composables/usePostEditorCover";
import { usePostEditorDraft } from "@/views/post-editor/composables/usePostEditorDraft";
import {
  usePostEditorForm,
  type PostEditorBridge,
} from "@/views/post-editor/composables/usePostEditorForm";
import { usePostEditorSave } from "@/views/post-editor/composables/usePostEditorSave";

/**
 * 写文章 / 编辑文章：只负责编排。
 *
 * 表单与脏状态、本地草稿、封面、保存发布各自成 composable；
 * 顶栏、写作区、侧栏三张卡片各自成组件。
 */

const route = useRoute();
const router = useRouter();

const categories = ref<CategoryTreeNode[]>([]);
/**
 * 只按「取正文」这个接口来引用写作区，而不是它的组件实例类型：
 * ESLint 的类型程序解析不了 .vue SFC，InstanceType<typeof Sfc> 会退化成 any。
 * 依赖接口而非具体组件，本身也是更合适的耦合方向。
 */
const canvasRef = ref<PostEditorBridge | null>(null);

const editId = computed(() => {
  const raw = route.params.id;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
});

const state = usePostEditorForm(() => canvasRef.value);
const { form, coverUrl, editorInitialContent, loading, saving, publishReady } = state;

const draft = usePostEditorDraft(state, editId, () => canvasRef.value);
const cover = usePostEditorCover(state, draft.scheduleAutosave);
const { saveAsDraft, saveAndPublish, leaveEditor } = usePostEditorSave(state, editId);

useEditorRouteScrollLock();

const pageTitle = computed(() => (editId.value != null ? "编辑文章" : "写文章"));
const publishButtonLabel = computed(() => (editId.value != null ? "保存并发布" : "发布"));

/** 只有二级栏目可选，展示为「一级 / 二级」 */
const leafOptions = computed(() => {
  const out: { label: string; value: number }[] = [];
  for (const root of categories.value) {
    for (const leaf of root.children ?? []) {
      out.push({ label: `${root.name} / ${leaf.name}`, value: leaf.id });
    }
  }
  return out;
});

/**
 * 编辑器初始化是异步的，一次同步判断往往拿到的还是空内容。
 * 连判三次（当帧 / 下一 tick / 下一动画帧）覆盖各种就绪时机。
 */
async function refreshEditorBodyStateWhenReady() {
  state.refreshEditorBodyState();
  await nextTick();
  state.refreshEditorBodyState();
  requestAnimationFrame(() => state.refreshEditorBodyState());
}

function onEditorContentChange() {
  state.refreshEditorBodyState();
  state.markDirty();
  draft.scheduleAutosave();
}

onMounted(async () => {
  loading.value = true;
  try {
    const { categories: tree } = await fetchCategories();
    categories.value = tree;

    if (editId.value != null) {
      const p = await fetchPostForEditor(editId.value);
      state.applyPost(p);
      draft.restoreDraftIfNewerThan(editId.value, p.updatedAt);
    } else {
      draft.restoreDraftForNewPost();
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
    await router.push({ name: "mine" });
  } finally {
    loading.value = false;
    await refreshEditorBodyStateWhenReady();
    state.resetDirtyBaseline();
  }
});

// 编辑器是 v-if 挂载的，实例就绪后再校一次正文状态与脏基线
watch(canvasRef, async (canvas) => {
  if (canvas == null || loading.value) return;
  await refreshEditorBodyStateWhenReady();
  state.resetDirtyBaseline();
});
</script>

<template>
  <div v-loading="loading" class="post-editor">
    <PostEditorHeader
      :title="pageTitle"
      :autosave-hint="draft.autosaveHintText.value"
      :saving="saving"
      :publish-ready="publishReady"
      :publish-label="publishButtonLabel"
      @back="leaveEditor"
      @save-draft="saveAsDraft"
      @publish="saveAndPublish"
    />

    <div class="post-editor__workspace">
      <main class="post-editor__main">
        <PostEditorCanvas
          ref="canvasRef"
          v-model:title="form.title"
          :initial-content="editorInitialContent"
          :loading="loading"
          @content-change="onEditorContentChange"
        />
      </main>

      <aside class="post-editor__sidebar" aria-label="发布设置">
        <PostEditorChecklist
          :items="state.checklistItems.value"
          :all-required-done="state.requiredChecklistDone.value"
        />
        <PostEditorCategoryCard v-model="form.categoryId" :options="leafOptions" />
        <PostEditorCoverCard
          :cover-url="coverUrl"
          :uploading="cover.coverUploading.value"
          @pick="cover.uploadCover"
          @remove="cover.removeCover"
        />
      </aside>
    </div>

    <footer class="post-editor__mobile-bar" aria-label="快捷操作">
      <PostEditorActions
        fill
        :saving="saving"
        :publish-ready="publishReady"
        :publish-label="publishButtonLabel"
        @save-draft="saveAsDraft"
        @publish="saveAndPublish"
      />
    </footer>
  </div>
</template>

<style scoped lang="scss">
@use "@/views/post-editor/styles/tokens" as *;

.post-editor {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  background: $surface-soft;
}

.post-editor__workspace {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 16px;
  max-width: $layout-max-width;
  min-height: 0;
  padding: 16px 20px;
  margin: 0 auto;
}

.post-editor__main {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.post-editor__sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
}

.post-editor__mobile-bar {
  display: none;
}

// 窄屏：整页恢复文档流滚动，操作按钮沉到底部固定条
@media (width < $narrow) {
  .post-editor {
    height: auto;
    min-height: 100dvh;
    padding-bottom: 72px;
    overflow: auto;
  }

  .post-editor__workspace {
    grid-template-columns: 1fr;
    padding: 12px 14px;
  }

  .post-editor__main {
    min-height: 58vh;
  }

  .post-editor__sidebar {
    overflow: visible;
  }

  .post-editor__mobile-bar {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 50;
    box-sizing: border-box;
    display: flex;
    gap: 10px;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0));
    background: rgb(255 255 255 / 96%);
    border-top: 1px solid $stroke;
    backdrop-filter: blur(8px);
  }
}
</style>
