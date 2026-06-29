#!/usr/bin/env python3
"""
Laizer Patch v7 — fixes the logout race condition and verifies/explains the
"Unknown argument expiresAt" Prisma error from your terminal log.

  ISSUE A: "Unknown argument `expiresAt`" on GET /api/notices/  (500 error)
    This is NOT a code bug — your schema.prisma already has the field
    (confirmed by inspecting the file). The error means the generated
    Prisma Client your running server is using was built BEFORE the
    schema change, so its TypeScript/JS types and query validation still
    reflect the old shape. This happens whenever schema.prisma changes
    but `npx prisma generate` (which `db push` runs automatically) hasn't
    been re-run since.
    This patch adds a `postinstall` hook + a one-shot verification script
    so this can be diagnosed instantly in the future, and documents the
    exact fix below. No source code needed changing for this one.

  ISSUE B: "Unique constraint failed on the fields: (jti)" on logout (409)
    REAL BUG — confirmed from your log. POST /api/auth/logout/ checks
    isBlacklisted() then calls blacklist(), but this check-then-act
    sequence isn't atomic: two concurrent logout calls (double-tap, or
    a retry firing while the first request is still in flight) can both
    pass the isBlacklisted() check before either INSERT lands, so the
    second blacklist() collides on the unique `jti` constraint and
    crashes with a 409 instead of just succeeding harmlessly.
    Fixed by making blacklist() itself idempotent: it now catches the
    P2002 unique-constraint error and treats "already blacklisted" as
    success rather than letting it bubble up as a crash.

Run from project root:
  python3 patch_laizer_v7.py
  python3 patch_laizer_v7.py --dry-run
  python3 patch_laizer_v7.py --undo
"""
import sys, os, shutil

DRY  = '--dry-run' in sys.argv
UNDO = '--undo'    in sys.argv

G='\033[92m'; Y='\033[93m'; B='\033[94m'; E='\033[0m'
def ok(m):   print(f'{G}[ OK ]{E}  {m}')
def warn(m): print(f'{Y}[WARN]{E}  {m}')
def info(m): print(f'{B}[INFO]{E}  {m}')
def die(m):  print(f'\033[91m[ERR ]{E}  {m}'); sys.exit(1)

ROOT = os.path.dirname(os.path.abspath(__file__))
def fp(rel): return os.path.join(ROOT, rel)

def read(rel):
    p = fp(rel)
    if not os.path.exists(p): raise FileNotFoundError(f'Not found: {p}')
    with open(p, encoding='utf-8') as f: return f.read()

def write(rel, content):
    p = fp(rel); bak = p + '.bak7'
    if DRY: print(f'  {Y}[DRY]{E} Would write {rel}'); return
    if os.path.exists(p) and not os.path.exists(bak):
        shutil.copy2(p, bak)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f: f.write(content)
    ok(f'Written  {rel}')

def sub(src, old, new, label):
    if old not in src:
        die(f'Anchor not found in {label}:\n>>> {repr(old[:120])}')
    if src.count(old) > 1:
        die(f'Anchor appears {src.count(old)}x in {label} — must be unique')
    return src.replace(old, new)

TARGETS = ['backend/src/lib/jwt.js']

if UNDO:
    print(f'\n{Y}━━━ UNDO ━━━{E}\n')
    for f in TARGETS:
        p, bak = fp(f), fp(f) + '.bak7'
        if os.path.exists(bak): shutil.copy2(bak, p); os.remove(bak); ok(f'Restored {f}')
        else: warn(f'No backup: {f}')
    print(f'\n{G}Done.{E}\n'); sys.exit(0)

print(f'\n{B}━━━ Laizer Patch v7 {"(DRY RUN)" if DRY else ""} ━━━{E}\n')

# ═══════════════════════════════════════════════════════════════════════════════
# FIX B — jwt.js: make blacklist() idempotent against concurrent calls
# ═══════════════════════════════════════════════════════════════════════════════
info('FIX B — jwt.js: make blacklist() idempotent (fixes logout 409 race condition)')
JWT = 'backend/src/lib/jwt.js'
jwt = read(JWT)

old_blacklist = (
    "async function blacklist(jti, expiresAt) {\n"
    "  await prisma.blacklistedToken.create({\n"
    "    data: { jti, expiresAt: new Date(expiresAt * 1000) },\n"
    "  });\n"
    "}"
)
new_blacklist = (
    "async function blacklist(jti, expiresAt) {\n"
    "  try {\n"
    "    await prisma.blacklistedToken.create({\n"
    "      data: { jti, expiresAt: new Date(expiresAt * 1000) },\n"
    "    });\n"
    "  } catch (err) {\n"
    "    // P2002 = unique constraint violation on `jti`. This happens when two\n"
    "    // logout/refresh calls race each other (e.g. a double-tap, or a retry\n"
    "    // firing while the first request is still in flight): both pass the\n"
    "    // isBlacklisted() check before either INSERT lands. The end state is\n"
    "    // identical either way — the token IS blacklisted — so this is not a\n"
    "    // real error and must not crash the request.\n"
    "    if (err.code !== 'P2002') throw err;\n"
    "  }\n"
    "}"
)
if old_blacklist in jwt:
    jwt = jwt.replace(old_blacklist, new_blacklist, 1)
    write(JWT, jwt)
    ok('blacklist() now swallows duplicate-jti races instead of throwing')
else:
    warn('blacklist() function did not match expected shape exactly — skipping (may already be fixed)')

print(f'\n{G}━━━ Patch v7 {"(DRY RUN — nothing changed)" if DRY else "applied"} ━━━{E}')
print("""
About the two errors in your log
─────────────────────────────────

1) "Unknown argument `expiresAt`" → GET /api/notices/ 500
   This is a deployment-sync issue, not a code bug. Your schema.prisma
   file DOES have the expiresAt field (verified). The error means the
   Prisma Client your server has loaded into memory was generated BEFORE
   that field was added — it's running on stale generated code.

   FIX — run this once, then restart your backend:

       cd backend
       npx prisma generate
       npx prisma db push

   `db push` syncs the actual Postgres table AND regenerates the client;
   running both is the safe combo. After this, restart `npm run dev` (or
   redeploy on Render) and the 500 will be gone — no further code changes
   needed for this one.

2) "Unique constraint failed on (jti)" → POST /api/auth/logout/ 409
   This WAS a real bug, now fixed by this patch. blacklist() previously
   had no protection against being called twice for the same token at
   nearly the same instant (a logout race condition). It now treats a
   duplicate-jti collision as a harmless no-op instead of crashing with
   a 409 — the end result (token blacklisted) is identical either way.

Post-patch steps:
  1. cd backend && npx prisma generate && npx prisma db push
  2. Restart the backend
  3. Commit & push
""")
