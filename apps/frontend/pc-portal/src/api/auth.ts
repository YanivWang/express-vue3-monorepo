import type { LoginParams, LoginResult, RegisterParams } from "@express-vue3-monorepo/shared/types";

import { http } from "./http";

export function login(body: LoginParams) {
  return http.post<LoginResult>("/api/login", body, { withToken: false });
}

/** 注册成功体可无业务字段，仅 msg。 */
export function register(body: RegisterParams) {
  return http.post<Record<string, never> | undefined>("/api/register", body, { withToken: false });
}
