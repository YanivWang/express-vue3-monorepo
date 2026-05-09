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
