<script setup lang="ts">
defineProps<{
  saving: boolean;
  publishReady: boolean;
  /** 新建为「发布」，编辑为「保存并发布」 */
  publishLabel: string;
  /** 底部快捷条里两个按钮要等宽撑满 */
  fill?: boolean;
}>();

defineEmits<{ saveDraft: []; publish: [] }>();
</script>

<template>
  <el-button
    class="post-editor__btn post-editor__btn--ghost"
    :class="{ 'post-editor__btn--fill': fill }"
    :loading="saving"
    @click="$emit('saveDraft')"
  >
    存草稿
  </el-button>
  <el-button
    type="primary"
    class="post-editor__btn post-editor__btn--primary"
    :class="{ 'post-editor__btn--fill': fill }"
    :loading="saving"
    :disabled="!publishReady"
    @click="$emit('publish')"
  >
    {{ publishLabel }}
  </el-button>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.post-editor__btn {
  height: 36px;
  padding: 0 16px;
  margin: 0;
  font-size: 14px;
  border-radius: 999px;
}

.post-editor__btn--ghost {
  color: $text-sub;
  border: 1px solid $stroke;
}

.post-editor__btn--primary {
  font-weight: 600;
  color: #fff;
  background: $brand;
  border: 0;

  &:hover,
  &:focus {
    background: $brand-hover;
  }

  &.is-disabled {
    color: #fff;
    background: rgb(234 111 90 / 45%);
  }
}

.post-editor__btn--fill {
  flex: 1;
}
</style>
