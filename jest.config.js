export default {
  testEnvironment: 'node',
  transform: {},
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      statements: 65,
      branches: 55,
      functions: 65,
      lines: 65,
    },
  },
};
