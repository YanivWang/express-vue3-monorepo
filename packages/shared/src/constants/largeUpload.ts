/**
 * 大文件分片上传（`/api/uploads/large/*`）与前端 `useLargeFileUpload` 共用的上限。
 * 修改后须同时保证 rest-api、pc-portal 已重新构建/发布。
 */

/** 单文件最大字节数（当前为 1024MB） */
export const LARGE_UPLOAD_MAX_FILE_BYTES = 1024 * 1024 * 1024;

/** 用于提示文案的整数 MB（= 1024） */
export const LARGE_UPLOAD_MAX_FILE_MB = LARGE_UPLOAD_MAX_FILE_BYTES / (1024 * 1024);
