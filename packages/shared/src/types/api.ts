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

/**
 * @deprecated 历史命名；请使用 ApiSuccessJson / ApiFailJson。
 * 与 `@express-vue3-monorepo/request-core` 的 `nested-data` 模式或旧后端一致时为 `{ code, message, data }`
 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/** 用户信息 */
export interface UserInfo {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  email: string;
  phone: string;
  roles: string[];
  permissions: string[];
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
 * 对应 `success(res, \"登录成功\", { token })`
 */
export interface LoginResult {
  token: string;
}

/** @deprecated 旧版双 token 形态；rest-api 当前仅返回 `token` */
export interface LegacyOAuthLoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/** 修改密码请求参数 */
export interface UpdatePasswordParams {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** 后端下发的菜单路由节点（UI 无关描述） */
export interface MenuRoute {
  id: number;
  parentId: number;
  name: string;
  path: string;
  component?: string;
  redirect?: string;
  meta: {
    title: string;
    icon?: string;
    hidden?: boolean;
    keepAlive?: boolean;
    requiresAuth?: boolean;
    permissions?: string[];
    roles?: string[];
    breadcrumb?: string;
    affix?: boolean;
    alwaysShow?: boolean;
  };
  children?: MenuRoute[];
}
