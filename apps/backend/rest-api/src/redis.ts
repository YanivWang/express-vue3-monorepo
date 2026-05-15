import { createClient } from "redis";

import { REDIS_URL } from "./env.js";
import { logger, serializeError } from "./utils/logger.js";

// 创建redis客户端
export const redis = createClient({ url: REDIS_URL });

redis.on("error", (err) => {
  logger.error("redis_client_error", { error: serializeError(err) });
});

//封装连接redis的方法
export async function connectRedis() {
  if (redis.isOpen) return;

  await redis.connect(); //连接redis
  await redis.ping(); //检查redis是否连接成功

  logger.info("redis_connected");
}

//封装断开redis连接的方法
export async function disconnectRedis() {
  if (!redis.isOpen) return;

  await redis.quit(); //断开redis连接
}
