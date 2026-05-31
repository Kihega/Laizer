// SMSS — Jest configuration
// Extends the inline jest config in package.json with module mocking so
// tests run without a real database or Redis instance.
//
// moduleNameMapper intercepts Prisma and Redis require() calls at test time
// and redirects them to hand-written mocks in src/lib/__mocks__/.
// This means every test in __tests__/ runs in pure Node.js — no containers,
// no env secrets, no network traffic required.

'use strict';

module.exports = {
  // ── Core settings (mirrors package.json > jest) ───────────────────────────
  testEnvironment:      'node',
  testMatch:            ['**/__tests__/**/*.test.js'],
  coverageDirectory:    'coverage',
  collectCoverageFrom:  ['src/**/*.js'],
  forceExit:            true,
  detectOpenHandles:    true,
  testTimeout:          15000,  // 15 s — generous for cold-start in CI

  // ── Module mocking ────────────────────────────────────────────────────────
  // Pattern matches any relative require whose path ends in 'prisma' or 'redis',
  // covering all of:
  //   require('../lib/prisma')   from routes & middleware
  //   require('./prisma')        from src/lib/jwt.js and src/lib/audit.js
  //   require('../lib/redis')    from routes & middleware
  moduleNameMapper: {
    // Prisma singleton  →  lightweight in-memory mock
    '^(\\.{1,2}/)(.*/)?(prisma)(\\.js)?$':
      '<rootDir>/src/lib/__mocks__/prisma.js',

    // Redis singleton   →  no-op / null-client mock
    '^(\\.{1,2}/)(.*/)?(redis)(\\.js)?$':
      '<rootDir>/src/lib/__mocks__/redis.js',
  },
};
