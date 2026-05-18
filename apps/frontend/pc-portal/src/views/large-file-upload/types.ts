import type { HttpRequest } from "@express-vue3-monorepo/shared/request-pc";

/** 与后端 `POST /api/uploads/large/init` 成功体一致（`code/msg` 已由 HttpRequest 剥离） */
export type LargeUploadInitResponse =
  | {
      instant: true;
      publicUrl: string;
      chunkTotal: number;
      expiresAt: string;
    }
  | {
      instant: false;
      uploadId: string;
      chunkTotal: number;
      expiresAt: string;
    };

export type LargeUploadStatusResponse = {
  status: string;
  chunkTotal: number;
  receivedIndices: number[];
  publicUrl?: string;
  /** 任务进行中时由服务端 meta 返回，供续传校验与分片切割 */
  fileName?: string;
  fileSize?: number;
  chunkSize?: number;
};

export type LargeUploadMergeResponse = {
  url: string;
  merged: boolean;
};

export type LargeFileUploadPhase =
  | "idle"
  | "init"
  | "uploading"
  | "paused"
  | "merging"
  | "done"
  | "error"
  | "canceled";

export type LargeFileUploadFileOptions = {
  /**
   * 续传已有任务时传入 `uploadId`（须与 `file` 的 name/size 及服务端 chunkSize 一致）。
   * 新建任务时不要传。
   */
  resumeUploadId?: string;
};

export type LargeFileUploadOptions = {
  /**
   * 默认使用全局 `http`；业务侧可传入带自定义 loading/拦截器的实例
   */
  http?: HttpRequest;
  /** 分片大小（须与后端 1MB～8MB 限制一致），默认 5MB */
  chunkSize?: number;
  /** 分片 HTTP 并发，默认 4 */
  concurrency?: number;
  /** 单片失败重试次数，默认 2 */
  maxRetries?: number;
};
