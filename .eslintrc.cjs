module.exports = {
  env: {
    webextensions: true,
    browser: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:vue/vue3-recommended',
    'prettier',
  ],
  overrides: [],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'vue'],
  rules: {
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn', // Change from error to warning
    '@typescript-eslint/no-unused-vars': 'warn', // Change from error to warning
    'vue/multi-word-component-names': 'off',
    'no-unref': 'off',
    'no-undef': 'off',
    'no-useless-catch': 'off',
    'no-case-declarations': 'off',
  },
}
