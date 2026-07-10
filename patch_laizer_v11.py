#!/usr/bin/env python3
"""
Laizer Patch v11 — Notices daily lifespan, report-detail popup crash fix,
worker side menu, and a real shared (app-wide) theme provider.

Run from the project root (same folder as patch_laizer_v9.py / v10):

    python3 patch_laizer_v11.py            # apply
    python3 patch_laizer_v11.py --dry-run  # preview only, writes nothing
    python3 patch_laizer_v11.py --undo     # restore the .bak11 files

Requires v9 and v10 already applied. Safe to run either way — hunks that
don't find their anchor are skipped with a warning rather than corrupting
the file.

WHAT THIS CHANGES
────────────────────────────────────────────────────────────────────────
1. Notices now expire at the NEXT MIDNIGHT after they're sent (not a
   fixed 48h window) — a day's notices belong to that day, and the owner
   writes a fresh one the next day. Two things enforce this even though
   the free-tier server can sleep/restart: (a) the notices list endpoint
   now hard-deletes anything already past its expiry before returning
   results, so it's correct the moment anyone opens the screen even if
   the server was asleep at midnight, and (b) a lightweight in-process
   timer sweeps for expired notices every 15 minutes as a second layer
   while the server is awake. Both screens now show how long a notice
   has left ("Expires in 3h 20m"). Reading a notice still only touches
   the read receipt, never the message body — that was already correct
   and is untouched.

2. Found the "Something went wrong" popup bug: the Reports screen calls
   `reportService.detail(...)` when you tap a card, but that method
   never existed in services/api.ts — only `.daily()` and `.weekly()`
   were defined. It wasn't a network/API error at all, just a missing
   client function throwing a plain JS error, which the generic error
   handler renders as "Something went wrong." Added the missing route
   constant and service method so it calls the (already-working) backend
   `/api/reports/detail/` endpoint that v9 added. Also found and fixed a
   third leftover Monday-based week calculation inside that same detail
   endpoint that v10's Sunday-boundary fix had missed, so the weekly
   popup's date range now matches the weekly list.

3. Worker screens get the same hamburger → side menu pattern as the
   owner dashboard, with light/dark mode and Sign Out (no Change
   Password there — workers don't have one). The underlying theme state
   is now a single app-wide provider instead of a private copy read by
   whichever screen happened to call the hook, so a change made from
   either dashboard's side menu is instantly shared everywhere that
   reads it, persisted per signed-in user, and never touched by anyone
   else's session. The worker dashboard is now fully wired to it,
   matching the owner dashboard's existing look. Extending every
   remaining list/detail screen to the new palette is a larger, separate
   pass (each needs its own considered pass over every text/background
   element to avoid readability regressions) — flagged at the end of
   this script rather than half-applied here.

This script is idempotent: re-running it after it already applied is a
no-op (it detects already-applied changes per file and skips them).
"""
import sys, os, shutil

DRY  = '--dry-run' in sys.argv
UNDO = '--undo'    in sys.argv

G='\033[92m'; Y='\033[93m'; B='\033[94m'; R='\033[91m'; E='\033[0m'
def ok(m):   print(f'{G}[ OK ]{E}  {m}')
def warn(m): print(f'{Y}[WARN]{E}  {m}')
def info(m): print(f'{B}[INFO]{E}  {m}')
def err(m):  print(f'{R}[ERR ]{E}  {m}')

ROOT = os.path.dirname(os.path.abspath(__file__))

def fp(rel):
    return os.path.join(ROOT, rel)

def find_root():
    global ROOT
    if os.path.isdir(fp('mobile')) and os.path.isdir(fp('backend')):
        return
    for child in os.listdir(ROOT):
        cand = os.path.join(ROOT, child)
        if os.path.isdir(os.path.join(cand, 'mobile')) and os.path.isdir(os.path.join(cand, 'backend')):
            ROOT = cand
            return

find_root()

BAK_EXT = '.bak11'
MARKER  = '__LAIZER_PATCH_V11__'

def read(rel):
    p = fp(rel)
    if not os.path.exists(p):
        return None
    with open(p, 'r', encoding='utf-8') as f:
        return f.read()

def write(rel, content):
    p = fp(rel)
    if DRY:
        info(f'(dry-run) would write {rel}')
        return
    os.makedirs(os.path.dirname(p), exist_ok=True)
    if os.path.exists(p) and not os.path.exists(p + BAK_EXT):
        shutil.copy2(p, p + BAK_EXT)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(content)
    ok(f'wrote {rel}')

def undo_all():
    count = 0
    for dirpath, _dirs, files in os.walk(ROOT):
        if 'node_modules' in dirpath or '.git' in dirpath:
            continue
        for fn in files:
            if fn.endswith(BAK_EXT):
                bak  = os.path.join(dirpath, fn)
                orig = bak[: -len(BAK_EXT)]
                shutil.move(bak, orig)
                ok(f'restored {os.path.relpath(orig, ROOT)}')
                count += 1
            elif fn.endswith(BAK_EXT + '.new'):
                sentinel = os.path.join(dirpath, fn)
                created  = sentinel[: -len(BAK_EXT + '.new')]
                if os.path.exists(created):
                    os.remove(created)
                    ok(f'removed {os.path.relpath(created, ROOT)} (was newly created by this patch)')
                os.remove(sentinel)
                count += 1
    if count == 0:
        warn('No .bak11 files found — nothing to undo.')
    else:
        ok(f'Restored {count} file(s).')
    sys.exit(0)

if UNDO:
    undo_all()

if not (os.path.isdir(fp('mobile')) and os.path.isdir(fp('backend'))):
    err('Could not find mobile/ and backend/ next to this script. '
        'Place patch_laizer_v11.py at the project root and re-run.')
    sys.exit(1)

info(f'Project root: {ROOT}')
if DRY:
    info('Dry run — no files will be modified.')

CHANGED_FILES = []

def patch_file(rel, replacements, label):
    content = read(rel)
    if content is None:
        err(f'{label}: file not found — {rel}')
        return False

    changed = False
    for old, new, desc in replacements:
        if new in content:
            info(f'{label}: "{desc}" already applied — skipping')
            continue
        if old not in content:
            warn(f'{label}: could not locate anchor for "{desc}" — '
                 f'file may already differ from what this patch expects. Skipping this hunk.')
            continue
        count = content.count(old)
        if count > 1:
            warn(f'{label}: anchor for "{desc}" is not unique ({count} matches) — '
                 f'replacing first occurrence only.')
        content = content.replace(old, new, 1)
        changed = True
        ok(f'{label}: applied "{desc}"')

    if changed:
        write(rel, content)
        CHANGED_FILES.append(rel)
    else:
        info(f'{label}: nothing to do')
    return changed

def rewrite_file(rel, new_content, label):
    content = read(rel)
    if content is not None and MARKER in content:
        info(f'{label}: already patched — skipping')
        return False
    write(rel, new_content)
    CHANGED_FILES.append(rel)
    ok(f'{label}: rewritten')
    return True

def create_file_if_missing(rel, content, label):
    if os.path.exists(fp(rel)):
        existing = read(rel)
        if existing is not None and MARKER in existing:
            info(f'{label}: already exists — skipping')
            return False
        warn(f'{label}: a file already exists at this path without our marker — '
             f'leaving it untouched. Remove it manually first if you want it regenerated.')
        return False
    write(rel, content)
    if not DRY:
        with open(fp(rel) + BAK_EXT + '.new', 'w') as f:
            f.write('created by patch_laizer_v11.py — deleted on --undo\n')
    CHANGED_FILES.append(rel)
    ok(f'{label}: created')
    return True


# ════════════════════════════════════════════════════════════════════════
# 1. backend/src/routes/notices.js — daily expiry + lazy cleanup
# ════════════════════════════════════════════════════════════════════════
patch_file('backend/src/routes/notices.js', [
    (
        "router.get('/', async (req, res, next) => {\n"
        "  try {\n"
        "    if (req.user.role === 'worker') {\n",

        "router.get('/', async (req, res, next) => {\n"
        "  try {\n"
        "    // " + MARKER + " — belt-and-braces cleanup: hard-delete anything past\n"
        "    // its expiry before answering, so this is correct immediately even if\n"
        "    // the periodic sweep in app.js hasn't run yet (e.g. server just woke\n"
        "    // up from a free-tier sleep).\n"
        "    await prisma.notice.deleteMany({ where: { expiresAt: { lte: new Date() } } });\n"
        "\n"
        "    if (req.user.role === 'worker') {\n",

        'lazy-delete expired notices before every GET',
    ),
    (
        "    const body  = parsed.data.body;\n"
        "    const title = parsed.data.title ?? (body.length > 60 ? body.substring(0,60)+'…' : body);\n"
        "    // Notices expire automatically after 48 hours\n"
        "    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);\n",

        "    const body  = parsed.data.body;\n"
        "    const title = parsed.data.title ?? (body.length > 60 ? body.substring(0,60)+'…' : body);\n"
        "    // " + MARKER + " — a notice belongs to the day it was sent: it expires\n"
        "    // at the next midnight, not a fixed 48h window, so the owner writes a\n"
        "    // fresh one each day rather than yesterday's notice quietly carrying over.\n"
        "    const expiresAt = new Date();\n"
        "    expiresAt.setHours(24, 0, 0, 0); // rolls forward to tomorrow 00:00:00\n",

        'notices expire at next midnight, not a fixed 48h window',
    ),
], 'notices.js')


# ════════════════════════════════════════════════════════════════════════
# 2. backend/src/app.js — periodic safety-net notice cleanup
# ════════════════════════════════════════════════════════════════════════
patch_file('backend/src/app.js', [
    (
        "app.use(errorHandler);\n"
        "\n"
        "module.exports = app;\n",

        "app.use(errorHandler);\n"
        "\n"
        "// " + MARKER + "\n"
        "// Second layer of the daily-notice cleanup (see routes/notices.js for the\n"
        "// primary lazy-delete-on-read layer): sweeps for anything already expired\n"
        "// every 15 minutes while the process is awake, so notices don't linger\n"
        "// purely because nobody happened to open the Notices screen.\n"
        "(function scheduleNoticeCleanup() {\n"
        "  const prisma = require('./lib/prisma');\n"
        "  const sweep = async () => {\n"
        "    try {\n"
        "      const { count } = await prisma.notice.deleteMany({ where: { expiresAt: { lte: new Date() } } });\n"
        "      if (count) console.log(`[Notices] Cleaned up ${count} expired notice(s).`);\n"
        "    } catch (e) { console.error('[Notices] cleanup sweep failed:', e.message); }\n"
        "  };\n"
        "  sweep();\n"
        "  setInterval(sweep, 15 * 60 * 1000);\n"
        "})();\n"
        "\n"
        "module.exports = app;\n",

        'schedule periodic expired-notice cleanup',
    ),
], 'app.js')


# ════════════════════════════════════════════════════════════════════════
# 3. backend/src/routes/reports.js — fix the leftover Monday-based week
#    calc inside /detail/ (v10 only fixed /weekly/'s copy of this)
# ════════════════════════════════════════════════════════════════════════
patch_file('backend/src/routes/reports.js', [
    (
        "      const ws = req.query.weekStart ? new Date(req.query.weekStart) : (() => {\n"
        "        const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d;\n"
        "      })();\n",

        "      // " + MARKER + " — Sunday, matches /weekly/'s boundary\n"
        "      const ws = req.query.weekStart ? new Date(req.query.weekStart) : (() => {\n"
        "        const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d;\n"
        "      })();\n",

        "/detail/ weekly week boundary: Monday → Sunday (matches /weekly/)",
    ),
], 'reports.js')


# ════════════════════════════════════════════════════════════════════════
# 4. mobile/constants/api.ts — add the missing reportDetail route constant
# ════════════════════════════════════════════════════════════════════════
patch_file('mobile/constants/api.ts', [
    (
        "  // Reports\n"
        "  reportDaily:  '/api/reports/daily/',\n"
        "  reportWeekly: '/api/reports/weekly/',\n",

        "  // Reports\n"
        "  reportDaily:  '/api/reports/daily/',\n"
        "  reportWeekly: '/api/reports/weekly/',\n"
        "  reportDetail: '/api/reports/detail/', // " + MARKER + "\n",

        'add reportDetail route constant',
    ),
], 'constants/api.ts')


# ════════════════════════════════════════════════════════════════════════
# 5. mobile/services/api.ts — add the missing reportService.detail() —
#    THIS is the actual "Something went wrong" bug from the screenshot.
# ════════════════════════════════════════════════════════════════════════
patch_file('mobile/services/api.ts', [
    (
        "  weekly: (params?: { weekStart?: string; centreId?: string }) => {\n"
        "    const q = new URLSearchParams(params as Record<string, string>).toString();\n"
        "    return apiClient.get(API_ROUTES.reportWeekly + (q ? `?${q}` : ''));\n"
        "  },\n"
        "};\n",

        "  weekly: (params?: { weekStart?: string; centreId?: string }) => {\n"
        "    const q = new URLSearchParams(params as Record<string, string>).toString();\n"
        "    return apiClient.get(API_ROUTES.reportWeekly + (q ? `?${q}` : ''));\n"
        "  },\n"
        "  // " + MARKER + " — this was missing entirely, which is why tapping a\n"
        "  // report card threw a plain JS \"not a function\" error that the generic\n"
        "  // handler rendered as \"Something went wrong.\"\n"
        "  detail: (params: { centreId: string; mode?: 'daily' | 'weekly'; date?: string; weekStart?: string }) => {\n"
        "    const q = new URLSearchParams(params as unknown as Record<string, string>).toString();\n"
        "    return apiClient.get(API_ROUTES.reportDetail + (q ? `?${q}` : ''));\n"
        "  },\n"
        "};\n",

        'add reportService.detail()',
    ),
], 'services/api.ts')


# ════════════════════════════════════════════════════════════════════════
# 6. mobile/app/(owner)/notices.tsx — accurate lifespan copy + expiry
#    label on each sent-notice card
# ════════════════════════════════════════════════════════════════════════
patch_file('mobile/app/(owner)/notices.tsx', [
    (
        "const MAX_WORDS = 100;\n"
        "\n"
        "function wordCount(txt: string) {\n"
        "  return txt.trim().split(/\\s+/).filter(Boolean).length;\n"
        "}\n",

        "const MAX_WORDS = 100;\n"
        "\n"
        "function wordCount(txt: string) {\n"
        "  return txt.trim().split(/\\s+/).filter(Boolean).length;\n"
        "}\n"
        "\n"
        "// " + MARKER + "\n"
        "function expiryLabel(expiresAt?: string | null): string | null {\n"
        "  if (!expiresAt) return null;\n"
        "  const diffMs = new Date(expiresAt).getTime() - Date.now();\n"
        "  if (diffMs <= 0) return 'Expired';\n"
        "  const hrs  = Math.floor(diffMs / 3600000);\n"
        "  const mins = Math.floor((diffMs % 3600000) / 60000);\n"
        "  return hrs >= 1 ? `Expires in ${hrs}h${mins ? ` ${mins}m` : ''}` : `Expires in ${mins}m`;\n"
        "}\n",

        'add expiryLabel() helper',
    ),
    (
        "          <Text style={{ fontSize: FontSize.xs, color: Colors.textDisabled, marginBottom: Spacing.sm }}>\n"
        "            Notices are automatically removed after 48 hours.\n"
        "          </Text>\n",

        "          <Text style={{ fontSize: FontSize.xs, color: Colors.textDisabled, marginBottom: Spacing.sm }}>\n"
        "            Notices for today are cleared automatically at midnight — send a new one each day.\n"
        "          </Text>\n",

        'update lifespan copy to match the new midnight expiry',
    ),
    (
        "              <View style={N.itemFooter}>\n"
        "                <Text style={N.itemMeta}>{new Date(item.createdAt).toLocaleDateString()}</Text>\n"
        "                <Text style={N.readCount}>{item._count?.reads ?? 0} read</Text>\n"
        "              </View>\n",

        "              <View style={N.itemFooter}>\n"
        "                <Text style={N.itemMeta}>{new Date(item.createdAt).toLocaleDateString()}</Text>\n"
        "                <Text style={N.readCount}>{item._count?.reads ?? 0} read</Text>\n"
        "              </View>\n"
        "              {expiryLabel(item.expiresAt) && (\n"
        "                <Text style={N.expiryTxt}>{expiryLabel(item.expiresAt)}</Text>\n"
        "              )}\n",

        'show expiry countdown on each sent-notice card',
    ),
    (
        "  readCount:    { fontSize:FontSize.xs, color:Colors.primary },\n"
        "});\n",

        "  readCount:    { fontSize:FontSize.xs, color:Colors.primary },\n"
        "  expiryTxt:    { fontSize:FontSize.xs, color:Colors.textDisabled, marginTop:Spacing.xs, fontStyle:'italic' }, // " + MARKER + "\n"
        "});\n",

        'add expiryTxt style',
    ),
], 'app/(owner)/notices.tsx')


# ════════════════════════════════════════════════════════════════════════
# 7. mobile/app/(worker)/notices.tsx — expiry label on inbox cards + modal
# ════════════════════════════════════════════════════════════════════════
patch_file('mobile/app/(worker)/notices.tsx', [
    (
        "export default function WorkerNoticesScreen() {\n",

        "// " + MARKER + "\n"
        "function expiryLabel(expiresAt?: string | null): string | null {\n"
        "  if (!expiresAt) return null;\n"
        "  const diffMs = new Date(expiresAt).getTime() - Date.now();\n"
        "  if (diffMs <= 0) return 'Expired';\n"
        "  const hrs  = Math.floor(diffMs / 3600000);\n"
        "  const mins = Math.floor((diffMs % 3600000) / 60000);\n"
        "  return hrs >= 1 ? `Expires in ${hrs}h${mins ? ` ${mins}m` : ''}` : `Expires in ${mins}m`;\n"
        "}\n"
        "\n"
        "export default function WorkerNoticesScreen() {\n",

        'add expiryLabel() helper',
    ),
    (
        "                <View style={NS.itemFooter}>\n"
        "                  <Text style={NS.itemSender}>\n"
        "                    From: {item.sender?.fullName ?? 'Owner'}\n"
        "                  </Text>\n"
        "                  <Text style={NS.itemTime}>\n"
        "                    {new Date(item.createdAt).toLocaleDateString('en-TZ', {\n"
        "                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',\n"
        "                    })}\n"
        "                  </Text>\n"
        "                </View>\n",

        "                <View style={NS.itemFooter}>\n"
        "                  <Text style={NS.itemSender}>\n"
        "                    From: {item.sender?.fullName ?? 'Owner'}\n"
        "                  </Text>\n"
        "                  <Text style={NS.itemTime}>\n"
        "                    {new Date(item.createdAt).toLocaleDateString('en-TZ', {\n"
        "                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',\n"
        "                    })}\n"
        "                  </Text>\n"
        "                </View>\n"
        "                {expiryLabel(item.expiresAt) && (\n"
        "                  <Text style={NS.expiryTxt}>{expiryLabel(item.expiresAt)}</Text>\n"
        "                )}\n",

        'show expiry countdown on each inbox card',
    ),
    (
        "                  {selected.readAt && (\n"
        "                    <Text style={NS.readAt}>\n"
        "                      ✓ Read {new Date(selected.readAt).toLocaleTimeString('en-TZ', {\n"
        "                        hour:'2-digit', minute:'2-digit',\n"
        "                      })}\n"
        "                    </Text>\n"
        "                  )}\n",

        "                  {selected.readAt && (\n"
        "                    <Text style={NS.readAt}>\n"
        "                      ✓ Read {new Date(selected.readAt).toLocaleTimeString('en-TZ', {\n"
        "                        hour:'2-digit', minute:'2-digit',\n"
        "                      })}\n"
        "                    </Text>\n"
        "                  )}\n"
        "                  {expiryLabel(selected.expiresAt) && (\n"
        "                    <Text style={NS.expiryTxt}>{expiryLabel(selected.expiresAt)}</Text>\n"
        "                  )}\n",

        'show expiry countdown in the notice detail modal',
    ),
    (
        "  itemSender:     { fontSize: FontSize.xs, color: Colors.textDisabled },\n"
        "  itemTime:       { fontSize: FontSize.xs, color: Colors.textDisabled },\n",

        "  itemSender:     { fontSize: FontSize.xs, color: Colors.textDisabled },\n"
        "  itemTime:       { fontSize: FontSize.xs, color: Colors.textDisabled },\n"
        "  expiryTxt:      { fontSize: FontSize.xs, color: Colors.textDisabled, marginTop: 4, fontStyle:'italic' }, // " + MARKER + "\n",

        'add expiryTxt style',
    ),
], 'app/(worker)/notices.tsx')


# ════════════════════════════════════════════════════════════════════════
# 8. NEW FILE — mobile/store/ThemeProvider.tsx (shared, app-wide theme)
# ════════════════════════════════════════════════════════════════════════
THEME_PROVIDER_TSX = '''/**
 * SMSS — Theme Provider
 * ''' + MARKER + '''
 *
 * Single, app-wide source of truth for light/dark mode. Previously each
 * screen that wanted the theme called a hook that read its own private
 * copy from storage — a toggle on one screen had no way to reach any
 * other screen already on stack. This Provider is mounted ONCE at the
 * root (see app/_layout.tsx) so every screen that calls useTheme() reads
 * and writes the exact same live state.
 *
 * Persisted per signed-in user (AsyncStorage keyed by their id), so it
 * stays exactly as that person left it until THEY change it again, and
 * never leaks into another person's session on a shared device.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/authStore';

export type AppTheme = 'light' | 'dark';

export interface ThemeColors {
  bg: string; card: string; text: string; textSec: string; border: string; input: string;
}

const LIGHT: ThemeColors = { bg:'#F9FAFB', card:'#FFFFFF', text:'#111827', textSec:'#6B7280', border:'#E5E7EB', input:'#FFFFFF' };
const DARK:  ThemeColors = { bg:'#111827', card:'#1F2937', text:'#F9FAFB', textSec:'#9CA3AF', border:'#374151', input:'#374151' };

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
  isDark: boolean;
  tc: ThemeColors;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light', setTheme: () => {}, isDark: false, tc: LIGHT,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const storageKey = `theme:${user?.id ?? 'default'}`;
  const [theme, setThemeState] = useState<AppTheme>('light');

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(storageKey)
      .then(v => {
        if (!live) return;
        setThemeState(v === 'light' || v === 'dark' ? v : 'light');
      })
      .catch(() => {});
    return () => { live = false; };
  }, [storageKey]);

  const setTheme = useCallback(async (t: AppTheme) => {
    setThemeState(t);
    try { await AsyncStorage.setItem(storageKey, t); } catch {}
  }, [storageKey]);

  const value: ThemeContextValue = {
    theme, setTheme, isDark: theme === 'dark', tc: theme === 'dark' ? DARK : LIGHT,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
'''
create_file_if_missing('mobile/store/ThemeProvider.tsx', THEME_PROVIDER_TSX, 'store/ThemeProvider.tsx')


# ════════════════════════════════════════════════════════════════════════
# 9. mobile/hooks/useTheme.ts — now a thin wrapper around the shared
#    provider, so every existing `useTheme()` call site (dashboard.tsx)
#    keeps working unchanged but is now backed by shared state.
# ════════════════════════════════════════════════════════════════════════
USE_THEME_TS = '''// Laizer — Per-user theme hook (light / dark)
// ''' + MARKER + '''
// Backed by the single shared ThemeProvider (mounted once in
// app/_layout.tsx) instead of a private per-screen copy, so toggling the
// mode from ANY screen's side menu instantly applies to every other
// screen for the same signed-in user. Same return shape as before, so
// every existing call site keeps working unchanged.
export { useAppTheme as useTheme } from '@/store/ThemeProvider';
export type { AppTheme, ThemeColors } from '@/store/ThemeProvider';
'''

def rewrite_use_theme():
    content = read('mobile/hooks/useTheme.ts')
    if content is not None and MARKER in content:
        info('hooks/useTheme.ts: already patched — skipping')
        return False
    write('mobile/hooks/useTheme.ts', USE_THEME_TS)
    CHANGED_FILES.append('mobile/hooks/useTheme.ts')
    ok('hooks/useTheme.ts: rewritten to share the app-wide ThemeProvider')
    return True

rewrite_use_theme()


# ════════════════════════════════════════════════════════════════════════
# 10. mobile/app/_layout.tsx — mount <ThemeProvider> around the app
# ════════════════════════════════════════════════════════════════════════
patch_file('mobile/app/_layout.tsx', [
    (
        "import { CustomAlertHost } from '@/components/ui'; // __LAIZER_PATCH_V10__\n",

        "import { CustomAlertHost } from '@/components/ui'; // __LAIZER_PATCH_V10__\n"
        "import { ThemeProvider } from '@/store/ThemeProvider'; // " + MARKER + "\n",

        'import ThemeProvider',
    ),
    (
        "  return (\n"
        "    <>\n"
        "      <Slot />\n"
        "      <StatusBar style=\"auto\" />\n"
        "      <CustomAlertHost />\n"
        "    </>\n"
        "  );\n"
        "}\n",

        "  return (\n"
        "    <ThemeProvider>\n"
        "      <Slot />\n"
        "      <StatusBar style=\"auto\" />\n"
        "      <CustomAlertHost />\n"
        "    </ThemeProvider>\n"
        "  );\n"
        "}\n",

        'wrap the app in ThemeProvider',
    ),
], 'app/_layout.tsx')


# ════════════════════════════════════════════════════════════════════════
# 11. mobile/app/(worker)/dashboard.tsx — full rewrite: hamburger + side
#     menu (light/dark toggle + Sign Out), themed to match the palette
#     the owner dashboard already uses.
# ════════════════════════════════════════════════════════════════════════
WORKER_DASHBOARD_TSX = '''/**
 * Laizer — Worker Dashboard
 * Profile card: owner pic + brand name + branch info (no personal name).
 * ''' + MARKER + ''' — hamburger opens a side menu (light/dark mode, Sign Out),
 * matching the owner dashboard. No Change Password here — workers log in
 * with a Worker ID + Centre ID, not a password.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Image, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import type { ComponentProps } from 'react';
import { CustomAlert }    from '@/components/ui/CustomAlert';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter }      from 'expo-router';
import { useAuthStore }   from '@/store/authStore';
import { useAuth }        from '@/hooks/useAuth';
import { useTheme }       from '@/hooks/useTheme';
import { serviceEventService, stockService, noticeService } from '@/services/api';
import { Card }           from '@/components/ui';
import { BrandColors, Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

function fmt(n: number) { return `Tshs ${n.toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`; }

export let globalUnreadCount = 0;
export function setGlobalUnreadCount(n: number) { globalUnreadCount = n; }

export default function WorkerDashboard() {
  const { user: _user, centreInfo } = useAuthStore() as any;
  const { logout }           = useAuth();
  const { theme, setTheme, isDark, tc } = useTheme();
  const router               = useRouter();
  const [events,     setEvents]     = useState<any[]>([]);
  const [stockLow,   setStockLow]   = useState<any[]>([]);
  const [unreadCnt,  setUnreadCnt]  = useState(0);
  const [_loading,   setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Side menu
  const [sideOpen, setSideOpen] = useState(false);
  const sideAnim = useRef(new Animated.Value(-280)).current;
  const openSide  = () => { setSideOpen(true);  Animated.spring(sideAnim, { toValue:0,   useNativeDriver:true }).start(); };
  const closeSide = () => { Animated.spring(sideAnim, { toValue:-280, useNativeDriver:true }).start(() => setSideOpen(false)); };

  const load = useCallback(async () => {
    try {
      const [ev, st, nt] = await Promise.allSettled([
        serviceEventService.list(), stockService.list(), noticeService.list(),
      ]);
      if (ev.status === 'fulfilled') setEvents(ev.value.data ?? []);
      if (st.status === 'fulfilled') setStockLow((st.value.data ?? []).filter((i: any) => Number(i.quantity) < 5));
      if (nt.status === 'fulfilled') {
        const n = (nt.value.data ?? []).filter((n: any) => !n.isRead).length;
        setUnreadCnt(n); setGlobalUnreadCount(n);
      }
    } catch (e) { console.error('[WorkerDash]', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const revenue    = events.reduce((s, e) => s + Number(e.totalAmountTshs), 0);
  const brand      = centreInfo?.brandName      ?? 'Laizer Stationery';
  const branchName = centreInfo?.name           ?? 'Your Branch';
  const branchLoc  = centreInfo?.location       ?? '';
  const branchId   = centreInfo?.centreId       ?? '—';
  const ownerPic   = centreInfo?.profilePicture ?? null;

  return (
    <View style={[WD.root, { backgroundColor: tc.bg }]}>
      <LinearGradient colors={[BrandColors.teal, '#0E7490']} style={WD.header}>
        <TouchableOpacity onPress={openSide} style={WD.menuBtn} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
          <Ionicons name="menu-outline" size={26} color="white" />
        </TouchableOpacity>

        <View style={WD.card}>
          <View style={WD.avatar}>
            {ownerPic
              ? <Image source={{ uri: ownerPic }} style={WD.avatarImg} />
              : <View style={WD.avatarFallback}><Ionicons name="storefront" size={28} color={BrandColors.teal} /></View>}
          </View>
          <View style={{ flex:1 }}>
            <Text style={WD.brand} numberOfLines={1}>{brand}</Text>
            <Text style={WD.branchLine} numberOfLines={1}>📍 {branchName}{branchLoc ? ` · ${branchLoc}` : ''}</Text>
            <View style={WD.idRow}>
              <Text style={WD.idLabel}>Branch ID</Text>
              <Text style={WD.idVal}>{branchId}</Text>
            </View>
          </View>
        </View>

        <View style={WD.stats}>
          <Stat label="Today's Revenue"  value={fmt(revenue)}          icon="cash-outline" />
          <Stat label="Services Today"   value={String(events.length)} icon="list-outline" />
          <Stat label="Unread Notices"   value={String(unreadCnt)}     icon="megaphone-outline" />
        </View>
      </LinearGradient>

      <ScrollView style={WD.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        showsVerticalScrollIndicator={false}>
        <Text style={[WD.sectionTitle, { color: tc.text }]}>Quick Actions</Text>
        <View style={WD.actions}>
          {[
            { label:'Log Service', icon:'create-outline'    as const, route:'/(worker)/services' },
            { label:'View Stock',  icon:'cube-outline'      as const, route:'/(worker)/stock'    },
            { label:'Notices',     icon:'megaphone-outline' as const, route:'/(worker)/notices'  },
            { label:'Office Utilities', icon:'hardware-chip-outline' as const, route:'/(worker)/equipment' },
          ].map(a => (
            <Card key={a.route} onPress={() => router.push(a.route as any)}
              style={[WD.actionCard, { backgroundColor: tc.card, borderColor: tc.border }]}>
              <Ionicons name={a.icon} size={30} color={Colors.primary} style={{ marginBottom:6 }} />
              <Text style={[WD.actionLabel, { color: tc.text }]}>{a.label}</Text>
            </Card>
          ))}
        </View>
        {stockLow.length > 0 && (
          <>
            <Text style={[WD.sectionTitle, { color: tc.text }]}>⚠️ Low Stock</Text>
            {stockLow.map((s, i) => (
              <Card key={i} style={[WD.stockCard, { backgroundColor: tc.card, borderColor: tc.border }]}>
                <Text style={[WD.stockName, { color: tc.text }]}>{s.itemName}</Text>
                <Text style={WD.stockQty}>{s.quantity} left</Text>
              </Card>
            ))}
          </>
        )}
        <View style={{ height:40 }} />
      </ScrollView>

      {/* ── Side Menu ────────────────────────────────────────────────── */}
      {sideOpen && (
        <TouchableOpacity style={WD.sideOverlay} activeOpacity={1} onPress={closeSide} />
      )}
      {sideOpen && (
        <Animated.View style={[WD.sidebar, { transform:[{ translateX: sideAnim }], backgroundColor: isDark ? '#1F2937' : Colors.white }]}>
          <LinearGradient colors={[BrandColors.teal, '#0E7490']} style={WD.sideHeader}>
            <View style={WD.sideAvatar}>
              <Ionicons name="storefront" size={26} color={BrandColors.teal} />
            </View>
            <Text style={WD.sideName} numberOfLines={1}>{branchName}</Text>
            <Text style={WD.sideBrand} numberOfLines={1}>{brand}</Text>
          </LinearGradient>

          <View style={WD.sideMenu}>
            {/* Dark / Light mode */}
            <View style={WD.sideSection}>
              <Text style={[WD.sideSectionTitle, { color: isDark ? Colors.grey400 : Colors.textDisabled }]}>APPEARANCE</Text>
              <View style={WD.modeRow}>
                {(['light','dark'] as const).map(t => (
                  <TouchableOpacity key={t} style={[WD.modeBtn, theme===t && WD.modeBtnActive]}
                    onPress={() => setTheme(t)} activeOpacity={0.8}>
                    <Ionicons name={t==='light' ? 'sunny-outline' : 'moon-outline'} size={18}
                      color={theme===t ? Colors.white : (isDark ? Colors.grey300 : Colors.textSecondary)} />
                    <Text style={[WD.modeBtnTxt, theme===t && WD.modeBtnTxtActive]}>
                      {t.charAt(0).toUpperCase()+t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Sign out */}
            <TouchableOpacity style={[WD.sideItem, WD.sideLogout]} onPress={() => {
              closeSide();
              setTimeout(() => CustomAlert.alert('Sign out', 'Are you sure you want to sign out?', [
                { text:'Cancel', style:'cancel' },
                { text:'Sign out', style:'destructive', onPress: logout },
              ]), 350);
            }}>
              <Ionicons name="log-out-outline" size={20} color={Colors.error} />
              <Text style={[WD.sideItemTxt, { color: Colors.error }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function Stat({ label, value, icon }: { label:string; value:string; icon: ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={WD.stat}>
      <Ionicons name={icon} size={20} color="rgba(255,255,255,0.85)" style={{ marginBottom:2 }} />
      <Text style={WD.statVal}>{value}</Text>
      <Text style={WD.statLbl}>{label}</Text>
    </View>
  );
}

const WD = StyleSheet.create({
  root:          { flex:1, backgroundColor:Colors.background },
  header:        { paddingTop:52, paddingHorizontal:Spacing.xl, paddingBottom:Spacing['2xl'] },
  menuBtn:       { alignSelf:'flex-start', marginBottom:Spacing.sm },
  card:          { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:'rgba(255,255,255,0.15)', borderRadius:Radius.xl, padding:Spacing.base, marginBottom:Spacing.xl },
  avatar:        { width:64, height:64, borderRadius:32, overflow:'hidden' },
  avatarImg:     { width:64, height:64 },
  avatarFallback:{ width:64, height:64, borderRadius:32, backgroundColor:'rgba(255,255,255,0.9)', alignItems:'center', justifyContent:'center' },
  brand:         { fontSize:FontSize.lg, fontWeight:FontWeight.black, color:Colors.white, letterSpacing:0.5, marginBottom:3 },
  branchLine:    { fontSize:FontSize.sm, color:'rgba(255,255,255,0.8)', marginBottom:4 },
  idRow:         { flexDirection:'row', alignItems:'center', gap:6 },
  idLabel:       { fontSize:FontSize.xs, color:'rgba(255,255,255,0.55)', fontWeight:FontWeight.semiBold },
  idVal:         { fontSize:FontSize.sm, fontWeight:FontWeight.bold, color:Colors.white, backgroundColor:'rgba(255,255,255,0.2)', paddingHorizontal:8, paddingVertical:2, borderRadius:Radius.full },
  stats:         { flexDirection:'row', gap:Spacing.sm },
  stat:          { flex:1, backgroundColor:'rgba(255,255,255,0.15)', borderRadius:Radius.md, padding:Spacing.md, alignItems:'center' },
  statVal:       { fontSize:FontSize.md, fontWeight:FontWeight.black, color:Colors.white },
  statLbl:       { fontSize:9, color:'rgba(255,255,255,0.7)', textAlign:'center', marginTop:1 },
  body:          { flex:1, padding:Spacing.xl },
  sectionTitle:  { fontSize:FontSize.md, fontWeight:FontWeight.bold, color:Colors.textPrimary, marginBottom:Spacing.md, marginTop:Spacing.base },
  actions:       { flexDirection:'row', flexWrap:'wrap', gap:Spacing.md, marginBottom:Spacing.sm },
  actionCard:    { flexBasis:'45%', flexGrow:1, alignItems:'center', paddingVertical:Spacing.base },
  actionLabel:   { fontSize:FontSize.sm, fontWeight:FontWeight.semiBold, color:Colors.textPrimary, textAlign:'center' },
  stockCard:     { flexDirection:'row', justifyContent:'space-between', marginBottom:Spacing.xs },
  stockName:     { fontSize:FontSize.sm, fontWeight:FontWeight.semiBold, color:Colors.textPrimary },
  stockQty:      { fontSize:FontSize.sm, color:Colors.error, fontWeight:FontWeight.bold },
  // Side menu
  sideOverlay:   { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.45)', zIndex:10 },
  sidebar:       { position:'absolute', top:0, left:0, bottom:0, width:280, zIndex:11, elevation:20 },
  sideHeader:    { paddingTop:60, padding:Spacing.xl, alignItems:'center' },
  sideAvatar:    { width:68, height:68, borderRadius:34, backgroundColor:'rgba(255,255,255,0.9)', alignItems:'center', justifyContent:'center', marginBottom:10, overflow:'hidden' },
  sideName:      { fontSize:FontSize.md, fontWeight:FontWeight.bold, color:Colors.white },
  sideBrand:     { fontSize:FontSize.sm, color:'rgba(255,255,255,0.8)', marginTop:2 },
  sideMenu:      { flex:1, padding:Spacing.xl },
  sideSection:   { marginBottom:Spacing.xl },
  sideSectionTitle:{ fontSize:10, fontWeight:FontWeight.bold, letterSpacing:1, marginBottom:Spacing.sm },
  modeRow:       { flexDirection:'row', gap:8 },
  modeBtn:       { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:10, borderRadius:Radius.md, borderWidth:1.5, borderColor:Colors.border },
  modeBtnActive: { backgroundColor:Colors.primary, borderColor:Colors.primary },
  modeBtnTxt:    { fontSize:FontSize.sm, color:Colors.textSecondary, fontWeight:FontWeight.medium },
  modeBtnTxtActive:{ color:Colors.white, fontWeight:FontWeight.bold },
  sideItem:      { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:12 },
  sideItemTxt:   { fontSize:FontSize.base, fontWeight:FontWeight.medium },
  sideLogout:    { marginTop:'auto' },
});
'''
rewrite_file('mobile/app/(worker)/dashboard.tsx', WORKER_DASHBOARD_TSX, 'app/(worker)/dashboard.tsx')


# ════════════════════════════════════════════════════════════════════════
# Summary
# ════════════════════════════════════════════════════════════════════════
print()
if CHANGED_FILES:
    ok(f'Patched {len(CHANGED_FILES)} file(s):')
    for f in CHANGED_FILES:
        print(f'   • {f}')
else:
    info('No files needed changes (already patched, or anchors not found — see warnings above).')

if not DRY and CHANGED_FILES:
    print()
    info('No Prisma/schema changes this round — no `prisma db push` needed.')
    info('Just restart the backend and reload the app (clear Metro cache if')
    info('things look stale: `npx expo start -c`).')
    print()
    info('SCOPE NOTE: light/dark mode is now a real shared, per-user state')
    info('(any screen calling useTheme() reads/writes the same live value),')
    info('and both dashboards (owner + worker) are fully wired to it. The')
    info("other list/detail screens (Centres, Workers, Reports, Notices,")
    info("Stock, Equipment, Services) still render in light mode regardless")
    info("of the setting — extending each of those is a bigger follow-up so")
    info("I don't risk unreadable text by rushing it. Say the word and")
    info("I'll do that pass next.")
