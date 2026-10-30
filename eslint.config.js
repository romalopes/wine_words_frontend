import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default [
  { ignores: ['dist', 'react-router', 'playwright-report', 'test-results'] },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
  {
    // Context modules intentionally export both the provider component and
    // the matching hook. Splitting them would change the public module API
    // without improving runtime behavior.
    files: ['src/contexts/AuthContext.tsx', 'src/contexts/TestAccessContext.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Test files run under Vitest with `globals: true` (see vite.config.js), so
    // describe/it/expect/vi really are globals there. Declaring them keeps
    // `npm run lint` meaningful for specs instead of reporting every helper as
    // an undefined variable.
    files: ['**/*.{test,spec}.{js,mjs,jsx,ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.vitest },
    },
  },
  {
    files: ['tests/**/*.ts', 'playwright.config.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
]
