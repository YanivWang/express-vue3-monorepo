// 先于 app/logger 链路加载 dotenv 与校验，避免仅写在 .env 里的变量（如 LOG_LEVEL）未及时合并
import { PORT } from "./env.js";
import app from "./app.js";
import { connectDatabase } from "./db.js";

await connectDatabase();

// HTTP 服务应该在「数据库已就绪」之后再 listen
app.listen(PORT, () => {
  console.log(`服务运行: http://localhost:${PORT}`);
});
