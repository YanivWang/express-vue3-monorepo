import { filePathToPublicUrl } from "../config/upload.config.js";
import { success } from "../utils/response.js";
import { createHttpError } from "../middlewares/error.middleware.js";

export async function postUploadImages(req, res) {
  const files = req.files;
  if (!files || files.length === 0) {
    throw createHttpError(400, "请选择要上传的图片文件（表单字段名 files）");
  }
  const urls = files.map((f) => filePathToPublicUrl(f.path));
  return success(res, "上传成功", { urls });
}
