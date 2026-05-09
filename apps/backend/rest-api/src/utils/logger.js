// 新增一个日志工具类，用来记录日志
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import winston from "winston";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logDir = path.resolve(__dirname, "../../logs");

fs.mkdirSync(logDir, { recursive: true });

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

/** JSON 序列化时 Error 的 message/stack 不可枚举会丢失，转成普通对象再记日志 */
export function serializeError(value) {
  if (!(value instanceof Error)) {
    return value;
  }
  const out = {
    name: value.name,
    message: value.message,
    stack: value.stack,
  };
  for (const key of Object.keys(value)) {
    if (Object.prototype.hasOwnProperty.call(out, key)) continue;
    const v = value[key];
    out[key] = v instanceof Error ? serializeError(v) : v;
  }
  if ("cause" in value && value.cause !== undefined) {
    out.cause = value.cause instanceof Error ? serializeError(value.cause) : value.cause;
  }
  return out;
}

const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaText = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} ${level}: ${stack || message}${metaText}`;
});

// 创建一个日志记录器logger, 用来记录日志
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports: [
    // 只记录 error 级别日志
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
    }),
    // 所有日志
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), timestamp(), errors({ stack: true }), consoleFormat),
    }),
  );
}
