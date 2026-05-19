#!/usr/bin/env node
import { parseCLI, startVitest } from 'vitest/node';

const { filter, options } = parseCLI(['vitest', 'run', ...process.argv.slice(2)]);

let vitest;

try {
  vitest = await startVitest(
    'test',
    filter,
    {
      ...options,
      run: true,
      watch: false,
    },
    {
      root: process.cwd(),
    }
  );
  process.exitCode ??= 0;
} catch (error) {
  console.error(error);
  process.exitCode = process.exitCode || 1;
} finally {
  if (vitest) {
    await vitest.exit(true);
  }
}

process.exit(process.exitCode || 0);
