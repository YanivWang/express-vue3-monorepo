import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import swaggerUi from "swagger-ui-express";
import { findMonorepoRoot } from "./utils/monorepoRoot.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const restApiRoot = join(__dirname, "..");
const monorepoRoot = findMonorepoRoot(restApiRoot);
const openApiPath = join(monorepoRoot, "docs", "openapi.yaml");

export function loadOpenApiSpec() {
  const raw = readFileSync(openApiPath, "utf8");
  return yaml.load(raw);
}

export function setupSwagger(app, path = "/api-docs") {
  const spec = loadOpenApiSpec();

  app.get("/openapi.yaml", (_req, res) => {
    res.type("application/yaml");
    res.send(readFileSync(openApiPath, "utf8"));
  });

  app.use(path, swaggerUi.serve, swaggerUi.setup(spec));
}
