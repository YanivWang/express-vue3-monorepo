import { http } from "./http";

export function uploadImages(files: File[]) {
  const formData = new FormData();
  for (const f of files) {
    formData.append("files", f);
  }
  return http.post<{ urls: string[] }>("/api/uploads", formData, {
    headers: {
      "Content-Type": undefined,
    },
  });
}

/** 用户头像：`POST /api/uploads/profiles`，单次仅 1 个文件（多传时只取第一张），最大 8MB */
export function uploadProfileImages(files: File[]) {
  const formData = new FormData();
  for (const f of files.slice(0, 1)) {
    formData.append("files", f);
  }
  return http.post<{ urls: string[] }>("/api/uploads/profiles", formData, {
    headers: {
      "Content-Type": undefined,
    },
  });
}
