import Cookies from "js-cookie";

/**
 * 通用存储工具（Cookie / localStorage / sessionStorage）
 * - Cookie 基于 js-cookie，仅适用于可被 JavaScript 读写的 Cookie；HttpOnly 需由服务端 Set-Cookie，本模块无法读写
 * - localStorage 支持 JSON 序列化 + 可选过期时间（秒）
 * - sessionStorage 支持 JSON 序列化
 *
 * 具体 key 由消费方（如 pc-portal / pc-admin 的 `tokenKey`）传入 `createTokenStorage`。
 * 本模块只提供行为。Token 封装保留可直接按 key 调用的顶层 API，方便 request 包使用。
 */

// ────────────────────────────────────────────────────────────
//  Cookie 通用 API
// ────────────────────────────────────────────────────────────

export const cookie = {
  get: (key: string) => Cookies.get(key),
  set: (key: string, value: string, expires = 1) => Cookies.set(key, value, { expires }),
  remove: (key: string) => Cookies.remove(key),
};

// ────────────────────────────────────────────────────────────
//  localStorage 封装（带 JSON + 过期 TTL）
// ────────────────────────────────────────────────────────────

interface StorageItem<T> {
  value: T;
  /** 过期时间戳（ms），undefined 表示永不过期 */
  expire?: number;
}

/**
 * 设置 localStorage 数据
 * @param key 存储 key
 * @param value 存储值
 * @param ttl 过期时长（秒），不传则永久存储
 */
export function lsSet<T>(key: string, value: T, ttl?: number): void {
  if (typeof localStorage === "undefined") return;
  const item: StorageItem<T> = {
    value,
    expire: ttl ? Date.now() + ttl * 1000 : undefined,
  };
  localStorage.setItem(key, JSON.stringify(item));
}

/** 获取 localStorage 数据，过期自动删除并返回 null */
export function lsGet<T>(key: string): T | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const item = JSON.parse(raw) as StorageItem<T>;
    if (item.expire !== undefined && Date.now() > item.expire) {
      localStorage.removeItem(key);
      return null;
    }
    return item.value;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function lsRemove(key: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(key);
}

export function lsClear(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.clear();
}

// ────────────────────────────────────────────────────────────
//  sessionStorage 封装
// ────────────────────────────────────────────────────────────

export function ssSet<T>(key: string, value: T): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify(value));
}

export function ssGet<T>(key: string): T | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function ssRemove(key: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(key);
}

export function ssClear(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.clear();
}

// ────────────────────────────────────────────────────────────
//  Token Helper Factory（传入 key 以创建独立实例）
// ────────────────────────────────────────────────────────────

export interface TokenStorage {
  getToken(): string | undefined;
  setToken(token: string): void;
  removeToken(): void;
}

/**
 * 访问令牌存储：只存在于内存中。
 *
 * 为什么不再落 Cookie / localStorage：
 * 旧实现把 7 天有效的 JWT 写进一个 JS 可读、且没有 Secure / SameSite 的 Cookie，
 * 一次 XSS 就足以把凭证带走并冒用一周。凡是 JS 读得到的地方，XSS 就读得到——
 * 换成 localStorage 也一样，唯一的区别只是攻击者少敲几个字符。
 *
 * 现在访问令牌短时效（默认 15 分钟）且只驻留内存：刷新页面即丢失，
 * 会话的延续交给服务端下发的 HttpOnly 刷新令牌 Cookie（JS 完全接触不到），
 * 由 `POST /api/auth/refresh` 静默换取新的访问令牌。
 */
export function createTokenStorage(): TokenStorage {
  let accessToken: string | undefined;
  return {
    getToken: () => accessToken,
    setToken: (token) => {
      accessToken = token;
    },
    removeToken: () => {
      accessToken = undefined;
    },
  };
}
