export default {
  testEnvironment: 'node',
  transform: {},
  maxWorkers: 1,
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
