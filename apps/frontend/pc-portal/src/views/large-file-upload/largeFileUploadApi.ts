import type { HttpRequest } from "@express-vue3-monorepo/shared/request-pc";

import type {
  LargeUploadInitResponse,
  LargeUploadMergeResponse,
  LargeUploadStatusResponse,
} from "./types";

const reqDefaults = {
  showLoading: false as const,
  showError: false as const,
};

/**
 * 大文件分片上传 API（与 `rest-api` `/api/uploads/large/*` 对齐）。
 * 传入 `HttpRequest` 以便与 `@/api/http` 共享 Token 与统一错误处理。
 */
export function createLargeFileUploadApi(client: HttpRequest) {
  return {
    init(body: {
      fileName: string;
      fileSize: number;
      chunkSize: number;
      mimeType?: string;
      fileMd5: string;
    }): Promise<LargeUploadInitResponse> {
      return client.post<LargeUploadInitResponse>("/api/uploads/large/init", body, {
        ...reqDefaults,
        timeout: 60_000,
      });
    },

    getStatus(uploadId: string): Promise<LargeUploadStatusResponse> {
      return client.get<LargeUploadStatusResponse>(
        `/api/uploads/large/${uploadId}/status`,
        undefined,
        {
          ...reqDefaults,
          timeout: 30_000,
        },
      );
    },

    merge(uploadId: string): Promise<LargeUploadMergeResponse> {
      return client.post<LargeUploadMergeResponse>(
        `/api/uploads/large/${uploadId}/merge`,
        {},
        {
          ...reqDefaults,
          timeout: 300_000,
        },
      );
    },

    abort(uploadId: string): Promise<void> {
      return client.delete(`/api/uploads/large/${uploadId}`, undefined, {
        ...reqDefaults,
        timeout: 30_000,
      });
    },

    /**
     * 上传单个分片：`multipart/form-data` 字段名 **`chunk`**
     */
    async putChunk(
      uploadId: string,
      chunkIndex: number,
      blob: Blob,
      chunkMd5: string,
      config?: { signal?: AbortSignal; onProgress?: (loaded: number, total: number) => void },
    ): Promise<void> {
      const form = new FormData();
      form.append("chunk", blob);
      await client.request<Record<string, unknown>>({
        method: "PUT",
        url: `/api/uploads/large/${uploadId}/chunks/${chunkIndex}`,
        data: form,
        headers: {
          "Content-Type": undefined,
          "X-Chunk-Md5": chunkMd5,
        },
        ...reqDefaults,
        timeout: 180_000,
        signal: config?.signal,
        onUploadProgress: (ev) => {
          if (config?.onProgress && ev.total) {
            config.onProgress(ev.loaded, ev.total);
          }
        },
      });
    },
  };
}

export type LargeFileUploadApi = ReturnType<typeof createLargeFileUploadApi>;
