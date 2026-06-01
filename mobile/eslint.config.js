// SMSS Mobile — ESLint flat config (ESLint 9+)
// ESLint 9 dropped .eslintrc.* and the --ext flag.
// File-type filtering is handled here via the `files` array.

'use strict';

const tsPlugin   = require('@typescript-eslint/eslint-plugin');
const tsParser   = require('@typescript-eslint/parser');
const reactHooks = require('eslint-plugin-react-hooks');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  // ── Global ignores ────────────────────────────────────────────────────────
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'babel.config.js',
      'eslint.config.js',   // don't lint this file with TS rules
    ],
  },

  // ── TypeScript + React Native source files ────────────────────────────────
  {
    files: ['**/*.{ts,tsx}'],

    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks':        reactHooks,
    },

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion:     2022,
        ecmaFeatures:    { jsx: true },
        sourceType:      'module',
      },
    },

    rules: {
      // ── TypeScript recommended ────────────────────────────────────────────
      ...tsPlugin.configs.recommended.rules,

      // ── React Hooks ───────────────────────────────────────────────────────
      ...reactHooks.configs.recommended.rules,

      // ── Overrides ─────────────────────────────────────────────────────────
      // Prefix unused vars/params with _ to suppress
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` is common in API error handling — warn, don't block
      '@typescript-eslint/no-explicit-any': 'warn',

      // Expo + RN projects use require() in config files — allow it
      '@typescript-eslint/no-require-imports': 'off',

      // Empty catch blocks are sometimes intentional in cleanup handlers
      'no-empty':                         ['error', { allowEmptyCatch: true }],
    },
  },
];
