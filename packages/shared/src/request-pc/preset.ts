import { ElMessage, ElMessageBox } from "element-plus";

import type {
  ErrorHookContext,
  RequestHooks,
  TokenProvider,
} from "@express-vue3-monorepo/request-core";

export interface PcPresetOptions {
  /** 登录页路径，默认 '/login' */
  loginPath?: string;
  /** 退出登录回调：用户点击"重新登录"后，跳转前执行（如清理 pinia store） */
  onLogout?: () => void | Promise<void>;
  /** 401 弹窗标题/文案自定义 */
  authDialog?: {
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
  };
  /** 错误信息显示时长（ms） */
  errorDuration?: number;
}

/**
 * 创建 PC 端默认 hooks（Element Plus 绑定）：
 * - onError / onBusinessError: ElMessage.error
 * - onUnauthorized: ElMessageBox.confirm → 跳转登录
 */
export function createPcHooks(
  tokenProvider: TokenProvider,
  options: PcPresetOptions = {},
): RequestHooks {
  const { loginPath = "/login", onLogout, authDialog = {}, errorDuration = 3000 } = options;
  const {
    title = "提示",
    message = "登录状态已过期，请重新登录",
    confirmText = "重新登录",
    cancelText = "取消",
  } = authDialog;

  let isAuthDialogOpen = false;
  /** 用户已确认去登录页：阻止并发 401 在跳转完成前再次弹窗 */
  let isRedirectingToLogin = false;

  const normalizePath = (p: string) => {
    const t = p.trim() || "/";
    if (t === "/") return "/";
    return t.replace(/\/+$/, "") || "/";
  };

  const isAlreadyOnLoginPage = () => {
    if (typeof window === "undefined") return false;
    return normalizePath(window.location.pathname) === normalizePath(loginPath);
  };

  const showLoginExpired = async () => {
    if (isRedirectingToLogin || isAlreadyOnLoginPage()) return;
    if (isAuthDialogOpen) return;
    isAuthDialogOpen = true;
    try {
      await ElMessageBox.confirm(message, title, {
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        type: "warning",
      });
      isRedirectingToLogin = true;
      tokenProvider.removeToken();
      await onLogout?.();
      if (typeof window !== "undefined") {
        window.location.replace(loginPath);
      }
    } catch {
      /* 用户取消：不做处理 */
    } finally {
      isAuthDialogOpen = false;
    }
  };

  const showError = (ctx: ErrorHookContext) => {
    const msg = ctx.error?.message;
    if (!msg) return;
    ElMessage.error({ message: msg, duration: errorDuration });
  };

  return {
    onError: showError,
    onBusinessError: showError,
    onUnauthorized: () => {
      void showLoginExpired();
    },
  };
}
