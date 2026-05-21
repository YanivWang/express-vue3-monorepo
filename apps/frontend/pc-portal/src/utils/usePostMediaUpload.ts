import { ElMessage } from "element-plus";

import { uploadImages } from "@/api/uploads";
import { useLargeFileUpload } from "@/views/large-file-upload/composables/useLargeFileUpload";

/** 帖子编辑器内图片/视频上传 */
export function usePostMediaUpload() {
  const { uploadFile, phase, progress } = useLargeFileUpload();
  let loadingMsg: ReturnType<typeof ElMessage.info> | null = null;

  async function handleUploadVideo(file: File): Promise<string> {
    if (!/^video\//i.test(file.type)) {
      throw new Error("仅支持视频文件");
    }

    loadingMsg = ElMessage.info({
      message: "视频上传中…",
      duration: 0,
    });

    try {
      const { url } = await uploadFile(file);
      ElMessage.success("视频上传成功");
      return url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "视频上传失败";
      ElMessage.error(msg);
      throw e;
    } finally {
      loadingMsg?.close();
      loadingMsg = null;
    }
  }

  async function handleUploadImage(file: File): Promise<string> {
    const { urls } = await uploadImages([file]);
    const url = urls[0];
    if (!url) throw new Error("上传失败");
    return url;
  }

  return {
    handleUploadImage,
    handleUploadVideo,
    uploadPhase: phase,
    uploadProgress: progress,
  };
}
