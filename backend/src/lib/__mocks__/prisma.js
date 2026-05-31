// SMSS — Prisma mock for Jest
// Replaces the real PrismaClient singleton during test runs.
// All methods return safe defaults so route handlers behave predictably:
//   - findUnique / findFirst → null  (record not found)
//   - findMany               → []    (empty list)
//   - create / update        → {}    (minimal success)
//   - $queryRaw              → [{1:1}] (health check SELECT 1)
//
// Add new mock methods here if you add Prisma models / operations to routes.

'use strict';

const prismaMock = {
  // ── Raw query (used by health check) ─────────────────────────────────────
  $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  $connect:  jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),

  // ── User ─────────────────────────────────────────────────────────────────
  user: {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst:  jest.fn().mockResolvedValue(null),
    findMany:   jest.fn().mockResolvedValue([]),
    create:     jest.fn().mockResolvedValue({ id: 'mock-user-id', isActive: true }),
    update:     jest.fn().mockResolvedValue({ id: 'mock-user-id' }),
    delete:     jest.fn().mockResolvedValue({ id: 'mock-user-id' }),
  },

  // ── Centre ───────────────────────────────────────────────────────────────
  centre: {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst:  jest.fn().mockResolvedValue(null),
    findMany:   jest.fn().mockResolvedValue([]),
    create:     jest.fn().mockResolvedValue({ id: 'mock-centre-id' }),
    update:     jest.fn().mockResolvedValue({ id: 'mock-centre-id' }),
    delete:     jest.fn().mockResolvedValue({ id: 'mock-centre-id' }),
  },

  // ── WorkerCentreAssignment ────────────────────────────────────────────────
  workerCentreAssignment: {
    findFirst:  jest.fn().mockResolvedValue(null),
    findMany:   jest.fn().mockResolvedValue([]),
    create:     jest.fn().mockResolvedValue({}),
    update:     jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete:     jest.fn().mockResolvedValue({}),
  },

  // ── BlacklistedToken ──────────────────────────────────────────────────────
  blacklistedToken: {
    findUnique: jest.fn().mockResolvedValue(null),
    create:     jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },

  // ── StockItem ────────────────────────────────────────────────────────────
  stockItem: {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst:  jest.fn().mockResolvedValue(null),
    findMany:   jest.fn().mockResolvedValue([]),
    create:     jest.fn().mockResolvedValue({ id: 'mock-stock-id' }),
    update:     jest.fn().mockResolvedValue({ id: 'mock-stock-id' }),
    delete:     jest.fn().mockResolvedValue({ id: 'mock-stock-id' }),
  },

  // ── ServiceEvent ──────────────────────────────────────────────────────────
  serviceEvent: {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst:  jest.fn().mockResolvedValue(null),
    findMany:   jest.fn().mockResolvedValue([]),
    create:     jest.fn().mockResolvedValue({ id: 'mock-service-id' }),
    update:     jest.fn().mockResolvedValue({ id: 'mock-service-id' }),
    delete:     jest.fn().mockResolvedValue({ id: 'mock-service-id' }),
    groupBy:    jest.fn().mockResolvedValue([]),
    aggregate:  jest.fn().mockResolvedValue({ _sum: {}, _count: {} }),
  },

  // ── Notice ────────────────────────────────────────────────────────────────
  notice: {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst:  jest.fn().mockResolvedValue(null),
    findMany:   jest.fn().mockResolvedValue([]),
    create:     jest.fn().mockResolvedValue({ id: 'mock-notice-id' }),
    update:     jest.fn().mockResolvedValue({ id: 'mock-notice-id' }),
  },

  // ── NoticeReceipt ─────────────────────────────────────────────────────────
  noticeReceipt: {
    upsert:   jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
  },

  // ── PushToken ─────────────────────────────────────────────────────────────
  pushToken: {
    upsert:   jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
  },

  // ── AuditLog (if added later) ─────────────────────────────────────────────
  auditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
};

module.exports = prismaMock;
