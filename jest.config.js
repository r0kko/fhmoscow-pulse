export default {
  testEnvironment: 'node',
  transform: {},
  // Run tests sequentially to avoid concurrent ESM linking issues
  maxWorkers: 1,
  // Ensure each test file gets a fresh module registry to prevent
  // "module is already linked" errors when using `unstable_mockModule`.
  resetModules: true,
  clearMocks: true,
  restoreMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 55,
      functions: 70,
      lines: 70,
    },
  },
};
