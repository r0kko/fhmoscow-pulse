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
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
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
      'import/no-unresolved': 'error',
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
      '**/*.test.js',
      '**/*.spec.js',
      '**/logs/**',
      '**/client/**',
    ],
  },
];
