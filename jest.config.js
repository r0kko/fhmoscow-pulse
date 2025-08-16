export default {
  testEnvironment: 'node',
  transform: {},
  // Do NOT reset modules globally with ESM + unstable_mockModule.
  // Global resets cause "module is already linked" with ESM graphs.
  // Tests that need isolation should use `jest.isolateModulesAsync` locally.
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
