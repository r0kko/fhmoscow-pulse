import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import eslintPluginImport from 'eslint-plugin-import';
import eslintPluginN from 'eslint-plugin-n';
import eslintPluginSecurity from 'eslint-plugin-security';

/**
 * Flat config, best practices for Node.js
 * npm i -D eslint @eslint/js eslint-plugin-import eslint-config-prettier
 * npm i -D prettier eslint-plugin-prettier (для отдельного pre-commit format)
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.git/**',
      'dist/**',
      'coverage/**',
      'client/**',
      'packages/**/dist/**',
      'packages/**/build/**',
    ],
  },
  js.configs.recommended,
  eslintPluginN.configs['flat/recommended'],
  prettier,
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: {
      import: eslintPluginImport,
      n: eslintPluginN,
      security: eslintPluginSecurity,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
      ecmaVersion: 2021,
      sourceType: 'module',
    },
    rules: {
      'prettier/prettier': 'off',
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-var': 'error',
      'prefer-const': 'error',

      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          'newlines-between': 'always',
        },
      ],
      // Some ESM packages expose only export maps; resolver can be flaky in CI. Ignore 'uuid'.
      'import/no-unresolved': ['error', { ignore: ['^uuid$'] }],
      'import/no-extraneous-dependencies': 'error',
      'n/no-process-exit': 'error',
      'n/no-missing-require': 'off',
      'n/no-unsupported-features/node-builtins': [
        'error',
        { version: '>=20.0.0', ignores: ['fetch', 'structuredClone'] },
      ],
      'n/no-unsupported-features/es-builtins': [
        'error',
        { version: '>=20.0.0' },
      ],
      'n/no-unsupported-features/es-syntax': [
        'error',
        { version: '>=20.0.0' },
      ],
      'security/detect-object-injection': 'off',
      'security/detect-unsafe-regex': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-non-literal-regexp': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-child-process': 'off',
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.json', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'],
        },
      },
      node: {
        version: '>=20.0.0',
      },
    },
  },
  // Tests: enable Node + Jest globals so `process` and Jest globals are defined
  {
    files: ['tests/**/*.js'],
    plugins: { import: eslintPluginImport },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.es2021,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      // Tests can import dev dependencies
      'import/no-extraneous-dependencies': 'off',
      'import/order': 'off',
      'no-redeclare': 'off',
      'prefer-const': 'off',
      quotes: 'off',
    },
  },
];
