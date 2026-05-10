import { http } from "./http";

import type { CategoryTreeNode } from "./types";

export function fetchCategories() {
  return http.get<{ categories: CategoryTreeNode[] }>("/api/categories");
}

export function createRootCategory(body: { name: string; sortOrder?: number }) {
  return http.post<{ category: CategoryTreeNode }>("/api/admin/categories/roots", body);
}

export function createLeafCategory(body: { parentId: number; name: string; sortOrder: number }) {
  return http.post<{ category: CategoryTreeNode; reused: boolean }>(
    "/api/admin/categories/leaves",
    body,
  );
}

export function patchCategory(id: number, body: Partial<{ name: string; sortOrder: number }>) {
  return http.patch<{ category: CategoryTreeNode }>(`/api/admin/categories/${id}`, body);
}

export function deleteCategory(id: number) {
  return http.delete(`/api/admin/categories/${id}`);
}
