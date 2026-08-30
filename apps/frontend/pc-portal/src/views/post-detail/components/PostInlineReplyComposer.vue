<script setup lang="ts">
defineProps<{
  modelValue: string;
  /** 被回复者用户名，用于提示与占位文案 */
  replyToName: string;
  /** 楼内回复的回复：少一条分隔线、缩进不同 */
  nested?: boolean;
}>();

defineEmits<{
  "update:modelValue": [value: string];
  cancel: [];
  submit: [];
}>();
</script>

<template>
  <div class="inline-composer" :class="{ 'inline-composer--nested': nested }">
    <div class="inline-hint">
      回复 {{ replyToName }}
      <el-button link type="primary" size="small" @click="$emit('cancel')">取消</el-button>
    </div>
    <el-input
      class="comment-input comment-input--inline"
      type="textarea"
      :rows="3"
      maxlength="5000"
      show-word-limit
      :placeholder="`回复 ${replyToName}…`"
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
    />
    <el-button type="primary" round size="small" class="inline-send" @click="$emit('submit')">
      发布
    </el-button>
  </div>
</template>

<style scoped lang="scss">
@use "../styles/tokens" as *;

.inline-composer {
  padding: 12px 0 4px;
  margin-top: 4px;
  border-top: 1px dashed rgb(234 111 90 / 25%);

  &--nested {
    padding-bottom: 0;
    margin-top: 10px;
    border-top: none;
  }
}

.inline-hint {
  margin-bottom: 8px;
  font-size: 13px;
  color: #666;
}

.comment-input {
  @include comment-input;
}

.comment-input--inline :deep(.el-textarea__inner) {
  min-height: 72px;
  font-size: 14px;
}

.inline-send {
  @include brand-send-button;

  margin-top: 8px;
}
</style>
