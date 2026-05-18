import { readFile } from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const expectedPackages = [
  ['archiver', '8.0.0'],
  ['pdfkit', '0.18.0'],
  ['pdfkit-table', '0.2.11'],
];

async function packageJsonPath(packageName) {
  let current = path.dirname(require.resolve(packageName));
  while (current !== path.dirname(current)) {
    const candidate = path.join(current, 'package.json');
    try {
      const raw = await readFile(candidate, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.name === packageName) return { path: candidate, packageJson: parsed };
    } catch {
      // Keep walking up until the owning package.json is found.
    }
    current = path.dirname(current);
  }
  throw new Error(`Cannot resolve package.json for ${packageName}`);
}

async function main() {
  for (const [packageName, expectedVersion] of expectedPackages) {
    const { packageJson } = await packageJsonPath(packageName);
    if (packageJson.version !== expectedVersion) {
      throw new Error(
        `Runtime dependency mismatch: ${packageName}@${packageJson.version} installed, expected ${packageName}@${expectedVersion}. Rebuild the image with a clean dependency layer.`
      );
    }
  }

  const archiver = await import('archiver');
  if (typeof archiver.ZipArchive !== 'function') {
    throw new Error(
      'Runtime dependency mismatch: archiver ZipArchive export is missing. Rebuild the image with archiver@8.0.0 from the current lockfile.'
    );
  }

  console.log('Runtime dependency check passed.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
