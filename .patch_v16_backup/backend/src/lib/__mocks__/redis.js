// SMSS — Redis mock for Jest
// Replaces the real Redis singleton during test runs.
// getClient() returns null → the app treats Redis as 'disabled' and falls
// back to direct DB queries.  All cache helpers are no-ops.

'use strict';

const redisMock = {
  // ── Connection ───────────────────────────────────────────────────────────
  getClient: jest.fn().mockResolvedValue(null),

  // ── Cache operations ─────────────────────────────────────────────────────
  cacheGet:        jest.fn().mockResolvedValue(null),
  cacheSet:        jest.fn().mockResolvedValue(undefined),
  cacheDel:        jest.fn().mockResolvedValue(undefined),
  cacheDelPattern: jest.fn().mockResolvedValue(undefined),

  // ── Cache key builders (must match src/lib/redis.js exactly) ─────────────
  CacheKey: {
    user:          (id)             => `user:${id}`,
    centres:       (ownerId)        => `centres:${ownerId}`,
    workers:       (ownerId)        => `workers:${ownerId}`,
    centreWorkers: (centreId)       => `cworkers:${centreId}`,
    stock:         (centreId)       => `stock:${centreId}`,
    reportDaily:   (centreId, date) => `report:d:${centreId}:${date}`,
    reportWeekly:  (centreId, ws)   => `report:w:${centreId}:${ws}`,
  },

  // ── Cache TTL constants ───────────────────────────────────────────────────
  CacheTTL: {
    USER:          300,
    CENTRES:       300,
    WORKERS:       300,
    STOCK:         120,
    REPORT_DAILY:  600,
    REPORT_WEEKLY: 1800,
  },
};

module.exports = redisMock;
