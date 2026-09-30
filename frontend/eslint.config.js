import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dev-dist', 'public']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // The service worker runs in a worker scope, and Vite's config runs in Node.
  {
    files: ['src/serviceWorker/**/*.ts'],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    files: ['vite.config.ts', 'vite-plugins/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
])
