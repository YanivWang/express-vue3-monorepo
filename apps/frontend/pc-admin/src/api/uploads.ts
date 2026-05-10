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

/** 用户头像等：落盘 `/uploads/profiles/…` */
export function uploadProfileImages(files: File[]) {
  const formData = new FormData();
  for (const f of files) {
    formData.append("files", f);
  }
  return http.post<{ urls: string[] }>("/api/uploads/profiles", formData, {
    headers: {
      "Content-Type": undefined,
    },
  });
}
