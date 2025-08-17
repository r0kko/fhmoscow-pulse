export default {
    testEnvironment: 'node',
    transform: {},

    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/build/',
        '<rootDir>/client/',
    ],

    modulePathIgnorePatterns: [
        '<rootDir>/client/node_modules',
        '<rootDir>/dist',
        '<rootDir>/build',
    ],

    roots: ['<rootDir>/src', '<rootDir>/tests'],

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
