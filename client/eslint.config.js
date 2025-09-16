// Flat ESLint config for the client (Vue 3) with Prettier integration
import vue from 'eslint-plugin-vue';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

const browserGlobals = {
  window: true,
  document: true,
  console: true,
  HTMLElement: true,
  localStorage: true,
  sessionStorage: true,
  navigator: true,
};

const vitestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  vi: 'readonly',
};

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  // Vue SFC rules
  ...vue.configs['flat/recommended'],
  // Disable stylistic rules that conflict with Prettier
  prettierConfig,
  // Project rules
  {
    files: ['**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: browserGlobals,
    },
    plugins: { vue, prettier: prettierPlugin },
    rules: {
      // Vue relaxations for this project
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',

      // Enforce Prettier formatting via ESLint
      'prettier/prettier': 'error',
    },
  },
  {
    files: ['tests/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: { ...browserGlobals, ...vitestGlobals },
    },
  },
];
