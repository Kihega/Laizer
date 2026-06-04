// Laizer — Singleton Prisma client
// Ensures ?pgbouncer=true is in the connection URL before Prisma initialises.
// Fixes: 42P05 "prepared statement already exists" on Supabase PgBouncer.
//
// Two layers of protection (either is sufficient):
//  1. Mutate process.env.DATABASE_URL directly — version-agnostic.
//  2. Pass datasourceUrl to constructor — Prisma 5 explicit override.
//     (Prisma 4 used { datasources: { db: { url } } } — that was removed in 5)

'use strict';

// ── Layer 1: mutate env var before Prisma reads it ────────────────────────────
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('pgbouncer')) {
  const sep = process.env.DATABASE_URL.includes('?') ? '&' : '?';
  process.env.DATABASE_URL += sep + 'pgbouncer=true';
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Prisma] ?pgbouncer=true appended to DATABASE_URL');
  }
}

const { PrismaClient } = require('@prisma/client');

// ── Layer 2: Prisma 5 datasourceUrl override ──────────────────────────────────
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,   // Prisma 5 API (replaces datasources.db.url)
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
