import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const distAssetsDir = fileURLToPath(
  new URL('../dist/assets/', import.meta.url)
);
const kib = 1024;

const budgets = {
  jsAssetKiB: Number(process.env.BUNDLE_BUDGET_JS_KIB || 700),
  cssAssetKiB: Number(process.env.BUNDLE_BUDGET_CSS_KIB || 520),
};

const files = await readdir(distAssetsDir);
const oversized = [];

for (const file of files) {
  if (!file.endsWith('.js') && !file.endsWith('.css')) continue;

  const sizeKiB = (await stat(join(distAssetsDir, file))).size / kib;
  const limitKiB = file.endsWith('.css')
    ? budgets.cssAssetKiB
    : budgets.jsAssetKiB;

  if (sizeKiB > limitKiB) {
    oversized.push({
      file,
      sizeKiB: Number(sizeKiB.toFixed(1)),
      limitKiB,
    });
  }
}

if (oversized.length > 0) {
  console.error('Bundle budget exceeded:');
  for (const item of oversized) {
    console.error(`- ${item.file}: ${item.sizeKiB} KiB > ${item.limitKiB} KiB`);
  }
  process.exit(1);
}

console.log(
  `Bundle budget OK: JS <= ${budgets.jsAssetKiB} KiB, CSS <= ${budgets.cssAssetKiB} KiB`
);
