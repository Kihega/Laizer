#!/usr/bin/env python3
"""
Laizer Patch v2 — line-targeted replacements (no multi-line anchors for Button).
Run from project root:
  python3 patch.py
  python3 patch.py --dry-run
  python3 patch.py --undo
"""
import sys, os, shutil

DRY  = '--dry-run' in sys.argv
UNDO = '--undo'    in sys.argv

G='\033[92m'; Y='\033[93m'; B='\033[94m'; E='\033[0m'
def info(m): print(f'{B}[INFO]{E}  {m}')
def ok(m):   print(f'{G}[ OK ]{E}  {m}')
def warn(m): print(f'{Y}[WARN]{E}  {m}')
def dry(m):  print(f'{Y}[DRY ]{E}  {m}')
def die(m):  print(f'\033[91m[ERR ]{E}  {m}'); sys.exit(1)

ROOT = os.path.dirname(os.path.abspath(__file__))
def fpath(rel): return os.path.join(ROOT, rel)

def read(rel):
    p = fpath(rel)
    if not os.path.exists(p): raise FileNotFoundError(f'Not found: {p}')
    with open(p, encoding='utf-8') as f: return f.read()

def write(rel, content):
    p = fpath(rel)
    bak = p + '.bak'
    if DRY: dry(f'Would write {rel}'); return
    if os.path.exists(p) and not os.path.exists(bak):
        shutil.copy2(p, bak); info(f'Backup → {rel}.bak')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f: f.write(content)
    ok(f'Written  {rel}')

def replace_line(lines, old_fragment, new_line, label, required=True):
    """Replace the first line containing old_fragment with new_line."""
    for i, line in enumerate(lines):
        if old_fragment in line:
            lines[i] = new_line + '\n'
            return lines
    if required:
        die(f'Line containing {repr(old_fragment)} not found in {label}')
    return lines

def insert_before_line(lines, fragment, new_lines, label):
    """Insert new_lines before the first line containing fragment."""
    for i, line in enumerate(lines):
        if fragment in line:
            for j, nl in enumerate(new_lines):
                lines.insert(i + j, nl + '\n')
            return lines
    die(f'Fragment {repr(fragment)} not found in {label}')

def sub(src, old, new, label):
    """Multi-line replace — used only where content is certain."""
    if old not in src:
        die(f'Anchor not found in {label}:\n>>> {repr(old[:100])}')
    if src.count(old) > 1:
        die(f'Anchor not unique in {label}')
    return src.replace(old, new)

TARGETS = [
    'mobile/components/ui/Button.tsx',
    'mobile/app/(owner)/dashboard.tsx',
    'mobile/app/(owner)/centres.tsx',
    'backend/src/routes/centres.js',
]

if UNDO:
    print(f'\n{Y}━━━ UNDO ━━━{E}\n')
    for f in TARGETS:
        p, bak = fpath(f), fpath(f) + '.bak'
        if os.path.exists(bak): shutil.copy2(bak, p); os.remove(bak); ok(f'Restored {f}')
        else: warn(f'No backup: {f}')
    print(f'\n{G}Done.{E}\n'); sys.exit(0)

print(f'\n{B}━━━ Laizer Patch v2 {"(DRY RUN)" if DRY else ""} ━━━{E}\n')

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1 — Button.tsx  (line-by-line — avoids multi-line anchor issues)
# ─────────────────────────────────────────────────────────────────────────────
info('FIX 1 — Button.tsx')
BTN = 'mobile/components/ui/Button.tsx'
lines = read(BTN).splitlines(keepends=True)

# 1a: Insert spinnerColor variable before the `const content =` line
content_idx = None
spinner_already = any('spinnerColor' in l for l in lines)
if not spinner_already:
    for i, l in enumerate(lines):
        if 'const content = loading ?' in l:
            content_idx = i
            break
    if content_idx is None:
        die(f'Could not find "const content = loading ?" in {BTN}')
    lines.insert(content_idx,
        '  // Gradient buttons always use white spinner — visible against blue/teal/red.\n')
    lines.insert(content_idx + 1,
        '  const spinnerColor = isGradient ? Colors.white : textColor;\n')
    # Now find the ActivityIndicator line (index shifted by 2) and swap color
    for i, l in enumerate(lines):
        if 'const content = loading ? <ActivityIndicator color={textColor}' in l:
            lines[i] = l.replace('color={textColor}', 'color={spinnerColor}')
            break
else:
    warn(f'spinnerColor already present in {BTN} — skipping 1a')

# 1b: Keep real gradient colour while loading (not grey)
grad_already = any('!loading' in l for l in lines)
if not grad_already:
    for i, l in enumerate(lines):
        if 'LinearGradient colors={isDisabled ?' in l and 'GRADIENTS[variant]}' in l:
            # Replace the single-line LinearGradient with multi-line version
            indent = len(l) - len(l.lstrip())
            pad = ' ' * indent
            lines[i] = (
                f'{pad}? <LinearGradient\n'
                f'{pad}    colors={{isDisabled && !loading ? [Colors.grey300, Colors.grey300] : GRADIENTS[variant]}}\n'
                f'{pad}    start={{{{x:0,y:0}}}} end={{{{x:1,y:0}}}}\n'
                f'{pad}    style={{[innerStyle, loading ? {{ opacity: 0.72 }} : undefined]}}>\n'
                f'{pad}    {{content}}\n'
                f'{pad}  </LinearGradient>\n'
            )
            break
else:
    warn(f'Gradient fix already present in {BTN} — skipping 1b')

write(BTN, ''.join(lines))

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2a — Owner Dashboard
# ─────────────────────────────────────────────────────────────────────────────
info('FIX 2a — Dashboard: 12s timeout + inline error/retry')
DB = 'mobile/app/(owner)/dashboard.tsx'
db = read(DB)

if 'loadError' in db:
    warn('loadError already present in dashboard — skipping 2a')
else:
    db = sub(db,
        '  const [loading,    setLoading]   = useState(true);\n'
        '  const [refreshing, setRefreshing]= useState(false);',
        '  const [loading,    setLoading]   = useState(true);\n'
        '  const [loadError,  setLoadError] = useState<string | null>(null);\n'
        '  const [refreshing, setRefreshing]= useState(false);',
        DB)

    db = sub(db,
        '  const load = useCallback(async () => {\n'
        '    try {\n'
        '      // allSettled keeps centres loading even if reports fail\n'
        '      const [rpt, ctr] = await Promise.allSettled([\n'
        '        reportService.daily(),\n'
        '        centreService.list(),\n'
        '      ]);\n'
        '      if (rpt.status === \'fulfilled\') setReport(rpt.value.data ?? []);\n'
        '      else console.error(\'[Dashboard] reports failed:\', (rpt.reason as Error)?.message);\n'
        '      if (ctr.status === \'fulfilled\') setCentres(ctr.value.data ?? []);\n'
        '      else console.error(\'[Dashboard] centres failed:\', (ctr.reason as Error)?.message);\n'
        '    } catch (e) { console.error(\'[Dashboard] unexpected:\', e); }\n'
        '    finally { setLoading(false); setRefreshing(false); }\n'
        '  }, []);',

        '  const load = useCallback(async () => {\n'
        '    setLoadError(null);\n'
        '    const timer = setTimeout(() => {\n'
        '      setLoading(false); setRefreshing(false);\n'
        '      setLoadError(\'Server is taking too long.\\nTap Retry to try again.\');\n'
        '    }, 12000);\n'
        '    try {\n'
        '      const [rpt, ctr] = await Promise.allSettled([\n'
        '        reportService.daily(),\n'
        '        centreService.list(),\n'
        '      ]);\n'
        '      clearTimeout(timer);\n'
        '      if (rpt.status === \'fulfilled\') setReport(rpt.value.data ?? []);\n'
        '      else {\n'
        '        const e = rpt.reason as any;\n'
        '        console.error(\'[Dashboard] reports:\', e?.response?.data ?? e?.message);\n'
        '      }\n'
        '      if (ctr.status === \'fulfilled\') setCentres(ctr.value.data ?? []);\n'
        '      else {\n'
        '        const e = ctr.reason as any;\n'
        '        const msg = e?.response?.data?.detail ?? e?.message ?? \'Unknown error\';\n'
        '        console.error(\'[Dashboard] centres:\', e?.response?.data ?? msg);\n'
        '        setLoadError(`Could not load: ${msg}`);\n'
        '      }\n'
        '    } catch (e: unknown) {\n'
        '      clearTimeout(timer);\n'
        '      const msg = (e as any)?.response?.data?.detail ?? (e as Error)?.message ?? \'Unexpected error\';\n'
        '      setLoadError(`Error: ${msg}`);\n'
        '      console.error(\'[Dashboard] unexpected:\', e);\n'
        '    } finally { setLoading(false); setRefreshing(false); }\n'
        '  }, []);',
        DB)

    db = sub(db,
        '        {loading ? <ActivityIndicator style={S.loader} color={Colors.primary} size="large" /> : (\n'
        '          <>',
        '        {loading ? (\n'
        '          <ActivityIndicator style={S.loader} color={Colors.primary} size="large" />\n'
        '        ) : loadError ? (\n'
        '          <View style={{ alignItems:\'center\', marginTop:40, paddingHorizontal:24 }}>\n'
        '            <Ionicons name="cloud-offline-outline" size={40} color={Colors.primary} style={{ opacity:0.5 }} />\n'
        '            <Text style={{ color:Colors.textSecondary, textAlign:\'center\', marginTop:12,\n'
        '                           fontSize:FontSize.sm, lineHeight:20 }}>{loadError}</Text>\n'
        '            <TouchableOpacity onPress={() => { setLoading(true); load(); }}\n'
        '              style={{ marginTop:16, paddingVertical:8, paddingHorizontal:24,\n'
        '                       borderRadius:8, borderWidth:1.5, borderColor:Colors.primary }}>\n'
        '              <Text style={{ color:Colors.primary, fontWeight:FontWeight.bold }}>Retry</Text>\n'
        '            </TouchableOpacity>\n'
        '          </View>\n'
        '        ) : (\n'
        '          <>',
        DB)

    write(DB, db)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2b — Centres screen
# ─────────────────────────────────────────────────────────────────────────────
info('FIX 2b — Centres: 12s timeout + inline error/retry')
CT = 'mobile/app/(owner)/centres.tsx'
ct = read(CT)

if 'loadError' in ct:
    warn('loadError already present in centres — skipping 2b')
else:
    ct = sub(ct,
        '  const [loading,    setLoading]    = useState(true);\n'
        '  const [refreshing, setRefreshing] = useState(false);',
        '  const [loading,    setLoading]    = useState(true);\n'
        '  const [loadError,  setLoadError]  = useState<string | null>(null);\n'
        '  const [refreshing, setRefreshing] = useState(false);',
        CT)

    ct = sub(ct,
        '  const load = useCallback(async () => {\n'
        '    try { const { data } = await centreService.list(); setCentres(data); }\n'
        '    catch (e) { Alert.alert(\'Error\', getApiError(e)); }\n'
        '    finally { setLoading(false); setRefreshing(false); }\n'
        '  }, []);',
        '  const load = useCallback(async () => {\n'
        '    setLoadError(null);\n'
        '    const timer = setTimeout(() => {\n'
        '      setLoading(false); setRefreshing(false);\n'
        '      setLoadError(\'Server is taking too long.\\nTap Retry to try again.\');\n'
        '    }, 12000);\n'
        '    try {\n'
        '      const { data } = await centreService.list();\n'
        '      clearTimeout(timer);\n'
        '      setCentres(data);\n'
        '    } catch (e: unknown) {\n'
        '      clearTimeout(timer);\n'
        '      const msg = getApiError(e);\n'
        '      setLoadError(msg);\n'
        '      console.error(\'[Centres] load:\', (e as any)?.response?.data ?? msg);\n'
        '    } finally { setLoading(false); setRefreshing(false); }\n'
        '  }, []);',
        CT)

    ct = sub(ct,
        '      {loading ? <ActivityIndicator style={S.loader} color={Colors.primary} /> : (\n'
        '        <FlatList',
        '      {loading ? (\n'
        '        <ActivityIndicator style={S.loader} color={Colors.primary} />\n'
        '      ) : loadError ? (\n'
        '        <View style={{ alignItems:\'center\', padding:32 }}>\n'
        '          <Ionicons name="cloud-offline-outline" size={36} color={Colors.textDisabled} />\n'
        '          <Text style={{ color:Colors.textSecondary, textAlign:\'center\', marginTop:10,\n'
        '                         fontSize:FontSize.sm, lineHeight:20 }}>{loadError}</Text>\n'
        '          <TouchableOpacity onPress={() => { setLoading(true); load(); }}\n'
        '            style={{ marginTop:14, paddingVertical:8, paddingHorizontal:22,\n'
        '                     borderRadius:8, borderWidth:1.5, borderColor:Colors.primary }}>\n'
        '            <Text style={{ color:Colors.primary, fontWeight:FontWeight.bold }}>Retry</Text>\n'
        '          </TouchableOpacity>\n'
        '        </View>\n'
        '      ) : (\n'
        '        <FlatList',
        CT)

    write(CT, ct)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 3 — backend centres.js
# ─────────────────────────────────────────────────────────────────────────────
info('FIX 3 — backend centres.js: safe centreId + DB error logging')
CR = 'backend/src/routes/centres.js'
cr = read(CR)

if 'id_exhausted' in cr:
    warn('centreId fix already present — skipping FIX 3')
else:
    cr = sub(cr,
        '    // Auto-generate STN-XX centreId (scoped per owner)\n'
        '    const count    = await prisma.centre.count({ where: { ownerId: req.user.id } });\n'
        '    const centreId = `STN-${String(count + 1).padStart(2, \'0\')}`;\n'
        '    const centreNo = centreId;  // keep centreNo in sync for legacy reads\n'
        '\n'
        '    const centre = await prisma.centre.create({\n'
        '      data: { centreNo, centreId, name, location, ownerId: req.user.id },\n'
        '    });',

        '    // Auto-generate STN-XX — scan for next FREE slot (gap-safe after deletes)\n'
        '    const count = await prisma.centre.count({ where: { ownerId: req.user.id } });\n'
        '    let seq = count + 1;\n'
        '    let centreId;\n'
        '    for (let i = 0; i < 100; i++) {\n'
        '      const candidate = `STN-${String(seq).padStart(2, \'0\')}`;\n'
        '      const exists    = await prisma.centre.findUnique({ where: { centreId: candidate } });\n'
        '      if (!exists) { centreId = candidate; break; }\n'
        '      seq++;\n'
        '    }\n'
        '    if (!centreId)\n'
        '      return res.status(500).json({ error: \'id_exhausted\', detail: \'Could not generate a unique Centre ID.\' });\n'
        '\n'
        '    const centreNo = centreId;\n'
        '    console.log(`[Centres] Creating: ${JSON.stringify({ centreId, name, location, owner: req.user.id })}`);\n'
        '\n'
        '    let centre;\n'
        '    try {\n'
        '      centre = await prisma.centre.create({\n'
        '        data: { centreNo, centreId, name, location, ownerId: req.user.id },\n'
        '      });\n'
        '      console.log(`[Centres] Created OK: ${centre.id} (${centreId})`);\n'
        '    } catch (dbErr) {\n'
        '      console.error(\'[Centres] DB error:\', dbErr?.message ?? dbErr);\n'
        '      return res.status(500).json({\n'
        '        error: \'db_error\',\n'
        '        detail: `Database error: ${dbErr?.message ?? \'Unknown DB error\'}`,\n'
        '      });\n'
        '    }',
        CR)

    write(CR, cr)

print(f'\n{G}━━━ Patch v2 {"(DRY RUN — nothing changed)" if DRY else "applied successfully"} ━━━{E}')
print("""
Changes
───────
FIX 1  mobile/components/ui/Button.tsx
       • Gradient stays blue/teal/red at 72% opacity while loading
       • Spinner is always white on gradient buttons

FIX 2  mobile/app/(owner)/dashboard.tsx + centres.tsx
       • 12-second hard timeout on every load() call
       • After timeout/error: offline icon + message + Retry button

FIX 3  backend/src/routes/centres.js
       • centreId scans for next FREE slot (gap-safe after deletes)
       • DB errors logged to Render console + returned as readable JSON
""")
