/**
 * 刷新令牌：不透明、服务端可撤销、每次使用即轮换，并带重放检测。
 *
 * 为什么不能只靠一枚长效 JWT：
 * JWT 一经签发就无法收回，只能等它自然过期。改造前访问令牌有效期 7 天，
 * 意味着凭证一旦泄露，攻击者就拥有一周的完整账号权限，而系统既察觉不到、也阻止不了。
 *
 * 这里的取舍：
 * - 令牌本身不透明（不是 JWT），校验必须回到服务端，因此「撤销」是真的能生效的；
 * - 明文只在签发那一刻存在，Redis 只保存 SHA-256 摘要，库被读走也无法直接冒用；
 * - 每次刷新都轮换：旧令牌立刻失效，泄露窗口从「整个有效期」缩短到「下一次刷新之前」；
 * - 重放检测：一枚已经用过的刷新令牌再次出现，通常意味着它被复制走了。
 *   此时撤销整个令牌家族（强制重新登录），而不是听任攻击者与真实用户并行持有会话。
 *
 * 但「用过的令牌再次出现」还有一种完全无辜的成因：同一个浏览器的多个标签页
 * （乃至同源部署的门户与管理端两个前端，它们共用同一枚刷新 Cookie）在同一瞬间
 * 拿着同一枚令牌去刷新。若一律按重放处理，用户什么都没做错却被强制登出——
 * 这是轮换式刷新最常见的线上事故。因此轮换后留一段极短的宽限窗口
 * （REFRESH_ROTATION_GRACE_SECONDS，可设 0 关闭）：窗口内视为并发竞态。
 *
 * 关键在于窗口内**返回什么**：必须是当初已经发出去的那一枚（幂等重放），
 * 而不是每次都补发一枚新的。后者会把宽限窗口变成铸币机——一枚已用令牌重放 N 次
 * 就能铸出 N 条同时有效、彼此独立的令牌链，攻击者只要在窗口内刷一次，
 * 就能开出一条与受害者并行、且此后再也不会触发重放检测的会话。
 * 为此每次轮换都把继任令牌放进「信箱」（SUCCESSOR_KEY_PREFIX，TTL = 宽限窗口），
 * 窗口内的重复提交一律从信箱里取同一枚；窗口外仍旧判定为重放并撤销家族。
 *
 * 信箱同时承担第二个职责：它的 `SET ... NX` 就是并发轮换的**单赢家选举**。
 * 没有它，两个并发请求会双双签发，一枚令牌当场分叉成两条有效链（见 rotateLiveToken）。
 *
 * 无论走哪条路径，都必须先验证令牌明文里的 secret。tokenId 只是定位用的，
 * 它会出现在日志与运维视野里；若仅凭 tokenId 就能触发「撤销家族」，
 * 任何拿到过一条日志的人都能把别人的会话踢下线。
 */
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import {
  REFRESH_ROTATION_GRACE_SECONDS,
  REFRESH_SESSION_ABSOLUTE_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "../env.js";
import { createInternalServerError } from "../middlewares/error.middleware.js";
import { redis } from "../redis.js";
import { logger } from "../utils/logger.js";

/** 单条刷新令牌记录 */
const TOKEN_KEY_PREFIX = "auth:refresh:token:";
/** 令牌家族：一次登录派生出的所有轮换令牌，用于整体撤销 */
const FAMILY_KEY_PREFIX = "auth:refresh:family:";
/** 已使用令牌的墓碑，用于识别重放 */
const USED_KEY_PREFIX = "auth:refresh:used:";
/** 家族撤销墓碑：阻止「已在飞行中的刷新」把刚被撤销的家族重新种回来 */
const REVOKED_FAMILY_KEY_PREFIX = "auth:refresh:revoked-family:";
/**
 * 用户 → 令牌家族索引。
 *
 * 没有它就答不出「这个用户现在有哪些会话」，于是「改密码后踢掉所有设备」「封号即刻生效」
 * 这类操作全都做不到——只能等刷新令牌自己过期（默认 7 天）。
 * 从 token 能找到 family，但从 user 找不到 family，缺的就是这一条反向边。
 */
const USER_FAMILIES_KEY_PREFIX = "auth:refresh:user-families:";
/**
 * 家族的创建时刻（epoch 毫秒），用于绝对会话寿命上限。
 *
 * 刷新令牌每轮换一次就重置一次有效期，是纯滑动过期：只要有人（哪怕是攻击者）
 * 保持每周至少刷新一次，这个会话就能无限期存活下去，永远等不到「自然过期」。
 * 所以在滑动窗口之上再压一条硬线，见 REFRESH_SESSION_ABSOLUTE_TTL_SECONDS。
 */
const FAMILY_BORN_KEY_PREFIX = "auth:refresh:family-born:";
/**
 * 继任者信箱：某枚令牌被轮换掉时，它换出的那一枚新令牌在这里存放一小段时间。
 * 既是并发轮换的单赢家选举点，也是宽限窗口内重复提交时要原样返回的那一枚。
 * TTL 即宽限窗口，因此明文继任令牌只在这几秒内存在，且取走它必须先证明持有前一枚的 secret。
 */
const SUCCESSOR_KEY_PREFIX = "auth:refresh:successor:";

/** 墓碑保留时间：覆盖住「令牌被复制后延迟重放」的现实窗口即可，无需与令牌等长 */
const USED_TOMBSTONE_TTL_SECONDS = 24 * 60 * 60;

interface StoredRefreshToken {
  userId: number;
  familyId: string;
  /** 只存摘要，不存明文 */
  secretHash: string;
}

/**
 * 轮换后留下的墓碑。
 * 同样带上 secretHash：无论后续被判成并发竞态还是重放，都要先证明来者确实持有原令牌。
 */
interface RefreshTokenTombstone {
  userId: number;
  familyId: string;
  secretHash: string;
  /**
   * 轮换发生的时刻（epoch 毫秒）。
   *
   * 仅供排查取证（「这枚令牌是什么时候被换掉的」）。宽限窗口**不再**由它计算——
   * 那会引入一次时钟运算，而窗口本身已经由继任者信箱的 TTL 精确表达：
   * 信箱在，就在窗口内；信箱没了，就在窗口外。少一处可能对不上的判据。
   */
  rotatedAt: number;
}

export interface IssuedRefreshToken {
  /** 下发给客户端的明文，形如 `<tokenId>.<secret>` */
  token: string;
  expiresInSeconds: number;
}

/** issueInFamily 的内部返回：多带上定位信息，便于「签发了但最终没交付」时精确撤回 */
interface IssuedToken {
  tokenId: string;
  familyId: string;
  issued: IssuedRefreshToken;
}

function tokenKey(tokenId: string) {
  return `${TOKEN_KEY_PREFIX}${tokenId}`;
}
function familyKey(familyId: string) {
  return `${FAMILY_KEY_PREFIX}${familyId}`;
}
function usedKey(tokenId: string) {
  return `${USED_KEY_PREFIX}${tokenId}`;
}
function revokedFamilyKey(familyId: string) {
  return `${REVOKED_FAMILY_KEY_PREFIX}${familyId}`;
}
function successorKey(tokenId: string) {
  return `${SUCCESSOR_KEY_PREFIX}${tokenId}`;
}
function userFamiliesKey(userId: number) {
  return `${USER_FAMILIES_KEY_PREFIX}${String(userId)}`;
}
function familyBornKey(familyId: string) {
  return `${FAMILY_BORN_KEY_PREFIX}${familyId}`;
}

/**
 * 原子占位：只有键不存在时才写入，返回是否写成功。
 *
 * 这是整套轮换里唯一的互斥原语。`SET ... NX` 由 Redis 单线程保证原子性，
 * 因此并发请求中有且只有一个会拿到 `true`——不需要 Lua，也不需要额外依赖。
 * 输了的一方能确定「键里已经有值」，于是可以直接去读，不必轮询等待赢家写完。
 */
async function claim(key: string, value: string, options: { EX: number }): Promise<boolean> {
  const reply = await redis.set(key, value, { ...options, NX: true });
  return reply !== null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** 定长比较，避免按字符提前返回泄露信息 */
function hashesEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** 明文格式：`<tokenId>.<secret>`；tokenId 用于定位记录，secret 用于校验 */
function parseToken(raw: string): { tokenId: string; secret: string } | null {
  const idx = raw.indexOf(".");
  if (idx <= 0 || idx === raw.length - 1) return null;
  return { tokenId: raw.slice(0, idx), secret: raw.slice(idx + 1) };
}

/** 解析 Redis 里的 JSON 记录；内容损坏时按「记录不存在」处理，不让一条脏数据打崩刷新链路 */
function parseJson<T>(raw: string | null): T | null {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * 签发一枚刷新令牌并登记进指定家族；家族已被撤销时返回 null。
 *
 * 「写完再验墓碑」而不是「先验墓碑再写」，是为了封住登出与刷新的并发：
 * 撤销的顺序是**先立墓碑、再清理成员**，于是两种交错都被覆盖——
 * 在立碑之前写入的令牌，会被撤销的清理阶段删掉；在立碑之后写入的，一定看得到碑，于是自己回滚。
 * 反过来写（先验后写）留下的正是最要命的那条缝：验的时候还没撤销，写的时候已经撤销完了，
 * 于是登出成功、SADD 却把家族集合重新建了起来，用户手上留着一枚 7 天有效、谁都不知道的活令牌。
 */
async function issueInFamily(userId: number, familyId: string): Promise<IssuedToken | null> {
  const tokenId = randomUUID();
  // randomUUID 提供 122 位熵，足以作为不可猜测的密钥部分；两段拼接后仍是一次性凭证
  const secret = `${randomUUID()}${randomUUID()}`.replace(/-/g, "");

  const record: StoredRefreshToken = { userId, familyId, secretHash: sha256(secret) };

  await redis.set(tokenKey(tokenId), JSON.stringify(record), { EX: REFRESH_TOKEN_TTL_SECONDS });
  await redis.sAdd(familyKey(familyId), tokenId);
  await redis.expire(familyKey(familyId), REFRESH_TOKEN_TTL_SECONDS);

  if (await familyIsRevoked(familyId)) {
    await discardIssued(tokenId, familyId);
    return null;
  }

  return {
    tokenId,
    familyId,
    issued: { token: `${tokenId}.${secret}`, expiresInSeconds: REFRESH_TOKEN_TTL_SECONDS },
  };
}

/** 撤回一枚刚刚签发、但最终没有被交付出去的令牌 */
async function discardIssued(tokenId: string, familyId: string): Promise<void> {
  await redis.del(tokenKey(tokenId));
  // 空集合会被 Redis 自动删除，无需再显式删家族键
  await redis.sRem(familyKey(familyId), tokenId);
}

/** 登录时调用：开启一个新的令牌家族 */
export async function issueRefreshToken(userId: number): Promise<IssuedRefreshToken> {
  const familyId = randomUUID();

  /**
   * 两条索引必须在签发**之前**写好，否则会留下一个「已经能用、但登记表上查不到」的会话——
   * 那正是 revokeAllSessionsForUser 想踢却踢不掉的那一种。
   * 反过来先写索引后签发失败，最多留下一条指向空家族的悬空记录，撤销时无害。
   */
  await redis.sAdd(userFamiliesKey(userId), familyId);
  await redis.expire(userFamiliesKey(userId), sessionIndexTtlSeconds());
  await redis.set(familyBornKey(familyId), String(Date.now()), {
    EX: sessionIndexTtlSeconds(),
  });

  const created = await issueInFamily(userId, familyId);
  if (!created) {
    // 家族 id 是此刻新生成的 UUID，不可能已被撤销；真触发说明有更深的问题
    throw createInternalServerError("刷新令牌签发失败：新建的令牌家族竟已被标记为撤销");
  }
  return created.issued;
}

/**
 * user→family 索引与家族出生记录的保留时长。
 *
 * 取「滑动有效期」与「绝对上限」中较长的那个：短了会让索引先于会话消失，
 * 于是出现「会话还活着，但撤销时找不到它」——比没有索引更糟，因为运维会以为已经踢干净了。
 */
function sessionIndexTtlSeconds(): number {
  return Math.max(REFRESH_TOKEN_TTL_SECONDS, REFRESH_SESSION_ABSOLUTE_TTL_SECONDS);
}

/**
 * 家族是否已超出绝对会话寿命。
 *
 * 滑动过期单独用是有洞的：每次轮换都重置有效期，所以只要有人保持每周刷新一次，
 * 会话就能无限期续下去——包括拿着被盗令牌、且恰好没触发重放检测的那个人。
 * 绝对上限给每次登录压一条硬线：到点必须重新走一次真正的身份认证。
 * 设 0 关闭（退回纯滑动过期）。
 */
async function familyExceededAbsoluteLifetime(familyId: string): Promise<boolean> {
  if (REFRESH_SESSION_ABSOLUTE_TTL_SECONDS <= 0) return false;

  const bornRaw = await redis.get(familyBornKey(familyId));
  // 出生记录缺失（早于本特性上线的会话，或已被清理）：不据此踢人，交给滑动有效期收尾
  if (bornRaw === null) return false;

  const bornAt = Number(bornRaw);
  if (!Number.isFinite(bornAt)) return false;

  return Date.now() - bornAt > REFRESH_SESSION_ABSOLUTE_TTL_SECONDS * 1000;
}

/**
 * 踢掉某个用户的**全部**会话（所有设备、所有标签页）。
 *
 * 用在「凭证或授权发生了变化，此前发出的一切都不该再作数」的时刻：
 * 管理员重置密码、撤销后台身份、删除账号。这些操作若不撤销会话，
 * 旧凭证最长还能再用满一个刷新周期（默认 7 天），改密码因此形同虚设。
 *
 * 返回实际撤销的家族数，便于审计日志如实记录「这次踢掉了几个会话」。
 */
export async function revokeAllSessionsForUser(userId: number): Promise<number> {
  const familyIds = await redis.sMembers(userFamiliesKey(userId));
  for (const familyId of familyIds) {
    await revokeRefreshFamily(familyId);
  }
  await redis.del(userFamiliesKey(userId));

  if (familyIds.length > 0) {
    logger.info("refresh_sessions_revoked_for_user", {
      userId,
      revokedFamilies: familyIds.length,
      message: "已撤销该用户的全部刷新令牌家族，其所有设备需要重新登录",
    });
  }
  return familyIds.length;
}

/**
 * 撤销整个家族（登出，或检测到重放时）。
 * 墓碑必须**先于**清理写下，理由见 issueInFamily；TTL 取令牌有效期，
 * 覆盖住任何可能与本次撤销并发的签发。
 */
export async function revokeRefreshFamily(familyId: string): Promise<void> {
  await redis.set(revokedFamilyKey(familyId), "1", { EX: REFRESH_TOKEN_TTL_SECONDS });

  const tokenIds = await redis.sMembers(familyKey(familyId));
  if (tokenIds.length > 0) {
    await redis.del(tokenIds.map(tokenKey));
  }
  await redis.del(familyKey(familyId));
  await redis.del(familyBornKey(familyId));
}

async function familyIsRevoked(familyId: string): Promise<boolean> {
  return (await redis.exists(revokedFamilyKey(familyId))) === 1;
}

/** 家族是否仍然存活；已被撤销（登出 / 重放）的家族不能靠宽限窗口复活 */
async function familyIsAlive(familyId: string): Promise<boolean> {
  if (await familyIsRevoked(familyId)) return false;
  return (await redis.exists(familyKey(familyId))) === 1;
}

export type RefreshOutcome =
  | { status: "rotated"; userId: number; next: IssuedRefreshToken }
  /** 令牌无效、过期，或已被撤销 */
  | { status: "invalid" }
  /** 检测到重放：家族已被撤销，必须重新登录 */
  | { status: "reused" };

/**
 * 校验并轮换刷新令牌。
 * 成功时旧令牌立即失效，调用方须把返回的新令牌写回 Cookie。
 *
 * 整条链路只有**一个**竞态点：同一枚令牌被多个请求同时提交。它必须有唯一赢家，
 * 否则一枚令牌会分叉出多条彼此独立、且都有效的令牌链——见 rotateLiveToken 的说明。
 */
export async function rotateRefreshToken(rawToken: string): Promise<RefreshOutcome> {
  const parsed = parseToken(rawToken);
  if (!parsed) return { status: "invalid" };
  const { tokenId, secret } = parsed;
  const secretHash = sha256(secret);

  const stored = parseJson<StoredRefreshToken>(await redis.get(tokenKey(tokenId)));

  if (stored) {
    // secret 不符：在任何写操作之前就返回，别让「只知道 tokenId」的人有能力改动任何状态
    if (!hashesEqual(stored.secretHash, secretHash)) {
      return { status: "invalid" };
    }

    // 到达绝对会话寿命：不再续期，撤销家族并要求重新走一次真正的身份认证
    if (await familyExceededAbsoluteLifetime(stored.familyId)) {
      logger.info("refresh_session_absolute_lifetime_reached", {
        userId: stored.userId,
        message: "会话已达绝对寿命上限，停止续期并要求重新登录",
      });
      await revokeRefreshFamily(stored.familyId);
      return { status: "invalid" };
    }

    return rotateLiveToken(tokenId, stored);
  }

  // 记录不在了：要么从未存在/已过期，要么已经被轮换掉（此时墓碑还在）
  const tombstone = parseJson<RefreshTokenTombstone>(await redis.get(usedKey(tokenId)));
  if (!tombstone) return { status: "invalid" };

  // 先验证 secret：只知道 tokenId 的人不该有能力触发下面任何一条路径
  if (!hashesEqual(tombstone.secretHash, secretHash)) {
    return { status: "invalid" };
  }

  return resolveAlreadyRotated(tokenId, tombstone.userId, tombstone.familyId);
}

/**
 * 轮换一枚仍然活着的令牌。
 *
 * 这里的核心是**单赢家选举**，而它必须由一条原子命令来完成。
 * 早期实现是「写墓碑 → 删旧记录 → 签发新令牌」三条各自独立的命令，没有任何互斥：
 * 两个并发请求会双双通过校验、双双签发，于是同一枚令牌分叉成两条都有效的链，
 * 「一个家族同一时刻只有一枚活令牌」的不变式就此失守，重放检测也永远不会触发。
 *
 * 选举用「继任者信箱」`SET successor:<tokenId> ... NX`：
 * - 写进去的那个请求是赢家，由它接着写墓碑、清旧记录；
 * - 没写进去的那些是输家，撤回自己刚签发的那枚，转而去信箱里取**赢家那一枚**。
 *
 * 之所以能这么做：这些并发请求本来就来自同一个浏览器（刷新 Cookie 同源共享），
 * 它们想要的从来是「同一枚新 Cookie」，而不是各自一枚。把同一枚发给所有人既正确又幂等。
 *
 * 顺序上「先签发、再选举」看似浪费（输家白签一枚），但换来的是信箱一旦存在就必定有值：
 * 反过来先选举再签发，输家读信箱时赢家可能还没写完，就只能靠轮询去等——那才是真的脆。
 * 输家的回滚只有两条命令，且这条路径本来就罕见（前端已用 Web Locks 把同源刷新串行化）。
 *
 * 宽限为 0（严格模式）时没有信箱可用，退回用墓碑本身做选举：输家即判定重放。
 * 这正是严格模式该有的语义——不留任何检测盲区，代价是并发刷新会踢掉会话。
 */
async function rotateLiveToken(
  tokenId: string,
  stored: StoredRefreshToken,
): Promise<RefreshOutcome> {
  const { userId, familyId } = stored;

  const created = await issueInFamily(userId, familyId);
  // 并发登出：家族在本次刷新写入的同时被撤销，新令牌已回滚，如实告知调用方会话已结束
  if (!created) return { status: "invalid" };

  const tombstone: RefreshTokenTombstone = {
    userId,
    familyId,
    secretHash: stored.secretHash,
    rotatedAt: Date.now(),
  };
  const tombstoneJson = JSON.stringify(tombstone);

  const wonElection =
    REFRESH_ROTATION_GRACE_SECONDS > 0
      ? await claim(successorKey(tokenId), JSON.stringify(created.issued), {
          EX: REFRESH_ROTATION_GRACE_SECONDS,
        })
      : await claim(usedKey(tokenId), tombstoneJson, { EX: USED_TOMBSTONE_TTL_SECONDS });

  if (!wonElection) {
    // 另一个请求已经把这枚令牌轮换掉了：撤回自己这枚，改用它的结果
    await discardIssued(created.tokenId, familyId);
    return resolveAlreadyRotated(tokenId, userId, familyId);
  }

  // 墓碑必须先于「删记录」写下，否则并发的请求会读到一片空白而把用户判成未登录。
  // 严格模式下墓碑就是选举本身，已经写过了。
  if (REFRESH_ROTATION_GRACE_SECONDS > 0) {
    await redis.set(usedKey(tokenId), tombstoneJson, { EX: USED_TOMBSTONE_TTL_SECONDS });
  }
  await redis.del(tokenKey(tokenId));
  await redis.sRem(familyKey(familyId), tokenId);

  return { status: "rotated", userId, next: created.issued };
}

/**
 * 处理「这枚令牌已经被轮换掉了」的提交。
 *
 * 信箱还在（即仍在宽限窗口内）就把**当初发出去的那一枚**原样再给一次：
 * 多标签页、门户与管理端共用同一枚 Cookie 时的并发刷新走的就是这条路，
 * 它们本来要的就是同一枚新 Cookie，所以这是幂等重放，不产生任何新分支。
 *
 * 早期实现在这里是「再补发一枚新的」，那等于把宽限窗口变成了一台铸币机：
 * 一枚已用令牌在窗口内重放 N 次就能铸出 N 枚同时有效、各自独立的令牌链。
 * 攻击者拿到被盗令牌后只要在窗口内刷一次，就能开出一条与受害者并行、
 * 而且此后再也不会触发重放检测的会话——因为他不必再碰那枚旧令牌了。
 *
 * 信箱过期之后再出现的同一枚令牌，就只剩「被复制走了」这一种解释，按重放处理。
 */
async function resolveAlreadyRotated(
  tokenId: string,
  userId: number,
  familyId: string,
): Promise<RefreshOutcome> {
  const successor = parseJson<IssuedRefreshToken>(await redis.get(successorKey(tokenId)));

  if (successor && (await familyIsAlive(familyId))) {
    logger.debug("refresh_token_concurrent_rotation", {
      tokenId,
      message: "刷新令牌在宽限窗口内被重复提交，按并发竞态处理并返回同一枚继任令牌",
    });
    return { status: "rotated", userId, next: successor };
  }

  /**
   * 家族已经被显式撤销（用户登出，或此前某次已判定过重放）。
   *
   * 这条路径最常见的来源是「落后一代的客户端」：另一个标签页登出之后，
   * 某个还开着的旧标签页拿着上一代 Cookie 来刷新一次。它不是攻击，
   * 而且此刻也没有任何可做的动作——家族早就撤销干净了，再 revoke 一次是空操作。
   *
   * 之所以要专门拦一道：`refresh_token_reuse_detected` 是这套机制里唯一的安全告警，
   * 它的价值完全建立在「响一次就值得看一次」之上。让一个再正常不过的登出动作
   * 稳定地产出这条 warn，等于亲手把它训练成噪声——真出重放那天就没人会当回事了。
   */
  if (await familyIsRevoked(familyId)) {
    logger.debug("refresh_token_after_revocation", {
      tokenId,
      message: "令牌所属家族已被撤销（登出或此前的重放处置），按会话已结束处理",
    });
    return { status: "invalid" };
  }

  logger.warn("refresh_token_reuse_detected", {
    tokenId,
    message: "检测到刷新令牌重放，已撤销该令牌家族，相关会话需要重新登录",
  });
  await revokeRefreshFamily(familyId);
  return { status: "reused" };
}

/**
 * 登出：撤销该令牌所属的整个家族（同一次登录派生出的全部令牌）。
 *
 * 也接受刚被轮换掉的令牌：客户端手里的 Cookie 可能比服务端晚一代
 * （另一个标签页刚刷新过），此时若认不出来，登出就会「看起来成功、实际没撤销」。
 * 两条路径都要求 secret 正确，避免仅凭 tokenId 就能强制他人下线。
 */
export async function revokeRefreshTokenByRaw(rawToken: string): Promise<void> {
  const parsed = parseToken(rawToken);
  if (!parsed) return;
  const secretHash = sha256(parsed.secret);

  const stored = parseJson<StoredRefreshToken>(await redis.get(tokenKey(parsed.tokenId)));
  if (stored) {
    if (!hashesEqual(stored.secretHash, secretHash)) return;
    await revokeRefreshFamily(stored.familyId);
    return;
  }

  const tombstone = parseJson<RefreshTokenTombstone>(await redis.get(usedKey(parsed.tokenId)));
  if (!tombstone) return;
  if (!hashesEqual(tombstone.secretHash, secretHash)) return;
  await revokeRefreshFamily(tombstone.familyId);
}
