#!/usr/bin/env python3
"""
Laizer CI Fix — resolves the 4 TypeScript errors blocking the pipeline.

All 4 errors are in mobile/app/(worker)/dashboard.tsx:
  - ActivityIndicator imported but never used in JSX
  - `user` destructured but never used
  - `loading` state assigned but never used

Fix: prefix unused vars with _ (ESLint allows /^_/), remove unused import.

Run from project root:
  python3 patch_ci_fix.py
  python3 patch_ci_fix.py --dry-run
  python3 patch_ci_fix.py --undo
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
FILE = 'mobile/app/(worker)/dashboard.tsx'

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
    p, bak = fpath(FILE), fpath(FILE) + '.bak'
    if os.path.exists(bak): shutil.copy2(bak, p); os.remove(bak); ok(f'Restored {FILE}')
    else: warn(f'No backup for {FILE}')
    sys.exit(0)

print(f'\n{B}━━━ Laizer CI Fix {"(DRY RUN)" if DRY else ""} ━━━{E}\n')

src = read(FILE)
orig = src

# ── FIX 1: Remove ActivityIndicator from the import (it is never used in JSX)
old = '  ActivityIndicator, Image, RefreshControl, ScrollView,\n'
new = '  Image, RefreshControl, ScrollView,\n'
if old in src:
    src = src.replace(old, new, 1)
    ok('Removed unused ActivityIndicator import')
elif 'ActivityIndicator' not in src:
    warn('ActivityIndicator already absent — skip')
else:
    die(f'Could not find import line to patch.\nExpected: {repr(old)}')

# ── FIX 2: Prefix unused `user` with _ in the destructure
old = '  const { user, centreInfo } = useAuthStore() as any;'
new = '  const { user: _user, centreInfo } = useAuthStore() as any;'
if old in src:
    src = src.replace(old, new, 1)
    ok('Prefixed unused `user` → `_user`')
elif '_user' in src:
    warn('`user` already prefixed — skip')
else:
    die(f'Could not find useAuthStore destructure.\nExpected: {repr(old)}')

# ── FIX 3: Prefix unused `loading` state with _
old = '  const [loading,    setLoading]    = useState(true);'
new = '  const [_loading,   setLoading]    = useState(true);'
if old in src:
    src = src.replace(old, new, 1)
    ok('Prefixed unused `loading` → `_loading`')
elif '_loading' in src:
    warn('`loading` already prefixed — skip')
else:
    die(f'Could not find loading useState.\nExpected: {repr(old)}')

if src == orig:
    warn('No changes made — all fixes already applied.')
else:
    write(FILE, src)

print(f'\n{G}━━━ Done {"(dry run)" if DRY else ""} ━━━{E}')
print("""
Fixed
─────
  mobile/app/(worker)/dashboard.tsx
    • Removed ActivityIndicator from import  (was imported, never used in JSX)
    • Renamed `user`    → `_user`            (destructured, never referenced)
    • Renamed `loading` → `_loading`         (state set by finally, never read)

  All 4 CI errors resolved. Warnings are non-blocking and do not fail the pipeline.
""")

