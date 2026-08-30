import { ElMessage } from "element-plus";
import { ref } from "vue";

import { uploadImages } from "@/api/uploads";
import { validateCoverFile } from "@/utils/postEditorCover";

import type { PostEditorFormState } from "./usePostEditorForm";

/**
 * 封面图的校验与上传。
 *
 * 选文件、拖拽这些交互细节归封面卡片组件（它拿着 input 元素），
 * 这里只处理「拿到 File 之后怎么办」。
 */
export function usePostEditorCover(state: PostEditorFormState, scheduleAutosave: () => void) {
  const coverUploading = ref(false);

  async function uploadCover(file: File) {
    const err = validateCoverFile(file);
    if (err != null) {
      ElMessage.warning(err);
      return;
    }
    coverUploading.value = true;
    try {
      const { urls } = await uploadImages([file]);
      const url = urls[0];
      if (url == null || url === "") throw new Error("上传失败");
      state.coverUrl.value = url;
      state.markDirty();
      scheduleAutosave();
      ElMessage.success("封面上传成功");
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : "封面上传失败");
    } finally {
      coverUploading.value = false;
    }
  }

  function removeCover() {
    state.coverUrl.value = null;
    state.markDirty();
    scheduleAutosave();
  }

  return { coverUploading, uploadCover, removeCover };
}
