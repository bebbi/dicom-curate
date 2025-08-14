import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        // Browser globals
        Window: 'readonly',
        Worker: 'readonly',
        MessageEvent: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        URL: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        TextEncoder: 'readonly',

        // File System Access API
        FileSystemDirectoryHandle: 'readonly',
        FileSystemFileHandle: 'readonly',

        // Node.js globals (for tests)
        __dirname: 'readonly',
        path: 'readonly',

        // Jest globals
        fail: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      // Relax some strict rules for this project
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      'no-undef': 'error',
      'no-case-declarations': 'warn',
      'no-irregular-whitespace': 'error',
      'no-async-promise-executor': 'warn',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        fail: 'readonly',
      },
    },
  },
]
