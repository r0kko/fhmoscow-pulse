import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import eslintPluginImport from 'eslint-plugin-import';

/**
 * Flat config, best practices for Node.js
 * npm i -D eslint @eslint/js eslint-plugin-import eslint-config-prettier
 * npm i -D prettier eslint-plugin-prettier (для отдельного pre-commit format)
 */
export default [
  {
    ignores: ['client/**'],
  },
  js.configs.recommended,
  prettier,
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { import: eslintPluginImport },
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
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.json', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'],
        },
      },
    },
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      // Do not lint tests with this config block; a dedicated block is below
      '**/*.spec.js',
      '**/logs/**',
      '**/client/**',
    ],
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
