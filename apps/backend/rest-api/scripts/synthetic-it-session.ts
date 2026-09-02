/**
 * 合成灌帖的认证会话：集中持有访问令牌，并在它过期时自动续期。
 *
 * 为什么需要这一层：
 * 认证改造把访问令牌从 7 天压到 15 分钟（`ACCESS_TOKEN_TTL_SECONDS`），
 * 而一次合成灌帖要跑 LLM 生成、拉图上传，中间还带限速 sleep，常常远超 15 分钟。
 * 旧写法在开跑前 login 一次，把那枚 JWT 当普通参数一路传到底——令牌一过期，
 * 后续每个请求都 401，而 401 又不属于可重试状态，整场导入就此中断在半途。
 *
 * 因此令牌不再逐层传参（那样也没有任何一处能更新它），而是收在这里：
 * 三个真正发请求的地方统一从这里取 Authorization 头，收到 401 时统一走这里续期后重试。
 *
 * 续期方式是「用同一套账号口令重新登录」。若调用方是通过 `REST_API_IMPORT_TOKEN`
 * 直接给的令牌，这里没有口令可用，也就无从续期——此时如实报出，让使用者知道
 * 该改用账号口令，而不是留下一个跑到一半才失败的坑。
 */

let accessToken = "";
let renewFn: (() => Promise<string>) | null = null;
/** 并发上传同时 401 时，只真正重新登录一次 */
let renewInFlight: Promise<string> | null = null;

export function initImportSession(token: string, renew?: () => Promise<string>): void {
  accessToken = token;
  renewFn = renew ?? null;
  renewInFlight = null;
}

/** 供 fetch 直接使用的 Authorization 头值 */
export function importAuthHeader(): string {
  return `Bearer ${accessToken}`;
}

/**
 * 收到 401 时调用：能续期则续期并返回 true（调用方据此重试本次请求），
 * 否则返回 false（调用方按既有逻辑报错）。
 */
export async function renewImportTokenOnUnauthorized(status: number): Promise<boolean> {
  if (status !== 401) return false;
  if (!renewFn) {
    console.error(
      "[synthetic-it] 访问令牌已过期，但本次运行是用 REST_API_IMPORT_TOKEN 直接指定的令牌，无法自动续期。" +
        "长时间的灌帖请改用 REST_API_IMPORT_USERNAME/PASSWORD 或 ADMIN_BOOTSTRAP_*，以便脚本自行重新登录。",
    );
    return false;
  }

  const renew = renewFn;
  renewInFlight ??= renew().finally(() => {
    renewInFlight = null;
  });

  try {
    accessToken = await renewInFlight;
    console.warn("[synthetic-it] 访问令牌过期，已重新登录并续期，继续导入");
    return true;
  } catch (error) {
    console.error(
      `[synthetic-it] 访问令牌过期后重新登录失败：${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}
