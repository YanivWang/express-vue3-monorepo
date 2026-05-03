import { PORT } from "./env.js";
import app from "./app.js";

// 专门负责启动服务
app.listen(PORT, () => {
  console.log(`服务运行: http://localhost:${PORT} `);
});
