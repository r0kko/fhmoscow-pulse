import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openApiPath = path.join(__dirname, 'openapi.base.json');
const baseSpec = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));

const swaggerSpec = structuredClone(baseSpec);
swaggerSpec.servers = [
  {
    url: process.env.BASE_URL || 'http://localhost:3000',
    description: process.env.BASE_URL ? 'Production server' : 'Local server',
  },
];

export default swaggerSpec;
