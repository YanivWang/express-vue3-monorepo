/** 主题模式 */
export enum ThemeMode {
  LIGHT = "light",
  DARK = "dark",
  SYSTEM = "system",
}

/** 语言类型 */
export enum Language {
  ZH_CN = "zh-CN",
  EN_US = "en-US",
}

/** 本地存储 Key（各 app 可自定义 token key，勿假设全局共用 `access_token`） */
export enum StorageKey {
  /** 仅作占位默认值；pc-portal / pc-admin 分别使用 `pc_portal_access_token`、`pc_admin_access_token` */
  TOKEN = "access_token",
  SIDEBAR = "sidebar_collapsed",
  THEME = "theme_mode",
  LANGUAGE = "language",
}

/** 请求状态码 */
export enum RequestCode {
  SUCCESS = 200,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  SERVER_ERROR = 500,
}

/** 权限控制模式 */
export enum PermissionMode {
  ROLE = "role",
  PERMISSION = "permission",
}

/** 菜单类型 */
export enum MenuType {
  DIRECTORY = "directory",
  MENU = "menu",
  BUTTON = "button",
}

/** Tab 操作类型 */
export enum TabAction {
  CLOSE = "close",
  CLOSE_OTHERS = "closeOthers",
  CLOSE_ALL = "closeAll",
  REFRESH = "refresh",
}

export { H5Host } from "@express-vue3-monorepo/js-bridge";
