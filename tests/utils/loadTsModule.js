import { readFileSync } from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import { pathToFileURL } from 'node:url';

const moduleCache = new Map();

const clientRequire = Module.createRequire(
  pathToFileURL(path.resolve('client/tsconfig.json'))
);
const ts = clientRequire('typescript');

export function loadTsModule(tsFilePath) {
  const absPath = path.resolve(tsFilePath);
  if (moduleCache.has(absPath)) {
    return moduleCache.get(absPath);
  }

  const source = readFileSync(absPath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      resolveJsonModule: true,
      isolatedModules: false,
    },
    fileName: absPath,
    reportDiagnostics: false,
  });

  const moduleExports = {};
  const module = { exports: moduleExports };
  const require = Module.createRequire(pathToFileURL(absPath));
  const dirname = path.dirname(absPath);

  const evaluator = new Function(
    'exports',
    'require',
    'module',
    '__filename',
    '__dirname',
    outputText
  );
  evaluator(moduleExports, require, module, absPath, dirname);
  moduleCache.set(absPath, module.exports);
  return module.exports;
}
