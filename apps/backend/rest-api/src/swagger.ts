import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
import swaggerUi from "swagger-ui-express";

import { API_DOCS_ENABLED } from "./env.js";
import { logger } from "./utils/logger.js";
import { findMonorepoRoot } from "./utils/monorepoRoot.js";

import type { Application } from "express";

const __dirname = dirname(fileURLToPath(import.meta.url));
const restApiRoot = join(__dirname, "..");
const monorepoRoot = findMonorepoRoot(restApiRoot);
const openApiPath = join(monorepoRoot, "docs", "openapi.yaml");

export function loadOpenApiSpec(): Record<string, unknown> {
  const raw = readFileSync(openApiPath, "utf8");
  const spec = yaml.load(raw);
  if (!spec || typeof spec !== "object") {
    throw new Error("[swagger] openapi.yaml 解析结果无效");
  }
  return spec as Record<string, unknown>;
}

/**
 * 挂载 API 文档。**默认只在非生产环境挂载**（见 env.ts 的 API_DOCS_ENABLED）。
 *
 * 关闭时不读盘、不注册任何路由：`/api-docs` 与 `/openapi.yaml` 会落到全局 404，
 * 与「这个服务根本没有文档接口」在外部看来毫无区别。
 * 顺带的好处是镜像里即使没有 docs/ 目录也能正常启动。
 */
export function setupSwagger(app: Application, path = "/api-docs") {
  if (!API_DOCS_ENABLED) {
    logger.info("api_docs_disabled", {
      message:
        "未挂载 /api-docs 与 /openapi.yaml（生产默认关闭）。确需对外提供时设 API_DOCS_ENABLED=1，" +
        "并确保该入口只在内网或鉴权之后可达。",
    });
    return;
  }

  const spec = loadOpenApiSpec();

  app.get("/openapi.yaml", (_req, res) => {
    res.type("application/yaml");
    res.send(readFileSync(openApiPath, "utf8"));
  });

  app.use(path, swaggerUi.serve, swaggerUi.setup(spec));
}
