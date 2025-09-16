import vue from 'eslint-plugin-vue';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import vueA11y from 'eslint-plugin-vuejs-accessibility';

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
  ...vueA11y.configs['flat/recommended'],
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
    plugins: { vue, prettier: prettierPlugin, 'vuejs-accessibility': vueA11y },
    rules: {
      // Vue relaxations for this project
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',

      // Accessibility: enforce interaction best practices first; form label
      // hygiene will be migrated gradually across legacy components.
      'vuejs-accessibility/form-control-has-label': 'off',
      'vuejs-accessibility/label-has-for': 'off',
      'vuejs-accessibility/no-static-element-interactions': 'error',
      'vuejs-accessibility/interactive-supports-focus': 'error',
      'vuejs-accessibility/click-events-have-key-events': 'error',
      'vuejs-accessibility/no-autofocus': 'error',
      'vuejs-accessibility/no-redundant-roles': 'error',

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
