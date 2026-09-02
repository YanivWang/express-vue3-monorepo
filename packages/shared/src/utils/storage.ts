/**
 * 通用存储工具（localStorage / sessionStorage）
 * - localStorage 支持 JSON 序列化 + 可选过期时间（秒）
 * - sessionStorage 支持 JSON 序列化
 *
 * 访问令牌不再落任何持久化存储（见文件末尾 `createTokenStorage` 的说明），
 * 因此这里也不再有 `tokenKey` 之类的入参；本模块只提供通用存储行为。
 *
 * 原先还有一组 js-cookie 封装，随认证改造一起删除：它最后的消费者就是「把 JWT 写进
 * JS 可读的 Cookie」这一被淘汰的做法。留着它既多背一个运行时依赖，
 * 又等于在 createTokenStorage 旁边摆着一条通往同一个坑的近路。
 * 确有可读 Cookie 需求时，再按当时的场景引入即可。
 */

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
