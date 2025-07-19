export default {
  testEnvironment: 'node',
  transform: {},
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
