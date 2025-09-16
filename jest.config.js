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

    moduleNameMapper: {
        '^@aws-sdk/client-s3$': '<rootDir>/tests/stubs/awsClientS3.js',
        '^@aws-sdk/s3-request-presigner$': '<rootDir>/tests/stubs/awsS3Presigner.js',
    },

    roots: ['<rootDir>/src', '<rootDir>/tests'],

    // Coverage is collected from files touched by tests (default)

    maxWorkers: 1,
    resetModules: true,
    clearMocks: true,
    restoreMocks: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['json-summary', 'text', 'lcov'],
    coveragePathIgnorePatterns: [
        '<rootDir>/src/externalModels/',
        '<rootDir>/src/migrations/',
        '<rootDir>/src/config/externalMariaDb.js',
        
    ],
    coverageThreshold: {
        global: {
            statements: 70,
            branches: 55,
            functions: 70,
            lines: 70,
        },
    },
};
