<script setup lang="ts">
import { shallowRef } from "vue";

defineProps<{
  canPick: boolean;
  canStart: boolean;
  /** 引擎判定本次失败可续传时才出现「断点续传」 */
  canResume: boolean;
  canPause: boolean;
  canResumePaused: boolean;
  canCancel: boolean;
}>();

const emit = defineEmits<{
  pick: [file: File];
  start: [];
  resume: [];
  pause: [];
  "resume-paused": [];
  cancel: [];
}>();

const fileRef = shallowRef<HTMLInputElement | null>(null);

function openPicker() {
  fileRef.value?.click();
}

function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  // 选完立刻清空：否则连着两次挑同一个文件，第二次不会再触发 change
  input.value = "";
  if (!file) return;
  emit("pick", file);
}
</script>

<template>
  <div class="large-file-upload-panel__actions">
    <input ref="fileRef" type="file" class="sr-only" @change="onFileChange" />
    <el-button type="primary" :disabled="!canPick" @click="openPicker"> 选择文件 </el-button>
    <el-button type="success" plain :disabled="!canStart" @click="emit('start')">
      开始上传
    </el-button>
    <el-button v-if="canResume" type="warning" plain @click="emit('resume')"> 断点续传 </el-button>
    <el-button :disabled="!canPause" @click="emit('pause')"> 暂停 </el-button>
    <el-button :disabled="!canResumePaused" @click="emit('resume-paused')"> 继续 </el-button>
    <el-button :disabled="!canCancel" @click="emit('cancel')"> 取消 </el-button>
  </div>
</template>

<style scoped lang="scss">
.large-file-upload-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

// 文件输入框只作为「选择文件」按钮的触发器，不出现在版面上，
// 但仍要留在可访问性树里，故用离屏而不是 display: none。
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
