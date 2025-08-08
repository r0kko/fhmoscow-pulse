// Flat ESLint config for the client (Vue 3) with Prettier integration
import vue from 'eslint-plugin-vue';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
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
      globals: {
        window: true,
        document: true,
        console: true,
        HTMLElement: true,
      },
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
];
