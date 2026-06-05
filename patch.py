#!/usr/bin/env python3
"""
Laizer — Patch Script 19: Fix Prisma 5 pgbouncer (datasourceUrl)
=================================================================
Run from the ROOT of your repository:

    python fix_prisma5_datasource.py

Why the previous fix didn't work
─────────────────────────────────
Prisma 5 renamed the PrismaClient constructor option:
  Prisma 4:  new PrismaClient({ datasources: { db: { url: '...' } } })
  Prisma 5:  new PrismaClient({ datasourceUrl: '...' })

The previous prisma.js used the Prisma 4 API so the custom URL was silently
ignored — Prisma 5.22 fell back to process.env.DATABASE_URL without the
?pgbouncer=true parameter, causing every query to hit the prepared-statement
cache and crash with 42P05 on PgBouncer.

This patch rewrites prisma.js with two belt-and-suspenders layers:
  1. Mutates process.env.DATABASE_URL directly (version-agnostic)
  2. Also passes datasourceUrl (Prisma 5 API) as a second safety net

Either layer alone is sufficient; both together guarantees it works.
"""

from pathlib import Path

BACKEND = Path("backend")


PRISMA_JS = """\
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
"""


def main():
    path = BACKEND / "src/lib/prisma.js"
    if not path.exists():
        print(f"❌  {path} not found — run from repo root")
        return

    path.write_text(PRISMA_JS, encoding="utf-8")
    print(f"✅  {path} rewritten — Prisma 5 datasourceUrl + env mutation")
    print()
    print("Restart the backend to apply:")
    print("  cd backend && npm start")
    print()
    print("Also update Render dashboard DATABASE_URL to include ?pgbouncer=true:")
    print("  Render → laizer-api → Environment")
    print("  DATABASE_URL=postgresql://postgres.hyowzumaoevdxwycumui:laizer%23%232026")
    print("             @aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true")
    print()
    print("Commit:")
    print("  git add backend/src/lib/prisma.js")
    print('  git commit -m "fix: Prisma 5 datasourceUrl for pgbouncer (was Prisma 4 API)"')
    print("  git push origin develop")


if __name__ == "__main__":
    main()
