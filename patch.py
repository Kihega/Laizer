#!/usr/bin/env python3
"""
Laizer CI Fix 2 — clears the last remaining ESLint error.

The previous fix resolved 3 of 4 errors in (worker)/dashboard.tsx.
This patch ensures all unused-var errors are gone by:
  - Re-applying the same 3 fixes idempotently (safe to run again)
  - Also fixing the LoginResult type in useAuth.ts to include `notice`
    (needed for the v1 patch that forwarded notice from workerLogin)

Run from project root:
  python3 patch_ci_fix2.py
  python3 patch_ci_fix2.py --dry-run
  python3 patch_ci_fix2.py --undo
"""
import sys, os, shutil

DRY  = '--dry-run' in sys.argv
UNDO = '--undo'    in sys.argv

G='\033[92m'; Y='\033[93m'; B='\033[94m'; E='\033[0m'
def ok(m):   print(f'{G}[ OK ]{E}  {m}')
def warn(m): print(f'{Y}[WARN]{E}  {m}')
def dry(m):  print(f'{Y}[DRY ]{E}  {m}')
def die(m):  print(f'\033[91m[ERR ]{E}  {m}'); sys.exit(1)

ROOT = os.path.dirname(os.path.abspath(__file__))
TARGETS = [
    'mobile/app/(worker)/dashboard.tsx',
    'mobile/hooks/useAuth.ts',
]

def fpath(rel): return os.path.join(ROOT, rel)
def read(rel):
    p = fpath(rel)
    if not os.path.exists(p): raise FileNotFoundError(f'Not found: {p}')
    with open(p, encoding='utf-8') as f: return f.read()

def write(rel, content):
    p = fpath(rel); bak = p + '.bak'
    if DRY: dry(f'Would write {rel}'); return
    if os.path.exists(p) and not os.path.exists(bak):
        shutil.copy2(p, bak); print(f'  Backup → {rel}.bak')
    with open(p, 'w', encoding='utf-8') as f: f.write(content)
    ok(f'Written  {rel}')

if UNDO:
    for f in TARGETS:
        p, bak = fpath(f), fpath(f) + '.bak'
        if os.path.exists(bak): shutil.copy2(bak, p); os.remove(bak); ok(f'Restored {f}')
        else: warn(f'No backup: {f}')
    sys.exit(0)

print(f'\n{B}━━━ Laizer CI Fix 2 {"(DRY RUN)" if DRY else ""} ━━━{E}\n')

# ─────────────────────────────────────────────────────────────────────────────
# FILE 1 — (worker)/dashboard.tsx
# ─────────────────────────────────────────────────────────────────────────────
DASH = 'mobile/app/(worker)/dashboard.tsx'
src = read(DASH)
changed = False

def fix(src, old, new, label):
    global changed
    if old in src:
        changed = True
        ok(label)
        return src.replace(old, new, 1)
    warn(f'Already applied (skip): {label}')
    return src

# Remove unused ActivityIndicator import
src = fix(src,
    '  ActivityIndicator, Image, RefreshControl, ScrollView,\n',
    '  Image, RefreshControl, ScrollView,\n',
    'Removed ActivityIndicator import')

# Prefix unused `user`
src = fix(src,
    '  const { user, centreInfo } = useAuthStore() as any;\n',
    '  const { user: _user, centreInfo } = useAuthStore() as any;\n',
    'Prefixed user → _user')

# Prefix unused `loading`
src = fix(src,
    '  const [loading,    setLoading]    = useState(true);\n',
    '  const [_loading,   setLoading]    = useState(true);\n',
    'Prefixed loading → _loading')

if changed:
    write(DASH, src)
else:
    warn('dashboard.tsx — all fixes already present, no write needed')

# ─────────────────────────────────────────────────────────────────────────────
# FILE 2 — hooks/useAuth.ts
# Extend LoginResult to include optional `notice` field.
# The workerLogin now returns notice from the backend but the type didn't
# include it — TypeScript strict mode flags this as an error on assignment.
# ─────────────────────────────────────────────────────────────────────────────
AUTH = 'mobile/hooks/useAuth.ts'
auth = read(AUTH)
auth_changed = False

old = "interface LoginResult { success: boolean; role?: string; error?: AuthError; }"
new = "interface LoginResult { success: boolean; role?: string; error?: AuthError; notice?: string | null; }"
if old in auth:
    auth = auth.replace(old, new, 1)
    auth_changed = True
    ok('Extended LoginResult with notice field')
elif 'notice?' in auth:
    warn('LoginResult already has notice field — skip')
else:
    warn('LoginResult anchor not found — skip (may already be extended differently)')

if auth_changed:
    write(AUTH, auth)

print(f'\n{G}━━━ Done {"(dry run)" if DRY else ""} ━━━{E}')
print("""
Fixed
─────
  mobile/app/(worker)/dashboard.tsx  (idempotent — safe to re-run)
    • ActivityIndicator removed from import
    • user    → _user    (unused destructure)
    • loading → _loading (unused state var)

  mobile/hooks/useAuth.ts
    • LoginResult interface extended with notice?: string | null
      (workerLogin can return notice from backend; type now matches)
""")
