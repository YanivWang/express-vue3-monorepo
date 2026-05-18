import SparkMD5 from "spark-md5";

/** 单块读取大小（Worker 内多路并发读 + 顺序 append；主线程回退沿用同一值） */
export const COMPUTE_FILE_MD5_PART_BYTES = 8 * 1024 * 1024;

export type ComputeFileMd5Result = {
  md5: string;
  /** `performance.now()` 差值，单位 ms（约 0.1ms 精度） */
  durationMs: number;
};

type WorkerToMain =
  | { type: "done"; md5: string; durationMs: number }
  | { type: "error"; message: string };

/** 并行读文件分片时的并发度（≠ MD5 并行：整文件 MD5 必须顺序 update） */
export function md5ReadConcurrency(): number {
  if (typeof navigator === "undefined") return 4;
  const n = navigator.hardwareConcurrency ?? 4;
  return Math.min(Math.max(1, n), 16);
}

async function computeFileMd5MainThread(
  file: File,
  signal: AbortSignal | undefined,
  partSize: number,
): Promise<ComputeFileMd5Result> {
  const t0 = performance.now();
  const spark = new SparkMD5.ArrayBuffer();
  for (let start = 0; start < file.size; start += partSize) {
    if (signal?.aborted) {
      throw new DOMException("aborted", "AbortError");
    }
    const end = Math.min(start + partSize, file.size);
    const buf = await file.slice(start, end).arrayBuffer();
    spark.append(buf);
  }
  const md5 = spark.end();
  const durationMs = Number((performance.now() - t0).toFixed(1));
  return { md5, durationMs };
}

/**
 * 按块读取文件并计算 MD5（小写 hex），避免整文件一次性进内存。
 * 默认在 Web Worker 中：用 `navigator.hardwareConcurrency` 路并发 `arrayBuffer()`，SparkMD5 仍严格按序 `append`。
 */
export async function computeFileMd5(
  file: File,
  signal?: AbortSignal,
): Promise<ComputeFileMd5Result> {
  if (typeof Worker === "undefined") {
    return computeFileMd5MainThread(file, signal, COMPUTE_FILE_MD5_PART_BYTES);
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./computeFileMd5.worker.ts", import.meta.url), {
      type: "module",
    });

    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      worker.terminate();
      fn();
    };

    const onAbort = () => {
      worker.postMessage({ type: "abort" });
      settle(() => reject(new DOMException("aborted", "AbortError")));
    };

    if (signal?.aborted) {
      worker.terminate();
      reject(new DOMException("aborted", "AbortError"));
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });

    worker.onmessage = (ev: MessageEvent<WorkerToMain>) => {
      if (settled) return;
      const d = ev.data;
      if (d.type === "done") {
        settle(() => resolve({ md5: d.md5, durationMs: d.durationMs }));
      } else {
        settle(() =>
          d.message === "AbortError"
            ? reject(new DOMException("aborted", "AbortError"))
            : reject(new Error(d.message)),
        );
      }
    };

    worker.onerror = (ev) => {
      if (settled) return;
      settle(() => reject(ev.error ?? new Error(ev.message)));
    };

    worker.postMessage({
      type: "init",
      file,
      partSize: COMPUTE_FILE_MD5_PART_BYTES,
      readConcurrency: md5ReadConcurrency(),
    });
  });
}

/**
 * 单分片 MD5（小写 hex），与 `PUT` 分片时请求头 `X-Chunk-Md5` 一致；分片 ≤8MB，直接 `arrayBuffer` 即可。
 */
export async function computeChunkMd5(blob: Blob, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) {
    throw new DOMException("aborted", "AbortError");
  }
  const buf = await blob.arrayBuffer();
  if (signal?.aborted) {
    throw new DOMException("aborted", "AbortError");
  }
  const spark = new SparkMD5.ArrayBuffer();
  spark.append(buf);
  return spark.end();
}
