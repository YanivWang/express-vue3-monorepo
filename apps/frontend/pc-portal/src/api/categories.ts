import { http } from "./http";

import type { CategoriesListResult } from "./types";

export function fetchCategories() {
  return http.get<CategoriesListResult>("/api/categories");
}
