// SMSS — ESLint configuration
// Used by: npm run lint  and GitHub Actions CI job.
// Rules are intentionally permissive for the MVP phase —
// tighten progressively as the codebase matures.

'use strict';

module.exports = {
  env: {
    node:    true,
    es2022:  true,
    jest:    true,   // allows jest globals (describe, it, expect, jest) in tests
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType:  'commonjs',
  },
  extends: ['eslint:recommended'],
  rules: {
    // ── Errors ─────────────────────────────────────────────
    'no-unused-vars':      ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-undef':            'error',
    'no-console':          'off',   // console.log used for server logging
    'no-process-exit':     'off',   // used in server.js shutdown handler

    // ── Style (warnings only — won't block CI) ──────────────
    'eqeqeq':              ['warn', 'always', { null: 'ignore' }],
    'prefer-const':        'warn',
    'no-var':              'warn',
  },
  ignorePatterns: [
    'node_modules/',
    'coverage/',
    'prisma/migrations/',
  ],
};
