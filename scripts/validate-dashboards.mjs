import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'infra/observability/grafana/dashboards';
let failed = false;

for (const f of readdirSync(dir)) {
  if (!f.endsWith('.json')) continue;
  const path = join(dir, f);
  const src = readFileSync(path, 'utf8');
  try {
    JSON.parse(src);
    console.log(`${path}: OK`);
  } catch (e) {
    failed = true;
    console.error(`${path}: ERROR ${e.message}`);
  }
}

if (failed) {
  process.exitCode = 1;
}
