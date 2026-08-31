import { ElMessage } from "element-plus";
import { computed, shallowRef } from "vue";

import { useLargeFileUpload } from "./useLargeFileUpload";

import type { LargeFileUploadPhase } from "../types";

/** 一次上传成功后交给调用方的全部信息 */
export interface LargeFileUploadSuccess {
  url: string;
  fileName: string;
  size: number;
  hashDurationMs: number | null;
  uploadTotalDurationMs: number | null;
}

export interface LargeFileUploadPanelOptions {
  chunkSize: number;
  concurrency: number;
  maxRetries: number;
  onSuccess: (payload: LargeFileUploadSuccess) => void;
  onError: (error: unknown) => void;
}

/** 任务已经在跑的几个阶段：此时既不能重选文件，也不能再发起一次上传 */
function isBusyPhase(phase: LargeFileUploadPhase): boolean {
  return phase === "init" || phase === "uploading" || phase === "merging" || phase === "paused";
}

/**
 * 上传面板的编排层：把 useLargeFileUpload 这台引擎包装成「面板需要的那几个开关」。
 *
 * 引擎只认 phase 这一个状态，而面板要回答的是「此刻哪个按钮能按」；
 * 两者之间的映射就是这里的一组 computed，集中放在一处才好一眼看全整台状态机。
 * 成功与失败经回调交回组件去 emit，composable 因此不必知道自己被谁挂载。
 */
export function useLargeFileUploadPanel(options: LargeFileUploadPanelOptions) {
  const upload = useLargeFileUpload({
    chunkSize: options.chunkSize,
    concurrency: options.concurrency,
    maxRetries: options.maxRetries,
  });

  /** 已选、尚未发起或尚未跑完本次上传流程的本地文件 */
  const pendingFile = shallowRef<File | null>(null);

  const canPickFile = computed(() => !isBusyPhase(upload.phase.value));
  const canStartUpload = computed(
    () =>
      pendingFile.value != null &&
      !isBusyPhase(upload.phase.value) &&
      (upload.phase.value === "idle" ||
        upload.phase.value === "error" ||
        upload.phase.value === "canceled" ||
        upload.phase.value === "done"),
  );
  const canPause = computed(() => upload.phase.value === "uploading");
  const canResumePaused = computed(() => upload.phase.value === "paused");
  const canCancel = computed(() => isBusyPhase(upload.phase.value));

  function selectFile(file: File) {
    pendingFile.value = file;
    // 立刻告诉引擎，好让它提前判断秒传或续传
    upload.afterPickerSelectedFile(file);
  }

  async function startUpload() {
    const file = pendingFile.value;
    if (!file) return;
    try {
      const { url } = await upload.uploadFile(file);
      ElMessage.success("上传完成");
      pendingFile.value = null;
      options.onSuccess({
        url,
        fileName: file.name,
        size: file.size,
        hashDurationMs: upload.hashDurationMs.value,
        uploadTotalDurationMs: upload.uploadTotalDurationMs.value,
      });
    } catch (e) {
      // 用户自己按的取消不是故障：只回执一声，不当错误抛给调用方
      if (upload.phase.value === "canceled") {
        ElMessage.info("已取消上传");
        return;
      }
      ElMessage.error(e instanceof Error ? e.message : "上传失败");
      options.onError(e);
    }
  }

  async function resumeUpload() {
    // 续传用的是引擎记住的那个文件，pendingFile 此时可能已经被清掉了
    const snapshot = upload.lastFile.value;
    try {
      const { url } = await upload.retryResume();
      ElMessage.success("上传完成");
      pendingFile.value = null;
      options.onSuccess({
        url,
        fileName: snapshot?.name ?? "",
        size: snapshot?.size ?? 0,
        hashDurationMs: upload.hashDurationMs.value,
        uploadTotalDurationMs: upload.uploadTotalDurationMs.value,
      });
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : "续传失败");
      options.onError(e);
    }
  }

  return {
    phase: upload.phase,
    progress: upload.progress,
    errorMessage: upload.errorMessage,
    resultUrl: upload.resultUrl,
    hashDurationMs: upload.hashDurationMs,
    uploadTotalDurationMs: upload.uploadTotalDurationMs,
    canResume: upload.canResume,
    progressBarInstanceKey: upload.progressBarInstanceKey,
    pause: upload.pause,
    resume: upload.resume,
    cancel: upload.cancel,
    pendingFile,
    canPickFile,
    canStartUpload,
    canPause,
    canResumePaused,
    canCancel,
    selectFile,
    startUpload,
    resumeUpload,
  };
}
