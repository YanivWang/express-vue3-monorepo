import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const openApiPath = join(__dirname, '..', 'docs', 'openapi.yaml');

export function loadOpenApiSpec() {
  const raw = readFileSync(openApiPath, 'utf8');
  return yaml.load(raw);
}

export function setupSwagger(app, path = '/api-docs') {
  const spec = loadOpenApiSpec();

  app.get('/openapi.yaml', (_req, res) => {
    res.type('application/yaml');
    res.send(readFileSync(openApiPath, 'utf8'));
  });

  app.use(path, swaggerUi.serve, swaggerUi.setup(spec));
}
