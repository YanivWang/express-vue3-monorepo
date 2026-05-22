/**
 * 与 apps/backend/rest-api 默认 JSON 形态对齐（success / fail；源码见 `src/utils/response.ts`）
 * 具体业务 DTO 在 openapi / 各 app 中扩展
 */

/** 失败体：`fail(res, statusCode, msg)` → `{ code: statusCode, msg }` */
export interface ApiFailJson {
  code: number;
  msg: string;
}

/** 成功体：`success(res, msg, data)` → `{ code: 200, msg, ...data }`（data 扁平展开） */
export type ApiSuccessJson<T extends Record<string, unknown> = Record<string, unknown>> = {
  code: 200;
  msg: string;
} & T;

/** GET /api/me 返回的 `user`（与 docs/openapi.yaml `CurrentUserPayload` 对齐） */
export interface CurrentUserProfile {
  id: number;
  username: string;
  avatar: string | null;
  nickname: string | null;
  roleId?: number;
  roleSlug?: string;
  permissions?: string[];
}

/** 登录请求参数（rest-api：`schema/auth.schema.ts`） */
export interface LoginParams {
  username: string;
  password: string;
}

/** 注册请求参数 */
export interface RegisterParams {
  username: string;
  password: string;
}

/**
 * 登录接口 `POST /api/login` 解包后的载荷（经 `HttpRequest` 去掉 code/msg 后）
 * 对应 `success(res, "登录成功", { token })`
 */
export interface LoginResult {
  token: string;
}

/** GET /api/me 解包后的载荷 */
export interface CurrentUserResult {
  user: CurrentUserProfile;
}
