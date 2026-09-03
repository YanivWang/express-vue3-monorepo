import multer, { diskStorage } from "multer";

import { createHttpError } from "../middlewares/error.middleware.js";
import { partFileName, syncResolveLargeUploadChunkDir } from "../services/large-upload.service.js";

import type { Request } from "express";

const MAX_CHUNK_BYTES = 8 * 1024 * 1024;

/** 分片上传：字段名 `chunk`，单文件不超过 8MB（须与 init 时 chunkSize 一致且 ≤ 此上限） */
export const largeUploadChunkMulter = multer({
  storage: diskStorage({
    destination(req: Request, _file, cb) {
      // 归属校验放在落盘之前（理由见 syncResolveLargeUploadChunkDir）；抛错要转成 cb 的形式
      try {
        const { uploadId } = req.params;
        const userId = req.user?.id;
        if (typeof userId !== "number") {
          throw createHttpError(401, "未登录或登录已过期");
        }
        cb(null, syncResolveLargeUploadChunkDir(uploadId, userId));
      } catch (error) {
        cb(error instanceof Error ? error : new Error(String(error)), "");
      }
    },
    filename(req: Request, _file, cb) {
      const v = req.validated as { params?: { chunkIndex?: number } } | undefined;
      const idx = v?.params?.chunkIndex ?? Number(req.params.chunkIndex);
      cb(null, partFileName(idx));
    },
  }),
  limits: { fileSize: MAX_CHUNK_BYTES },
}).single("chunk");
