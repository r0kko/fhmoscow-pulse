#!/usr/bin/env node
import { parseCLI, startVitest } from 'vitest/node';

const { filter, options } = parseCLI(['vitest', 'run', ...process.argv.slice(2)]);

let vitest;
const configuredReporters = Array.isArray(options.reporter)
  ? options.reporter
  : options.reporter
    ? [options.reporter]
    : [];

delete options.reporter;

const exitReporter = {
  onInit(ctx) {
    vitest = ctx;
  },
  onTestRunEnd(testModules, unhandledErrors) {
    const failed =
      unhandledErrors.length > 0 || testModules.some((module) => !module.ok());
    process.exitCode = failed ? process.exitCode || 1 : 0;
    setTimeout(() => {
      process.exit(process.exitCode || 0);
    }, 0);
  },
};

try {
  vitest = await startVitest(
    'test',
    filter,
    {
      ...options,
      reporters: [...configuredReporters, exitReporter],
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
