import { computed, ref, shallowRef } from "vue";

import { http } from "@/api/http";

import {
  LARGE_UPLOAD_MAX_FILE_BYTES,
  LARGE_UPLOAD_MAX_FILE_MB,
} from "@express-vue3-monorepo/shared/constants";
import type { HttpRequest } from "@express-vue3-monorepo/shared/request-pc";

import { computeChunkMd5, computeFileMd5 } from "../computeFileMd5";
import { createLargeFileUploadApi } from "../largeFileUploadApi";
import {
  clearPendingUploadId,
  readPendingUploadId,
  writePendingUploadId,
} from "../largeUploadPersistence";

import type {
  LargeFileUploadFileOptions,
  LargeFileUploadOptions,
  LargeFileUploadPhase,
  LargeUploadInitResponse,
} from "../types";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const n = items.length;
  if (n === 0) return;
  const c = Math.min(Math.max(1, concurrency), n);

  const runners = Array.from({ length: c }, async () => {
    while (true) {
      const i = next++;
      if (i >= n) break;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { type?: string; status?: number; message?: string };
  if (e.type === "canceled") return false;
  return (
    e.type === "network" ||
    e.type === "timeout" ||
    (typeof e.status === "number" && e.status >= 500)
  );
}

/** 真实分片上传占用的进度区间下界；其上一段 [0, PREP] 留给 MD5 + init 的「准备」动画 */
const UPLOAD_PROGRESS_PREP_FLOOR = 22;

/**
 * MD5 / init 期间条形进度缓慢爬升（指数逼近 PREP），避免长时间停在 0%；返回停止 rAF 的函数。
 */
function startMd5PrepProgress(progress: { value: number }, ceiling: number): () => void {
  const t0 = performance.now();
  /** 越小爬得越快；约 1.1s 到 ~63% ceiling，~2.5s 贴近上限（贴合 ~2.x s 级 MD5 + init） */
  const tauMs = 1100;
  let raf = 0;
  const step = () => {
    const elapsed = performance.now() - t0;
    const p = ceiling * (1 - Math.exp(-elapsed / tauMs));
    progress.value = Math.min(ceiling, Math.round(p * 10) / 10);
    if (progress.value < ceiling - 0.05) {
      raf = requestAnimationFrame(step);
    }
  };
  raf = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(raf);
  };
}

/**
 * 大文件分片上传（init 前计算 MD5 → 并发 PUT 分片 → merge），支持断点续传与全局秒传。
 *
 * **接入业务**：`import { useLargeFileUpload } from "@/views/large-file-upload/composables/useLargeFileUpload"`，
 * 调用 `uploadFile(file)`，成功后得到 `{ url }`（本站 `/uploads/large/...`）。
 * 分片阶段可使用 **`pause` / `resume`**（`phase` 为 `uploading` ↔ `paused`）；**`merging`** 不可暂停。
 * 失败后同一文件可 `retryResume()` 或 `uploadFile(file, { resumeUploadId })`。
 * 同一浏览器内 **`uploadId` 会按文件（名 + 大小 + lastModified）写入 `localStorage`**，
 * 刷新页面后再次选择同一文件将自动尝试续传。
 */
export function useLargeFileUpload(options: LargeFileUploadOptions = {}) {
  const client: HttpRequest = options.http ?? http;
  const api = createLargeFileUploadApi(client);

  const chunkSize = options.chunkSize ?? 5 * 1024 * 1024;
  const concurrency = options.concurrency ?? 4;
  const maxRetries = options.maxRetries ?? 2;

  const phase = ref<LargeFileUploadPhase>("idle");
  const progress = ref(0);
  const errorMessage = ref<string | null>(null);
  const resultUrl = ref<string | null>(null);

  const currentUploadId = shallowRef<string | null>(null);
  const lastFile = shallowRef<File | null>(null);
  const abortRef = shallowRef<AbortController | null>(null);
  const pauseRequested = ref(false);
  /** 本次新建任务时 `computeFileMd5` 耗时（续传/秒传分支不会更新） */
  const hashDurationMs = ref<number | null>(null);
  /**
   * 自 `uploadFile` 被调用起（与点击「开始上传」几乎同一时刻）至本次调用结束的墙钟时间，
   * 含前置校验、MD5、init、分片、merge、暂停等待；校验失败也会记录这段耗时。
   */
  const uploadTotalDurationMs = ref<number | null>(null);
  /** 用于在「完成/取消后重选文件」等场景下重挂载进度条，避免 100%→0 带宽度过渡动画 */
  const progressBarInstanceKey = ref(0);

  const canResume = computed(
    () => phase.value === "error" && currentUploadId.value != null && lastFile.value != null,
  );

  async function waitWhilePaused(ac: AbortController) {
    while (pauseRequested.value) {
      if (ac.signal.aborted) {
        throw new Error("已取消");
      }
      await sleep(50);
    }
    if (ac.signal.aborted) {
      throw new Error("已取消");
    }
  }

  function pause() {
    if (phase.value !== "uploading") return;
    pauseRequested.value = true;
    phase.value = "paused";
  }

  function resume() {
    if (phase.value !== "paused") return;
    pauseRequested.value = false;
    phase.value = "uploading";
  }

  function cancel() {
    pauseRequested.value = false;
    abortRef.value?.abort();
    phase.value = "canceled";
    progress.value = 0;
  }

  /**
   * 文件选择器选定本地文件后调用：清除上一趟「完成/取消」残留在进度条上的 100%，
   * 并在失败状态下区分「同一文件续传」与「换文件重开」。
   */
  function afterPickerSelectedFile(file: File) {
    const prev = lastFile.value;
    const sameAsResumeTask =
      phase.value === "error" &&
      prev != null &&
      prev.name === file.name &&
      prev.size === file.size &&
      prev.lastModified === file.lastModified;

    if (phase.value === "done" || phase.value === "canceled") {
      phase.value = "idle";
      progress.value = 0;
      progressBarInstanceKey.value += 1;
      resultUrl.value = null;
      errorMessage.value = null;
      hashDurationMs.value = null;
      uploadTotalDurationMs.value = null;
      return;
    }

    if (phase.value === "error") {
      progress.value = 0;
      if (sameAsResumeTask) {
        return;
      }
      currentUploadId.value = null;
      lastFile.value = null;
      errorMessage.value = null;
      resultUrl.value = null;
      hashDurationMs.value = null;
      uploadTotalDurationMs.value = null;
      phase.value = "idle";
      progressBarInstanceKey.value += 1;
    }
  }

  async function uploadFile(
    file: File,
    fileOpts: LargeFileUploadFileOptions = {},
  ): Promise<{ url: string }> {
    const ac = new AbortController();
    abortRef.value = ac;
    errorMessage.value = null;
    resultUrl.value = null;
    progress.value = 0;
    hashDurationMs.value = null;
    uploadTotalDurationMs.value = null;

    /** 与「点击开始上传 → 调用 uploadFile」对齐的 Wall time 起点 */
    const uploadT0 = performance.now();

    try {
      if (!file.size) {
        phase.value = "error";
        errorMessage.value = "不能上传空文件";
        throw new Error(errorMessage.value);
      }

      if (file.size > LARGE_UPLOAD_MAX_FILE_BYTES) {
        phase.value = "error";
        errorMessage.value = `文件超过 ${LARGE_UPLOAD_MAX_FILE_MB}MB 上限`;
        throw new Error(errorMessage.value);
      }

      try {
        pauseRequested.value = false;
        phase.value = "init";

        let uploadId: string;
        let status;
        /** 本次是否走过 MD5+init（用于进度条 [PREP,95] 与纯续传 [0,95]） */
        let usePrepProgressBand = false;

        if (fileOpts.resumeUploadId) {
          uploadId = fileOpts.resumeUploadId;
          lastFile.value = file;
          status = await api.getStatus(uploadId);

          if (status.status === "done" && status.publicUrl) {
            clearPendingUploadId(file);
            progress.value = 100;
            phase.value = "done";
            resultUrl.value = status.publicUrl;
            currentUploadId.value = null;
            lastFile.value = null;
            return { url: status.publicUrl };
          }

          if (status.fileName == null || status.fileSize == null || status.chunkSize == null) {
            throw new Error("无法续传：任务缺少文件元信息或已失效");
          }
          if (file.name !== status.fileName || file.size !== status.fileSize) {
            throw new Error("续传须使用与原任务相同的文件（名称与大小一致）");
          }
          currentUploadId.value = uploadId;
        } else {
          currentUploadId.value = null;
          const storedId = readPendingUploadId(file);
          if (storedId) {
            try {
              const probe = await api.getStatus(storedId);
              if (probe.status === "done" && probe.publicUrl) {
                clearPendingUploadId(file);
              } else if (
                probe.fileName != null &&
                probe.fileSize != null &&
                file.name === probe.fileName &&
                file.size === probe.fileSize
              ) {
                return await uploadFile(file, { resumeUploadId: storedId });
              } else {
                clearPendingUploadId(file);
              }
            } catch {
              clearPendingUploadId(file);
            }
          }

          usePrepProgressBand = true;
          const stopMd5Prep = startMd5PrepProgress(progress, UPLOAD_PROGRESS_PREP_FLOOR);
          try {
            const { md5: fileMd5, durationMs: hashMs } = await computeFileMd5(file, ac.signal);
            hashDurationMs.value = hashMs;
            const init: LargeUploadInitResponse = await api.init({
              fileName: file.name,
              fileSize: file.size,
              chunkSize,
              mimeType: file.type || undefined,
              fileMd5,
            });
            if (!init.instant) {
              uploadId = init.uploadId;
              currentUploadId.value = uploadId;
              lastFile.value = file;
              writePendingUploadId(file, uploadId);
              status = await api.getStatus(uploadId);
            } else {
               
              const instantUrl = init.publicUrl;
              clearPendingUploadId(file);
              progress.value = 100;
              phase.value = "done";
              resultUrl.value = instantUrl;
              currentUploadId.value = null;
              lastFile.value = null;
              return { url: instantUrl };
               
            }
          } finally {
            stopMd5Prep();
          }
        }

        const prepFloor = usePrepProgressBand ? UPLOAD_PROGRESS_PREP_FLOOR : 0;
        const prepSpan = usePrepProgressBand ? 95 - UPLOAD_PROGRESS_PREP_FLOOR : 95;

        const effectiveChunkSize = status.chunkSize ?? chunkSize;
        const { chunkTotal } = status;
        const received = new Set(status.receivedIndices ?? []);
        const pending = Array.from({ length: chunkTotal }, (_, i) => i).filter(
          (i) => !received.has(i),
        );

        const initialCompleted = chunkTotal - pending.length;
        progress.value = Math.min(
          95,
          prepFloor + Math.round((initialCompleted / chunkTotal) * prepSpan),
        );

        let completed = 0;
        phase.value = "uploading";

        await runPool(pending, concurrency, async (index) => {
          if (ac.signal.aborted) throw new Error("已取消");
          await waitWhilePaused(ac);

          const start = index * effectiveChunkSize;
          const end = Math.min(start + effectiveChunkSize, file.size);
          const blob = file.slice(start, end);
          const chunkMd5 = await computeChunkMd5(blob, ac.signal);

          let attempt = 0;
          while (true) {
            await waitWhilePaused(ac);
            try {
              await api.putChunk(uploadId, index, blob, chunkMd5, { signal: ac.signal });
              completed += 1;
              progress.value = Math.min(
                95,
                prepFloor + Math.round(((initialCompleted + completed) / chunkTotal) * prepSpan),
              );
              return;
            } catch (e) {
              if (ac.signal.aborted || (e as Error)?.message === "已取消") {
                throw e;
              }
              attempt++;
              if (attempt > maxRetries || !isRetryable(e)) {
                throw e;
              }
              await waitWhilePaused(ac);
              await sleep(500 * attempt);
            }
          }
        });

        if (ac.signal.aborted) {
          phase.value = "canceled";
          throw new DOMException("aborted", "AbortError");
        }

        phase.value = "merging";
        progress.value = 96;
        const merged = await api.merge(uploadId);
        progress.value = 100;
        phase.value = "done";
        resultUrl.value = merged.url;
        clearPendingUploadId(file);
        currentUploadId.value = null;
        lastFile.value = null;
        return { url: merged.url };
      } catch (e) {
        const canceled =
          e instanceof DOMException && e.name === "AbortError"
            ? true
            : (e as Error)?.message === "已取消" || (e as { type?: string })?.type === "canceled";

        const msg = canceled ? "已取消" : e instanceof Error ? e.message : "上传失败";

        if (canceled) {
          phase.value = "canceled";
          errorMessage.value = msg;
          const id = currentUploadId.value;
          if (id) {
            await api.abort(id).catch(() => {});
          }
          clearPendingUploadId(file);
          currentUploadId.value = null;
          lastFile.value = null;
        } else {
          phase.value = "error";
          errorMessage.value = msg;
          /* 非取消失败：保留 currentUploadId / lastFile 以便断点续传 */
        }
        throw e;
      }
    } finally {
      uploadTotalDurationMs.value = Number((performance.now() - uploadT0).toFixed(1));
      pauseRequested.value = false;
      abortRef.value = null;
    }
  }

  async function retryResume(): Promise<{ url: string }> {
    const f = lastFile.value;
    const id = currentUploadId.value;
    if (!f || !id) {
      throw new Error("当前没有可续传的上传任务");
    }
    return uploadFile(f, { resumeUploadId: id });
  }

  return {
    phase,
    progress,
    errorMessage,
    resultUrl,
    hashDurationMs,
    uploadTotalDurationMs,
    currentUploadId,
    lastFile,
    canResume,
    uploadFile,
    retryResume,
    afterPickerSelectedFile,
    progressBarInstanceKey,
    pause,
    resume,
    cancel,
  };
}
