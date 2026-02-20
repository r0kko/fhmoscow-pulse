import fs from 'node:fs';
import path from 'node:path';

import swaggerJsdoc from 'swagger-jsdoc';

import swaggerOptions from '../src/docs/swaggerOptions.js';

const spec = swaggerJsdoc(swaggerOptions);
const outputPath = path.resolve(process.cwd(), 'src/docs/openapi.base.json');

fs.writeFileSync(outputPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
console.log(`OpenAPI spec written to ${outputPath}`);
