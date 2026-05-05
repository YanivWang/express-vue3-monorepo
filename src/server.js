import app from "./app.js";
import { connectDatabase } from "./db.js";
import { PORT } from "./env.js";

await connectDatabase();

// HTTP 服务应该在「数据库已就绪」之后再 listen
app.listen(PORT, () => {
  console.log(`服务运行: http://localhost:${PORT}`);
});
