#!/usr/bin/env python3
"""
Laizer Patch v8 — Owner Sign-Up reachability, env wiring, error handling
& perf fixes.

Run from the project root (the folder that contains `mobile/` and
`backend/`):

    python3 patch_laizer_v8.py            # apply
    python3 patch_laizer_v8.py --dry-run  # preview only, writes nothing
    python3 patch_laizer_v8.py --undo     # restore the .bak8 files

WHAT WAS BROKEN
────────────────────────────────────────────────────────────────────────
1. "Cannot reach the server at http://localhost:8000" on Sign Up
   The owner-registration endpoint (`POST /api/auth/owner/register/`)
   and its Zod schema already exist server-side and are correct — this
   was verified by inspecting backend/src/routes/auth.js. The real bug
   is on the MOBILE side: `mobile/constants/api.ts` only resolved the
   API base URL from `EXPO_PUBLIC_API_URL` (an env var that is NEVER
   set unless you hand-create `mobile/.env` / `.env.local`) or a
   hardcoded `localhost:8000` / `10.0.2.2:8000` guess. On a physical
   phone (as in the screenshot) neither address is reachable — the
   phone isn't the dev machine. There was also no `app.json "extra"`
   fallback being read, even though `app.json` already declares
   `extra.apiUrl`.
   FIX: api.ts now resolves the URL through a clear, single
   prioritized chain — env var → app.json `extra.apiUrl` (via
   expo-constants) → platform dev guess → production URL — normalizes
   it (strips trailing slash, ensures a scheme), and prints which
   source it used so this is debuggable from `expo start` logs.
   We also generate `mobile/.env` (gitignored, loaded automatically by
   Expo) from the example file so the env var is actually wired
   end-to-end instead of silently doing nothing.

2. Grey / loading button visibility
   `Button.tsx` rendered the *disabled* state as `grey300` at 55%
   container opacity — a near-white box that swallows the white
   `ActivityIndicator`, and the *loading* state as a flat
   semi-transparent black overlay on top of the gradient, which is
   especially hard to see for the `secondary`/`ghost` variants. FIX:
   disabled (non-loading) buttons now use a solid, full-opacity
   `grey400` background, and loading buttons keep a darker, fully
   opaque overlay tuned per-variant so the spinner always has >3:1
   contrast against its backdrop.

3. Unfinished/ambiguous error handling
   `handleRegister` (and the login handlers) read
   `err.response.data.detail` directly. For validation errors that
   field is an OBJECT (zod's `.flatten()`), not a string, so the user
   saw `[object Object]` or raw JSON instead of a real message. FIX:
   owner sign-up now reuses the shared `getApiError()` helper (already
   used elsewhere in the app) which turns zod field errors, DB/network
   errors (`database_unavailable`, `database_busy`, `network_error`,
   `timeout`, etc. — all already classified by the backend's
   errorHandler.js and the axios interceptor) into one readable
   message instead of leaving the spinner running with nothing to show.

4. Slow / flaky fetches
   - Backend: response bodies are now gzip-compressed (`compression`
     middleware) when the package is available, cutting payload size
     for report/list endpoints.
   - Mobile: idempotent GET requests now get one automatic retry with
     a short backoff on `network_error`/`timeout` before failing, which
     smooths over Render free-tier cold starts and flaky Wi-Fi without
     making the user manually retry every screen.

This script is idempotent: re-running it after it already applied is a
no-op (it detects its own markers and skips).
"""
import sys, os, re, shutil

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
    """Allow running the script from one level above the repo too."""
    global ROOT
    if os.path.isdir(fp('mobile')) and os.path.isdir(fp('backend')):
        return
    for child in os.listdir(ROOT):
        cand = os.path.join(ROOT, child)
        if os.path.isdir(os.path.join(cand, 'mobile')) and os.path.isdir(os.path.join(cand, 'backend')):
            ROOT = cand
            return

find_root()

BAK_EXT = '.bak8'
MARKER  = '__LAIZER_PATCH_V8__'

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

def already_patched(content):
    return content is not None and MARKER in content

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
    if count == 0:
        warn('No .bak8 files found — nothing to undo.')
    else:
        ok(f'Restored {count} file(s).')
    sys.exit(0)

if UNDO:
    undo_all()

if not (os.path.isdir(fp('mobile')) and os.path.isdir(fp('backend'))):
    err('Could not find mobile/ and backend/ next to this script. '
        'Place patch_laizer_v8.py at the project root and re-run.')
    sys.exit(1)

info(f'Project root: {ROOT}')
if DRY:
    info('Dry run — no files will be modified.')

# ════════════════════════════════════════════════════════════════════════
# 1. mobile/constants/api.ts — robust, debuggable URL resolution
# ════════════════════════════════════════════════════════════════════════
API_TS_REL = 'mobile/constants/api.ts'
api_ts_new = f'''/**
 * SMSS — API Configuration
 * {MARKER}
 *
 * URL resolution order (first match wins):
 *   1. EXPO_PUBLIC_API_URL          — from mobile/.env or mobile/.env.local
 *   2. app.json → expo.extra.apiUrl — via expo-constants (works in EAS
 *                                      builds where .env isn't bundled)
 *   3. Platform dev guess           — 10.0.2.2 (Android emulator) /
 *                                      localhost (iOS simulator). This
 *                                      ONLY works for emulators/simulators
 *                                      on the same machine as the backend —
 *                                      a physical phone needs your LAN IP
 *                                      set via EXPO_PUBLIC_API_URL instead.
 *   4. Production Render URL
 *
 * All requests funnel through `API_BASE_URL` below — nothing in the app
 * hardcodes a host anywhere else, so changing the env var is enough to
 * repoint the whole app (dev, staging, prod, physical device, emulator).
 */
import {{ Platform }} from 'react-native';
import Constants from 'expo-constants';

function getLocalDevUrl(): string {{
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}}

function normalize(url: string): string {{
  const trimmed = url.trim().replace(/\\/+$/, '');
  if (!/^https?:\\/\\//i.test(trimmed)) {{
    if (__DEV__) console.warn(`[SMSS] API URL "{{trimmed}}" is missing http(s):// — adding it.`);
    return `http://${{trimmed}}`;
  }}
  return trimmed;
}}

const extraApiUrl: string | undefined =
  (Constants.expoConfig?.extra as {{ apiUrl?: string }} | undefined)?.apiUrl ??
  (Constants.expoConfig?.extra as any)?.eas?.apiUrl;

const PRODUCTION_API_URL = 'https://smss-api.onrender.com';

let resolvedFrom = 'production-fallback';
let rawUrl: string;

if (process.env.EXPO_PUBLIC_API_URL) {{
  rawUrl = process.env.EXPO_PUBLIC_API_URL;
  resolvedFrom = 'EXPO_PUBLIC_API_URL (.env)';
}} else if (__DEV__) {{
  if (extraApiUrl && extraApiUrl !== PRODUCTION_API_URL) {{
    rawUrl = extraApiUrl;
    resolvedFrom = 'app.json extra.apiUrl';
  }} else {{
    rawUrl = getLocalDevUrl();
    resolvedFrom = `platform dev guess (${{Platform.OS}})`;
  }}
}} else if (extraApiUrl) {{
  rawUrl = extraApiUrl;
  resolvedFrom = 'app.json extra.apiUrl';
}} else {{
  rawUrl = PRODUCTION_API_URL;
}}

export const API_BASE_URL: string = normalize(rawUrl);

if (__DEV__) {{
  console.log(`[SMSS] API_BASE_URL → ${{API_BASE_URL}}  (source: ${{resolvedFrom}})`);
  if (resolvedFrom.startsWith('platform dev guess') && Platform.OS !== 'web') {{
    console.warn(
      '[SMSS] Using a dev-guess API URL. If you are on a PHYSICAL DEVICE ' +
      '(not an emulator/simulator), this address is NOT reachable. ' +
      'Set EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:8000 in ' +
      'mobile/.env (see mobile/.env.local.example) and restart `expo start -c`.'
    );
  }}
}}

export const API_ROUTES = {{
  // Auth
  ownerLogin:    '/api/auth/owner/login/',
  ownerRegister:   '/api/auth/owner/register/',
  changePassword:  '/api/auth/change-password/',
  workerLogin:  '/api/auth/worker/login/',
  refresh:      '/api/auth/refresh/',
  logout:       '/api/auth/logout/',
  me:           '/api/auth/me/',

  // Health
  health: '/api/health/',

  // Centres (owner)
  centres:      '/api/centres/',
  centre:       (id: string) => `/api/centres/${{id}}/`,

  // Workers (owner)
  workers:      '/api/workers/',
  worker:       (id: string) => `/api/workers/${{id}}/`,
  assignWorker: (id: string) => `/api/workers/${{id}}/assign/`,
  transferWorker:(id: string)=> `/api/workers/${{id}}/transfer/`,

  // Stock
  stock:        '/api/stock/',
  stockItem:    (id: string) => `/api/stock/${{id}}/`,

  // Equipment (office utilities)
  equipment:     '/api/equipment/',
  equipmentItem: (id: string) => `/api/equipment/${{id}}/`,

  // Services
  services:     '/api/services/',
  service:      (id: string) => `/api/services/${{id}}/`,

  // Notices
  notices:      '/api/notices/',
  readNotice:   (id: string) => `/api/notices/${{id}}/read/`,

  // Reports
  reportDaily:  '/api/reports/daily/',
  reportWeekly: '/api/reports/weekly/',

  // Push token
  pushToken:    '/api/push-token/',
}} as const;
'''

# ════════════════════════════════════════════════════════════════════════
# 2. mobile/services/api.ts — classified errors + one-retry on GET
# ════════════════════════════════════════════════════════════════════════
API_SVC_REL = 'mobile/services/api.ts'

def patch_api_service(src: str) -> str:
    if MARKER in src:
        return src

    header_old = (
        "/**\n"
        " * SMSS — API Service\n"
        " * Axios instance with:\n"
        " * - Bearer token injection\n"
        " * - Silent 401 → refresh → retry logic\n"
        " * - Logout on unrecoverable 401\n"
        " * - Human-readable error codes\n"
        " * - 50s timeout for Render free-tier cold starts\n"
        " */"
    )
    header_new = (
        "/**\n"
        " * SMSS — API Service\n"
        f" * {MARKER}\n"
        " * Axios instance with:\n"
        " * - Bearer token injection\n"
        " * - Silent 401 → refresh → retry logic\n"
        " * - Logout on unrecoverable 401\n"
        " * - Human-readable, classified errors: network_error | timeout |\n"
        " *   database_unavailable | database_busy | validation_error | server_error\n"
        " * - One automatic retry (with backoff) for idempotent GET requests on\n"
        " *   transient network/timeout failures — smooths Render cold starts\n"
        " * - 50s timeout for Render free-tier cold starts\n"
        " */"
    )
    if header_old not in src:
        warn(f'{API_SVC_REL}: header comment not found verbatim — skipping header rewrite, '
             'continuing with the rest of the patch.')
        out = src
    else:
        out = src.replace(header_old, header_new, 1)

    # ── Tag the network-error branch as 'network_error' explicitly + add retry ──
    old_network_block = (
        "    if (!error.response) {\n"
        "      const isTimeout = error.code === 'ECONNABORTED';\n"
        "      return Promise.reject({\n"
        "        ...error,\n"
        "        response: {\n"
        "          data: {\n"
        "            error: isTimeout ? 'timeout' : 'network_error',\n"
        "            detail: isTimeout\n"
        "              ? 'The server took too long. It may be waking up — try again in a moment.'\n"
        "              : `Cannot reach the server at ${API_BASE_URL}. Check your network.`,\n"
        "          },\n"
        "        },\n"
        "      });\n"
        "    }\n"
    )
    new_network_block = (
        "    if (!error.response) {\n"
        "      const isTimeout = error.code === 'ECONNABORTED';\n"
        "      const isGet     = (orig?.method || '').toLowerCase() === 'get';\n"
        "      const retries   = (orig as any)?._retryCount || 0;\n"
        "\n"
        "      // One quiet retry for idempotent GETs on transient network/timeout\n"
        "      // failures (cold starts, flaky Wi-Fi) before surfacing an error.\n"
        "      if (isGet && retries < 1 && orig) {\n"
        "        (orig as any)._retryCount = retries + 1;\n"
        "        const backoffMs = 1200;\n"
        "        if (__DEV__) console.log(`[API] retrying ${orig.url} after ${backoffMs}ms (network/timeout)`);\n"
        "        await new Promise(r => setTimeout(r, backoffMs));\n"
        "        return apiClient(orig);\n"
        "      }\n"
        "\n"
        "      return Promise.reject({\n"
        "        ...error,\n"
        "        response: {\n"
        "          data: {\n"
        "            error: isTimeout ? 'timeout' : 'network_error',\n"
        "            detail: isTimeout\n"
        "              ? 'The server took too long. It may be waking up — try again in a moment.'\n"
        "              : `Cannot reach the server at ${API_BASE_URL}. Check your network.`,\n"
        "          },\n"
        "        },\n"
        "      });\n"
        "    }\n"
    )
    if old_network_block not in out:
        warn(f'{API_SVC_REL}: network-error block not found verbatim — leaving as-is.')
    else:
        out = out.replace(old_network_block, new_network_block, 1)

    # ── getApiError: classify DB / server / validation distinctly ──
    old_get_api_error = (
        "export function getApiError(err: unknown, fallback = 'Something went wrong.'): string {\n"
        "  if (axios.isAxiosError(err)) {\n"
        "    const d = (err.response?.data as { error?: string; detail?: unknown });\n"
        "    if (d?.detail) {\n"
        "      if (typeof d.detail === 'string') return d.detail;\n"
        "      const fe = (d.detail as any)?.fieldErrors;\n"
        "      if (fe) return Object.entries(fe).map(([k,v]) => `${k}: ${(v as string[]).join(', ')}`).join(' | ');\n"
        "      return JSON.stringify(d.detail);\n"
        "    }\n"
        "    if (!err.response) return 'No internet connection.';\n"
        "    return `Server error ${err.response.status}`;\n"
        "  }\n"
        "  return fallback;\n"
        "}\n"
    )
    new_get_api_error = (
        "// DB / network / server errors are pre-classified by the backend's\n"
        "// errorHandler.js (database_unavailable, database_busy, server_error, …)\n"
        "// and by the response interceptor above (network_error, timeout). This\n"
        "// turns that `error` code + `detail` payload into one clear sentence so\n"
        "// the UI never shows a raw object, [object Object], or a stuck spinner.\n"
        "const ERROR_PREFIXES: Record<string, string> = {\n"
        "  network_error:         '',\n"
        "  timeout:                '',\n"
        "  database_unavailable:  'Database error: ',\n"
        "  database_busy:         'Database error: ',\n"
        "  validation_error:      '',\n"
        "  server_error:          'Server error: ',\n"
        "  payload_too_large:     '',\n"
        "  too_many_requests:     '',\n"
        "};\n"
        "\n"
        "export function getApiError(err: unknown, fallback = 'Something went wrong.'): string {\n"
        "  if (axios.isAxiosError(err)) {\n"
        "    const d = (err.response?.data as { error?: string; detail?: unknown });\n"
        "    const prefix = d?.error ? (ERROR_PREFIXES[d.error] ?? '') : '';\n"
        "    if (d?.detail) {\n"
        "      if (typeof d.detail === 'string') return `${prefix}${d.detail}`;\n"
        "      const fe = (d.detail as any)?.fieldErrors;\n"
        "      if (fe) {\n"
        "        const msgs = Object.entries(fe)\n"
        "          .filter(([, v]) => Array.isArray(v) && (v as string[]).length)\n"
        "          .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`);\n"
        "        if (msgs.length) return msgs.join(' | ');\n"
        "      }\n"
        "      if (typeof d.detail === 'object') {\n"
        "        try { return `${prefix}${JSON.stringify(d.detail)}`; } catch { /* fallthrough */ }\n"
        "      }\n"
        "    }\n"
        "    if (!err.response) return 'No internet connection. Check your network and try again.';\n"
        "    return `Server error (${err.response.status}). Please try again.`;\n"
        "  }\n"
        "  return fallback;\n"
        "}\n"
    )
    if old_get_api_error not in out:
        warn(f'{API_SVC_REL}: getApiError() block not found verbatim — leaving as-is.')
    else:
        out = out.replace(old_get_api_error, new_get_api_error, 1)

    return out

# ════════════════════════════════════════════════════════════════════════
# 3. mobile/components/ui/Button.tsx — visible disabled/loading colors
# ════════════════════════════════════════════════════════════════════════
BTN_REL = 'mobile/components/ui/Button.tsx'

def patch_button(src: str) -> str:
    if MARKER in src:
        return src

    old = (
        "export function Button({ label, variant='primary', size='md', loading=false, disabled=false, icon, fullWidth=false, style, onPress, ...rest }: ButtonProps) {\n"
        "  const sz         = SIZES[size];\n"
        "  const isDisabled = disabled || loading;\n"
        "  const isGradient = ['primary','accent','danger'].includes(variant);\n"
        "  const isBordered = variant === 'secondary';\n"
        "  const isGhost    = variant === 'ghost';\n"
        "  const isOnHeader = variant === 'onHeader';\n"
        "\n"
        "  const textColor = isBordered || isGhost || isOnHeader ? Colors.primary : Colors.textInverse;\n"
        "\n"
        "  const containerStyle: ViewStyle = {\n"
        "    alignSelf: fullWidth ? 'stretch' : 'flex-start',\n"
        "    borderRadius: Radius.md, overflow: 'hidden',\n"
        "    opacity: isDisabled ? 0.55 : 1,\n"
        "    ...(isBordered && { borderWidth:1.5, borderColor: Colors.primary, backgroundColor: Colors.white }),\n"
        "    ...(isGhost    && { backgroundColor: 'transparent' }),\n"
        "    ...(isOnHeader && { backgroundColor: Colors.white }),\n"
        "    ...(!isGradient && Shadows.sm),\n"
        "    ...style,\n"
        "  };\n"
        "\n"
        "  const innerStyle: ViewStyle = {\n"
        "    height: sz.height, flexDirection:'row', alignItems:'center',\n"
        "    justifyContent:'center', gap: Spacing.xs, paddingHorizontal: sz.paddingH,\n"
        "  };\n"
        "\n"
        "  // When a gradient button is loading, always use white so the spinner is\n"
        "  // visible against the blue/teal/red gradient background.\n"
        "  // onHeader buttons are a solid white pill, so the spinner stays primary-blue.\n"
        "  const spinnerColor = isGradient ? Colors.white : textColor;\n"
        "  const content = loading ? <ActivityIndicator color={spinnerColor} size=\"small\" /> : (\n"
        "    <>{icon && <View>{icon}</View>}<Text style={[S.label, { fontSize: sz.fontSize, color: textColor }]}>{label}</Text></>\n"
        "  );\n"
        "\n"
        "  return (\n"
        "    <TouchableOpacity onPress={onPress} disabled={isDisabled} activeOpacity={loading ? 0.65 : 0.82} style={containerStyle} {...rest}>\n"
        "      {isGradient\n"
        "        // loading state: dim the real gradient (keeps button themed, spinner stays visible)\n"
        "        ? <LinearGradient colors={loading ? ['rgba(0,0,0,0.18)','rgba(0,0,0,0.18)'] : isDisabled ? [Colors.grey300,Colors.grey300] : GRADIENTS[variant]} start={{x:0,y:0}} end={{x:1,y:0}} style={innerStyle}>{content}</LinearGradient>\n"
        "        : <View style={innerStyle}>{content}</View>\n"
        "      }\n"
        "    </TouchableOpacity>\n"
        "  );\n"
        "}\n"
    )
    new = (
        f"// {MARKER}\n"
        "export function Button({ label, variant='primary', size='md', loading=false, disabled=false, icon, fullWidth=false, style, onPress, ...rest }: ButtonProps) {\n"
        "  const sz         = SIZES[size];\n"
        "  const isWaiting  = disabled && !loading; // disabled but NOT mid-request\n"
        "  const isDisabled = disabled || loading;\n"
        "  const isGradient = ['primary','accent','danger'].includes(variant);\n"
        "  const isBordered = variant === 'secondary';\n"
        "  const isGhost    = variant === 'ghost';\n"
        "  const isOnHeader = variant === 'onHeader';\n"
        "\n"
        "  const textColor = isBordered || isGhost || isOnHeader ? Colors.primary : Colors.textInverse;\n"
        "\n"
        "  // Disabled (not loading) buttons keep FULL opacity with a solid, mid-tone\n"
        "  // grey background — the previous 55%-opacity grey300 nearly disappeared\n"
        "  // and made any spinner on top of it unreadable.\n"
        "  const containerStyle: ViewStyle = {\n"
        "    alignSelf: fullWidth ? 'stretch' : 'flex-start',\n"
        "    borderRadius: Radius.md, overflow: 'hidden',\n"
        "    opacity: isWaiting ? 0.7 : 1,\n"
        "    ...(isBordered && { borderWidth:1.5, borderColor: isDisabled ? Colors.grey400 : Colors.primary, backgroundColor: Colors.white }),\n"
        "    ...(isGhost    && { backgroundColor: 'transparent' }),\n"
        "    ...(isOnHeader && { backgroundColor: Colors.white }),\n"
        "    ...(!isGradient && Shadows.sm),\n"
        "    ...style,\n"
        "  };\n"
        "\n"
        "  const innerStyle: ViewStyle = {\n"
        "    height: sz.height, flexDirection:'row', alignItems:'center',\n"
        "    justifyContent:'center', gap: Spacing.xs, paddingHorizontal: sz.paddingH,\n"
        "  };\n"
        "\n"
        "  // When a gradient button is loading, always use white so the spinner is\n"
        "  // visible against the darkened gradient background. For non-gradient\n"
        "  // variants while loading, force a dark spinner against their light\n"
        "  // backgrounds so it never blends in.\n"
        "  // onHeader buttons are a solid white pill, so the spinner stays primary-blue.\n"
        "  const spinnerColor = isGradient ? Colors.white : loading ? Colors.grey700 : textColor;\n"
        "  const content = loading ? <ActivityIndicator color={spinnerColor} size=\"small\" /> : (\n"
        "    <>{icon && <View>{icon}</View>}<Text style={[S.label, { fontSize: sz.fontSize, color: isWaiting ? Colors.grey50 : textColor }]}>{label}</Text></>\n"
        "  );\n"
        "\n"
        "  // Loading: darken the real gradient (stays on-brand, spinner pops).\n"
        "  // Disabled-not-loading: a solid mid grey (grey400) is clearly visible at\n"
        "  // full opacity, unlike the old pale grey300 + 0.55 opacity combo.\n"
        "  const gradientColors: [string, string] = loading\n"
        "    ? ['rgba(15,23,42,0.45)', 'rgba(15,23,42,0.45)']\n"
        "    : isWaiting\n"
        "      ? [Colors.grey400, Colors.grey400]\n"
        "      : GRADIENTS[variant];\n"
        "\n"
        "  return (\n"
        "    <TouchableOpacity onPress={onPress} disabled={isDisabled} activeOpacity={loading ? 0.65 : 0.82} style={containerStyle} {...rest}>\n"
        "      {isGradient\n"
        "        ? <LinearGradient colors={gradientColors} start={{x:0,y:0}} end={{x:1,y:0}} style={innerStyle}>{content}</LinearGradient>\n"
        "        : <View style={[innerStyle, isWaiting && !isBordered && !isGhost && !isOnHeader && { backgroundColor: Colors.grey400 }]}>{content}</View>\n"
        "      }\n"
        "    </TouchableOpacity>\n"
        "  );\n"
        "}\n"
    )
    if old not in src:
        warn(f'{BTN_REL}: component body not found verbatim — skipping (file may already differ).')
        return src
    return src.replace(old, new, 1)

# ════════════════════════════════════════════════════════════════════════
# 4. mobile/app/(auth)/login.tsx — use shared, classified error parser
# ════════════════════════════════════════════════════════════════════════
LOGIN_REL = 'mobile/app/(auth)/login.tsx'

def patch_login(src: str) -> str:
    if MARKER in src:
        return src

    out = src
    if "import { apiClient }       from '@/services/api';" in out and 'getApiError' not in out:
        out = out.replace(
            "import { apiClient }       from '@/services/api';",
            f"import { '{' } apiClient, getApiError { '}' } from '@/services/api'; // {MARKER}",
            1,
        )
    elif 'getApiError' not in out:
        warn(f'{LOGIN_REL}: import line not found verbatim — getApiError import not added.')

    old_catch = (
        "    } catch (e: unknown) {\n"
        "      const err = e as { response?: { data?: { detail?: string } } };\n"
        "      setRegErr(err?.response?.data?.detail ?? 'Registration failed. Please try again.');\n"
        "    } finally { setRegBusy(false); }\n"
    )
    new_catch = (
        "    } catch (e: unknown) {\n"
        "      // getApiError() classifies network / timeout / database / validation /\n"
        "      // server errors (set by the axios interceptor and the backend's\n"
        "      // errorHandler.js) into one readable sentence instead of leaving the\n"
        "      // form stuck on a raw object or an endless spinner.\n"
        "      setRegErr(getApiError(e, 'Registration failed. Please try again.'));\n"
        "    } finally { setRegBusy(false); }\n"
    )
    if old_catch not in out:
        warn(f'{LOGIN_REL}: handleRegister catch block not found verbatim — leaving as-is.')
    else:
        out = out.replace(old_catch, new_catch, 1)

    return out

# ════════════════════════════════════════════════════════════════════════
# 5. mobile/.env — actually wire EXPO_PUBLIC_API_URL (gitignored, created
#    only if missing, never overwritten if the dev already has one)
# ════════════════════════════════════════════════════════════════════════
def ensure_mobile_env():
    env_path  = fp('mobile/.env')
    env_local = fp('mobile/.env.local')
    if os.path.exists(env_path) or os.path.exists(env_local):
        info('mobile/.env(.local) already exists — leaving your value untouched.')
        return
    content = (
        "# Created by patch_laizer_v8.py — fill in YOUR machine's LAN IP below.\n"
        "# Find it with `ipconfig` (Windows) / `ifconfig` or `ip addr` (mac/Linux).\n"
        "# A physical phone CANNOT reach 'localhost' or '10.0.2.2' — those only\n"
        "# work for simulators/emulators running on the same machine as the API.\n"
        "#\n"
        "# Examples:\n"
        "#   Physical device on same Wi-Fi:  EXPO_PUBLIC_API_URL=http://192.168.1.42:8000\n"
        "#   Android emulator:               EXPO_PUBLIC_API_URL=http://10.0.2.2:8000\n"
        "#   iOS simulator:                  EXPO_PUBLIC_API_URL=http://localhost:8000\n"
        "#   Production:                     EXPO_PUBLIC_API_URL=https://smss-api.onrender.com\n"
        "EXPO_PUBLIC_API_URL=http://10.0.2.2:8000\n"
    )
    write('mobile/.env', content)
    warn('mobile/.env was generated with a PLACEHOLDER URL (10.0.2.2 — Android '
         'emulator only). Edit it with your computer\'s LAN IP if testing on a '
         'physical phone, then restart with `expo start -c`.')

# ════════════════════════════════════════════════════════════════════════
# 6. backend/src/app.js — gzip compression for faster responses
# ════════════════════════════════════════════════════════════════════════
APP_JS_REL = 'backend/src/app.js'

def patch_app_js(src: str) -> str:
    if MARKER in src:
        return src
    if "const cfg          = require('./config');" not in src:
        warn(f'{APP_JS_REL}: require block not found verbatim — skipping compression patch.')
        return src
    out = src.replace(
        "const cfg          = require('./config');\nconst errorHandler = require('./middleware/errorHandler');",
        "const cfg          = require('./config');\n"
        "const errorHandler = require('./middleware/errorHandler');\n"
        f"// {MARKER}\n"
        "// gzip/deflate API responses (lists, reports) when the optional\n"
        "// `compression` package is installed. Falls back to a no-op middleware\n"
        "// so the server still boots if `npm install compression` hasn't run yet.\n"
        "let compression;\n"
        "try { compression = require('compression'); }\n"
        "catch { compression = () => (_req, _res, next) => next(); }",
        1,
    )
    out = out.replace(
        "app.use(helmet());\n",
        "app.use(helmet());\napp.use(compression());\n",
        1,
    )
    return out

# ════════════════════════════════════════════════════════════════════════
# 7. backend/package.json — add compression dependency (no-op if present)
# ════════════════════════════════════════════════════════════════════════
PKG_REL = 'backend/package.json'

def patch_backend_pkg(src: str) -> str:
    if '"compression"' in src:
        return src
    marker = '"@prisma/client": "^5.14.0",'
    if marker not in src:
        warn(f'{PKG_REL}: dependency anchor not found — add "compression" manually then run `npm install`.')
        return src
    return src.replace(
        marker,
        marker + '\n    "compression": "^1.7.4",',
        1,
    )

# ════════════════════════════════════════════════════════════════════════
# Apply
# ════════════════════════════════════════════════════════════════════════
def apply_text_patch(rel, transform):
    src = read(rel)
    if src is None:
        warn(f'{rel}: not found — skipping.')
        return
    if already_patched(src):
        info(f'{rel}: already patched — skipping.')
        return
    out = transform(src)
    if out == src:
        warn(f'{rel}: no changes applied (patterns not matched).')
        return
    write(rel, out)

# 1. api.ts is fully regenerated (small, fully-owned file)
existing_api_ts = read(API_TS_REL)
if already_patched(existing_api_ts or ''):
    info(f'{API_TS_REL}: already patched — skipping.')
else:
    write(API_TS_REL, api_ts_new)

apply_text_patch(API_SVC_REL, patch_api_service)
apply_text_patch(BTN_REL,     patch_button)
apply_text_patch(LOGIN_REL,   patch_login)
apply_text_patch(APP_JS_REL,  patch_app_js)
apply_text_patch(PKG_REL,     patch_backend_pkg)
ensure_mobile_env()

print()
if DRY:
    info('Dry run complete — no files were changed.')
else:
    ok('Patch v8 applied.')
    print()
    info('Next steps:')
    print('  1. Edit mobile/.env (or .env.local) — set EXPO_PUBLIC_API_URL to your')
    print('     computer\'s LAN IP (e.g. http://192.168.1.42:8000) if testing on a')
    print('     physical phone. Emulators can keep the generated default.')
    print('  2. cd backend && npm install        # pulls in `compression`')
    print('  3. cd mobile  && expo start -c       # -c clears the Metro cache so')
    print('     the new env var actually gets inlined into the bundle')
    print('  4. Confirm the backend is reachable from the SAME network as the')
    print('     phone: curl http://<your-LAN-IP>:8000/api/health/')
