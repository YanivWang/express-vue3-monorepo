// 先于 app/logger 链路加载 dotenv 与校验，避免仅写在 .env 里的变量（如 LOG_LEVEL）未及时合并
import app from "./app.js";
import { ensureUploadsRoot } from "./config/upload.config.js";
import { connectDatabase } from "./db.js";
import { PORT } from "./env.js";
import { connectRedis } from "./redis.js";

// 这里顺序的含义是：MySQL 和 Redis 都可用之后，后端才开始对外提供服务。
// 这样比“服务先启动、请求进来后才发现 Redis 挂了”更容易排查问题。
await connectDatabase();
await connectRedis();

ensureUploadsRoot(); //确保 uploads 上传目录存在，不存在则创建

// HTTP 服务应该在「数据库已就绪」之后再 listen
app.listen(PORT, () => {
  console.log(`服务运行: http://localhost:${PORT}`);
});
