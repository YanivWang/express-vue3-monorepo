<script setup lang="ts">
export interface LeafCategoryOption {
  label: string;
  value: number;
}

defineProps<{
  modelValue: number | null;
  options: LeafCategoryOption[];
}>();

defineEmits<{ "update:modelValue": [value: number | null] }>();
</script>

<template>
  <section class="sidebar-card">
    <h2 class="sidebar-card__title">选择栏目</h2>
    <p class="sidebar-card__desc">发布前必须选择二级栏目</p>
    <el-select
      placeholder="请选择栏目"
      filterable
      class="post-editor__select"
      :class="{ 'is-empty': modelValue == null }"
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <el-option v-for="o in options" :key="o.value" :label="o.label" :value="o.value" />
    </el-select>
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

.post-editor__select {
  width: 100%;

  // 未选栏目时描一圈品牌色，提示这是发布必填项
  &.is-empty :deep(.el-select__wrapper) {
    box-shadow: 0 0 0 1px rgb(234 111 90 / 35%) inset;
  }
}

.post-editor__select :deep(.el-select__wrapper) {
  min-height: 38px;
  padding: 0 12px;
  border-radius: $radius-md;
  box-shadow: 0 0 0 1px $stroke inset;
}
</style>
