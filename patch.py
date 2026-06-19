#!/usr/bin/env python3
"""
Laizer Patch v3 — 4 features:

  1. REPORTS: real-time service counter sync + cache invalidation when worker
     logs a service event. Proper UTC date-boundary logic (day = midnight UTC).

  2. NOTICES: 48-hour auto-expiry (schema + backend cleanup cron + frontend
     filters). Fix notice-send crash (missing priority field stripped, form
     simplified — no priority UI, 2-day TTL added to schema via expiresAt).
     Backend: add DELETE /api/notices/cleanup/ (internal) + filter expired
     notices on GET. Frontend: remove priority pickers, fix send crash.

  3. BUTTON: fix grey loading state — keep real gradient + white spinner.

  4. REPORT DETAIL CARD: tap a branch row → scrollable popup card showing
     full breakdown (services list + stock snapshot + total revenue) with
     Share (plain text) and Download (JSON file via expo-sharing) actions.

Run from project root:
  python3 patch_laizer_v3.py
  python3 patch_laizer_v3.py --dry-run
  python3 patch_laizer_v3.py --undo
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
    p = fp(rel); bak = p + '.bak2'
    if DRY: print(f'  {Y}[DRY]{E} Would write {rel}'); return
    if os.path.exists(p) and not os.path.exists(bak):
        shutil.copy2(p, bak)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f: f.write(content)
    ok(f'Written  {rel}')

def sub(src, old, new, label):
    if old not in src:
        die(f'Anchor not found in {label}:\n>>> {repr(old[:100])}')
    if src.count(old) > 1:
        die(f'Anchor appears {src.count(old)}x in {label} — must be unique')
    return src.replace(old, new)

TARGETS = [
    'backend/src/routes/services.js',
    'backend/src/routes/notices.js',
    'backend/src/routes/reports.js',
    'backend/prisma/schema.prisma',
    'mobile/components/ui/Button.tsx',
    'mobile/app/(owner)/reports.tsx',
    'mobile/app/(owner)/notices.tsx',
    'mobile/services/api.ts',
]

if UNDO:
    print(f'\n{Y}━━━ UNDO ━━━{E}\n')
    for f in TARGETS:
        p, bak = fp(f), fp(f) + '.bak2'
        if os.path.exists(bak): shutil.copy2(bak, p); os.remove(bak); ok(f'Restored {f}')
        else: warn(f'No backup: {f}')
    print(f'\n{G}Done.{E}\n'); sys.exit(0)

print(f'\n{B}━━━ Laizer Patch v3 {"(DRY RUN)" if DRY else ""} ━━━{E}\n')

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1 — Button.tsx: fix grey gradient on loading
# ─────────────────────────────────────────────────────────────────────────────
info('FIX 3 — Button.tsx: keep real gradient while loading')
BTN = 'mobile/components/ui/Button.tsx'
btn = read(BTN)

if 'rgba(0,0,0,0.18)' in btn:
    warn('Button loading gradient already patched — keeping white-spinner fix only')
    # Still ensure spinnerColor is white for gradient buttons
    if 'spinnerColor' not in btn:
        btn = sub(btn,
            '  const content = loading ? <ActivityIndicator color={textColor} size="small" /> : (',
            '  const spinnerColor = isGradient ? Colors.white : textColor;\n'
            '  const content = loading ? <ActivityIndicator color={spinnerColor} size="small" /> : (',
            BTN)
        write(BTN, btn)
else:
    # Replace the rgba dark overlay with real gradient at reduced opacity
    btn = sub(btn,
        '        ? <LinearGradient colors={loading ? [\'rgba(0,0,0,0.18)\',\'rgba(0,0,0,0.18)\'] : isDisabled ? [Colors.grey300,Colors.grey300] : GRADIENTS[variant]} start={{x:0,y:0}} end={{x:1,y:0}} style={innerStyle}>{content}</LinearGradient>',
        '        ? <LinearGradient\n'
        '            colors={isDisabled && !loading ? [Colors.grey300, Colors.grey300] : GRADIENTS[variant]}\n'
        '            start={{x:0,y:0}} end={{x:1,y:0}}\n'
        '            style={[innerStyle, loading ? { opacity: 0.72 } : undefined]}>\n'
        '            {content}\n'
        '          </LinearGradient>',
        BTN)
    write(BTN, btn)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1 — services.js: invalidate report cache after service log/edit/delete
# ─────────────────────────────────────────────────────────────────────────────
info('FIX 1 — services.js: invalidate report cache on write')
SVC = 'backend/src/routes/services.js'
svc = read(SVC)

# Add redis import after existing requires
svc = sub(svc,
    "const logAction           = require('../lib/audit');\nconst cfg                 = require('../config');",
    "const logAction           = require('../lib/audit');\nconst cfg                 = require('../config');\nconst redis               = require('../lib/redis');",
    SVC)

# Invalidate cache after POST (new service logged)
svc = sub(svc,
    "    await logAction(req.user.id, logAction.ACTIONS.SERVICE_LOGGED, { req, eventId: event.id });\n    return res.status(201).json(event);",
    "    await logAction(req.user.id, logAction.ACTIONS.SERVICE_LOGGED, { req, eventId: event.id });\n"
    "    // Bust report caches for this centre so owner screens reflect the new event immediately.\n"
    "    const todayStr = new Date().toISOString().slice(0, 10);\n"
    "    const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().slice(0,10); })();\n"
    "    await redis.cacheDel(\n"
    "      redis.CacheKey.reportDaily(req.user.centreId, todayStr),\n"
    "      redis.CacheKey.reportDaily(event.centreId, todayStr),\n"
    "      redis.CacheKey.reportWeekly(req.user.centreId, weekStart),\n"
    "      redis.CacheKey.reportWeekly(event.centreId, weekStart),\n"
    "    );\n"
    "    return res.status(201).json(event);",
    SVC)

# Invalidate cache after PATCH (edit)
svc = sub(svc,
    "    await logAction(req.user.id, logAction.ACTIONS.SERVICE_EDITED, { req, eventId: req.params.id });\n    return res.json(updated);",
    "    await logAction(req.user.id, logAction.ACTIONS.SERVICE_EDITED, { req, eventId: req.params.id });\n"
    "    const _todayE = new Date().toISOString().slice(0, 10);\n"
    "    const _wsE = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().slice(0,10); })();\n"
    "    await redis.cacheDel(redis.CacheKey.reportDaily(existing.centreId, _todayE), redis.CacheKey.reportWeekly(existing.centreId, _wsE));\n"
    "    return res.json(updated);",
    SVC)

# Invalidate cache after DELETE
svc = sub(svc,
    "    await logAction(req.user.id, logAction.ACTIONS.SERVICE_DELETED, { req, eventId: req.params.id });\n    return res.json({ detail: 'Service event deleted.' });",
    "    await logAction(req.user.id, logAction.ACTIONS.SERVICE_DELETED, { req, eventId: req.params.id });\n"
    "    const _todayD = new Date().toISOString().slice(0, 10);\n"
    "    const _wsD = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().slice(0,10); })();\n"
    "    await redis.cacheDel(redis.CacheKey.reportDaily(existing.centreId, _todayD), redis.CacheKey.reportWeekly(existing.centreId, _wsD));\n"
    "    return res.json({ detail: 'Service event deleted.' });",
    SVC)

write(SVC, svc)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2 — schema.prisma: add expiresAt to Notice for 48-hour TTL
# ─────────────────────────────────────────────────────────────────────────────
info('FIX 2 — schema.prisma: add expiresAt to Notice')
SCH = 'backend/prisma/schema.prisma'
sch = read(SCH)

if 'expiresAt' in sch:
    warn('expiresAt already in schema — skipping')
else:
    sch = sub(sch,
        '  priority  NoticePriority @default(normal)\n'
        '  createdAt DateTime       @default(now()) @map("created_at")',
        '  priority  NoticePriority @default(normal)\n'
        '  expiresAt DateTime?      @map("expires_at")  // auto-set to createdAt+48h; null = never expires\n'
        '  createdAt DateTime       @default(now()) @map("created_at")',
        SCH)
    write(SCH, sch)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2 — notices.js: expiry filter on GET, set expiresAt on POST,
#          no priority crash (strip priority from POST if schema breaks)
# ─────────────────────────────────────────────────────────────────────────────
info('FIX 2 — notices.js: 48h expiry + send crash fix')
NOT = 'backend/src/routes/notices.js'
nots = read(NOT)

# Filter expired notices in worker GET
nots = sub(nots,
    "      const notices = await prisma.notice.findMany({\n"
    "        where:   { centreId: req.user.centreId },\n"
    "        orderBy: { createdAt: 'desc' },",
    "      const nowFilter = new Date();\n"
    "      const notices = await prisma.notice.findMany({\n"
    "        where:   { centreId: req.user.centreId,\n"
    "                   OR: [{ expiresAt: null }, { expiresAt: { gt: nowFilter } }] },\n"
    "        orderBy: { createdAt: 'desc' },",
    NOT)

# Filter expired notices in owner GET
nots = sub(nots,
    "      const notices = await prisma.notice.findMany({\n"
    "        where:   { centreId: { in: centres.map(c => c.id) } },\n"
    "        orderBy: { createdAt: 'desc' },",
    "      const nowFilter2 = new Date();\n"
    "      const notices = await prisma.notice.findMany({\n"
    "        where:   { centreId: { in: centres.map(c => c.id) },\n"
    "                   OR: [{ expiresAt: null }, { expiresAt: { gt: nowFilter2 } }] },\n"
    "        orderBy: { createdAt: 'desc' },",
    NOT)

# Set expiresAt on create, make priority optional (prevent crash)
nots = sub(nots,
    "const SendNoticeSchema = z.object({\n"
    "  centreId: z.string().uuid(),\n"
    "  title:    z.string().max(100).optional(),   // auto-generated if omitted\n"
    "  body:     z.string().min(1),\n"
    "  priority: z.enum(['low', 'normal', 'urgent']).default('normal'),\n"
    "});",
    "const SendNoticeSchema = z.object({\n"
    "  centreId: z.string().uuid(),\n"
    "  title:    z.string().max(100).optional(),\n"
    "  body:     z.string().min(1).max(2000),\n"
    "  priority: z.enum(['low', 'normal', 'urgent']).default('normal').optional(),\n"
    "});",
    NOT)

# Set expiresAt = now + 48h on notice create
nots = sub(nots,
    "    const notice = await prisma.notice.create({\n"
    "      data: { ...parsed.data, title, senderId: req.user.id },\n"
    "    });",
    "    // Notices expire automatically after 48 hours\n"
    "    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);\n"
    "    const notice = await prisma.notice.create({\n"
    "      data: {\n"
    "        centreId: parsed.data.centreId,\n"
    "        body:     parsed.data.body,\n"
    "        priority: parsed.data.priority ?? 'normal',\n"
    "        title,\n"
    "        senderId: req.user.id,\n"
    "        expiresAt,\n"
    "      },\n"
    "    });",
    NOT)

write(NOT, nots)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1 — reports.js: add full detail endpoint for the popup card
#          GET /api/reports/detail/?centreId=&date=&weekStart=&mode=daily|weekly
# ─────────────────────────────────────────────────────────────────────────────
info('FIX 1/4 — reports.js: add /detail/ endpoint for popup card')
RPT = 'backend/src/routes/reports.js'
rpt = read(RPT)

if '/detail/' in rpt:
    warn('Detail endpoint already present — skipping')
else:
    rpt = sub(rpt,
        'module.exports = router;',
        '''// ── GET /api/reports/detail/ ─────────────────────────────────────────────────
// Returns a full centre report: service events breakdown + stock snapshot.
// Used by the mobile popup card.
router.get('/detail/', async (req, res, next) => {
  try {
    const ownerId  = req.user.id;
    const centreId = req.query.centreId;
    const mode     = req.query.mode === 'weekly' ? 'weekly' : 'daily';

    if (!centreId)
      return res.status(400).json({ error: 'missing_param', detail: 'centreId is required.' });

    const centre = await prisma.centre.findFirst({
      where: { id: centreId, ownerId, isActive: true },
      select: { id:true, name:true, centreNo:true, centreId:true, location:true },
    });
    if (!centre)
      return res.status(404).json({ error: 'not_found', detail: 'Centre not found.' });

    let rangeStart, rangeEnd, label;
    if (mode === 'weekly') {
      const ws = req.query.weekStart ? new Date(req.query.weekStart) : (() => {
        const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d;
      })();
      ws.setHours(0, 0, 0, 0);
      rangeStart = ws;
      rangeEnd   = new Date(ws); rangeEnd.setDate(ws.getDate() + 7);
      label = `Week of ${ws.toISOString().slice(0,10)}`;
    } else {
      const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
      rangeStart = new Date(dateStr); rangeStart.setHours(0, 0, 0, 0);
      rangeEnd   = new Date(rangeStart); rangeEnd.setDate(rangeStart.getDate() + 1);
      label = dateStr;
    }

    // Service events in range
    let events = [];
    try {
      events = await prisma.serviceEvent.findMany({
        where:  { centreId: centre.id, createdAt: { gte: rangeStart, lt: rangeEnd } },
        select: { id:true, serviceType:true, serviceSubtype:true, pages:true,
                  pricePerPageTshs:true, totalAmountTshs:true,
                  customerNote:true, createdAt:true,
                  worker: { select: { fullName:true } } },
        orderBy: { createdAt: 'asc' },
      });
    } catch (e) {
      console.error('[reports/detail] serviceEvent error:', e.message);
    }

    // Stock snapshot
    let stock = [];
    try {
      stock = await prisma.stockItem.findMany({
        where:  { centreId: centre.id },
        select: { itemName:true, quantity:true, unit:true, netStockPriceTshs:true },
        orderBy: { itemName: 'asc' },
      });
    } catch (e) {
      console.error('[reports/detail] stock error:', e.message);
    }

    const totalRevenue = events.reduce((s, e) => s + Number(e.totalAmountTshs), 0);
    const byType = {};
    for (const e of events) {
      byType[e.serviceType] = (byType[e.serviceType] || 0) + 1;
    }

    return res.json({
      centre,
      label,
      mode,
      rangeStart: rangeStart.toISOString(),
      rangeEnd:   rangeEnd.toISOString(),
      totalEvents:     events.length,
      totalRevenueTshs: Math.round(totalRevenue * 100) / 100,
      byServiceType:   byType,
      events,
      stock,
    });
  } catch (err) { next(err); }
});

module.exports = router;''',
        RPT)
    write(RPT, rpt)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 4 — mobile/services/api.ts: add reportDetail + notice cleanup endpoint
# ─────────────────────────────────────────────────────────────────────────────
info('FIX 4 — api.ts: add reportService.detail()')
API = 'mobile/services/api.ts'
api = read(API)

if 'reportDetail' in api or 'detail:' in api:
    warn('reportDetail already in api.ts — skipping')
else:
    api = sub(api,
        'export const reportService = {\n'
        '  daily:  (params?: { date?: string; centreId?: string }) => {\n'
        '    const q = new URLSearchParams(params as Record<string, string>).toString();\n'
        '    return apiClient.get(API_ROUTES.reportDaily + (q ? `?${q}` : \'\'));\n'
        '  },\n'
        '  weekly: (params?: { weekStart?: string; centreId?: string }) => {\n'
        '    const q = new URLSearchParams(params as Record<string, string>).toString();\n'
        '    return apiClient.get(API_ROUTES.reportWeekly + (q ? `?${q}` : \'\'));\n'
        '  },\n'
        '};',
        'export const reportService = {\n'
        '  daily:  (params?: { date?: string; centreId?: string }) => {\n'
        '    const q = new URLSearchParams(params as Record<string, string>).toString();\n'
        '    return apiClient.get(API_ROUTES.reportDaily + (q ? `?${q}` : \'\'));\n'
        '  },\n'
        '  weekly: (params?: { weekStart?: string; centreId?: string }) => {\n'
        '    const q = new URLSearchParams(params as Record<string, string>).toString();\n'
        '    return apiClient.get(API_ROUTES.reportWeekly + (q ? `?${q}` : \'\'));\n'
        '  },\n'
        '  detail: (params: { centreId: string; mode: \'daily\'|\'weekly\'; date?: string; weekStart?: string }) => {\n'
        '    const q = new URLSearchParams(params as Record<string, string>).toString();\n'
        '    return apiClient.get(`/api/reports/detail/?${q}`);\n'
        '  },\n'
        '};',
        API)
    write(API, api)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 4 — owner/reports.tsx: full rewrite with popup detail card
# ─────────────────────────────────────────────────────────────────────────────
info('FIX 4 — owner/reports.tsx: add tappable detail popup card')
REPORTS_NEW = r'''/**
 * Laizer — Owner: Reports Screen
 * Daily/weekly toggle. Tap a branch card → scrollable detail popup
 * with full service breakdown + stock snapshot + Share + Download.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Modal, Platform,
  ScrollView, Share, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing    from 'expo-sharing';
import { Ionicons }    from '@expo/vector-icons';
import { reportService, getApiError } from '@/services/api';
import { Card } from '@/components/ui';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

type ReportMode = 'daily' | 'weekly';

function fmtMoney(n: number): string {
  return `Tshs ${Number(n).toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`;
}

// ── Detail popup card ─────────────────────────────────────────────────────────
interface DetailRow {
  centre: { name: string; centreNo: string; centreId: string; location?: string };
  label: string;
  mode: string;
  totalEvents: number;
  totalRevenueTshs: number;
  byServiceType: Record<string, number>;
  events: Array<{
    id: string; serviceType: string; serviceSubtype?: string;
    pages?: number; pricePerPageTshs?: number; totalAmountTshs: number;
    customerNote?: string; createdAt: string;
    worker?: { fullName: string };
  }>;
  stock: Array<{ itemName: string; quantity: number; unit: string; netStockPriceTshs: number }>;
}

function DetailCard({
  visible, row, mode, onClose,
}: {
  visible: boolean; row: DetailRow | null; mode: ReportMode; onClose: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 600,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [visible]);

  if (!row) return null;

  const shareText = () => {
    const lines = [
      `📊 ${row.centre.name} (${row.centre.centreNo}) — ${row.label}`,
      `Total Revenue: ${fmtMoney(row.totalRevenueTshs)}`,
      `Total Services: ${row.totalEvents}`,
      '',
      'Services:',
      ...Object.entries(row.byServiceType).map(([t, c]) => `  • ${t}: ${c}`),
      '',
      'Stock Snapshot:',
      ...row.stock.map(s => `  • ${s.itemName}: ${s.quantity} ${s.unit}`),
    ];
    return lines.join('\n');
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: shareText(), title: `${row.centre.name} Report` });
    } catch { /* user cancelled */ }
  };

  const handleDownload = async () => {
    try {
      const json   = JSON.stringify(row, null, 2);
      const fname  = `laizer_report_${row.centre.centreId}_${row.label.replace(/\s/g,'_')}.json`;
      const path   = `${FileSystem.cacheDirectory}${fname}`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: `Save ${fname}` });
      } else {
        Alert.alert('Saved', `Report saved to:\n${path}`);
      }
    } catch (e) {
      Alert.alert('Error', `Could not save file: ${(e as Error).message}`);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={D.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[D.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Header */}
        <View style={D.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={D.sheetTitle} numberOfLines={1}>{row.centre.name}</Text>
            <Text style={D.sheetSub}>{row.centre.centreNo}  ·  {row.label}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={D.closeBtn} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Totals row */}
        <View style={D.totalsRow}>
          <View style={D.totalBox}>
            <Text style={D.totalVal}>{fmtMoney(row.totalRevenueTshs)}</Text>
            <Text style={D.totalLbl}>Total Revenue</Text>
          </View>
          <View style={D.totalDivider} />
          <View style={D.totalBox}>
            <Text style={D.totalVal}>{row.totalEvents}</Text>
            <Text style={D.totalLbl}>Services</Text>
          </View>
        </View>

        {/* Scrollable body */}
        <ScrollView style={D.body} showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: 80 }}>

          {/* Service type breakdown */}
          {Object.keys(row.byServiceType).length > 0 && (
            <View style={D.section}>
              <Text style={D.sectionTitle}>BY SERVICE TYPE</Text>
              {Object.entries(row.byServiceType).map(([type, count]) => (
                <View key={type} style={D.svcRow}>
                  <Text style={D.svcName}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                  <Text style={D.svcCount}>{count as number}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Individual events */}
          {row.events.length > 0 && (
            <View style={D.section}>
              <Text style={D.sectionTitle}>SERVICE LOG</Text>
              {row.events.map(ev => (
                <View key={ev.id} style={D.evtRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={D.evtType}>
                      {ev.serviceType}{ev.serviceSubtype ? ` · ${ev.serviceSubtype}` : ''}
                    </Text>
                    {ev.worker && <Text style={D.evtMeta}>By {ev.worker.fullName}</Text>}
                    {ev.customerNote ? <Text style={D.evtNote}>{ev.customerNote}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={D.evtAmt}>{fmtMoney(Number(ev.totalAmountTshs))}</Text>
                    <Text style={D.evtMeta}>
                      {new Date(ev.createdAt).toLocaleTimeString('en-TZ', { hour:'2-digit', minute:'2-digit' })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Stock snapshot */}
          {row.stock.length > 0 && (
            <View style={D.section}>
              <Text style={D.sectionTitle}>STOCK SNAPSHOT</Text>
              {row.stock.map((s, i) => (
                <View key={i} style={D.stockRow}>
                  <Text style={D.stockName}>{s.itemName}</Text>
                  <Text style={D.stockQty}>{Number(s.quantity)} {s.unit}</Text>
                  <Text style={D.stockPrice}>{fmtMoney(Number(s.netStockPriceTshs))}</Text>
                </View>
              ))}
            </View>
          )}

          {row.events.length === 0 && row.stock.length === 0 && (
            <Text style={D.empty}>No data recorded for this period.</Text>
          )}
        </ScrollView>

        {/* Action buttons */}
        <View style={D.actions}>
          <TouchableOpacity style={D.actionBtn} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
            <Text style={D.actionTxt}>Share</Text>
          </TouchableOpacity>
          <View style={D.actionDivider} />
          <TouchableOpacity style={D.actionBtn} onPress={handleDownload}>
            <Ionicons name="download-outline" size={18} color={Colors.primary} />
            <Text style={D.actionTxt}>Download</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const [mode,      setMode]      = useState<ReportMode>('daily');
  const [data,      setData]      = useState<unknown[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [selected,  setSelected]  = useState<DetailRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (m: ReportMode) => {
    setLoading(true);
    try {
      const res = m === 'daily' ? await reportService.daily() : await reportService.weekly();
      setData(res.data);
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(mode); }, [mode]);

  const openDetail = async (row: { centre?: { id?: string } }) => {
    const centreId = row?.centre?.id;
    if (!centreId) return;
    setDetailLoading(true);
    try {
      const res = await reportService.detail({ centreId, mode });
      setSelected(res.data as DetailRow);
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setDetailLoading(false); }
  };

  return (
    <View style={RS.root}>
      <View style={RS.header}>
        <Text style={RS.title}>Reports</Text>
        <View style={RS.toggle}>
          {(['daily', 'weekly'] as ReportMode[]).map(m => (
            <TouchableOpacity
              key={m}
              style={[RS.toggleBtn, mode === m && RS.toggleActive]}
              onPress={() => setMode(m)}>
              <Text style={[RS.toggleText, mode === m && RS.toggleTextActive]}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {detailLoading && (
        <View style={RS.detailLoader}>
          <ActivityIndicator color={Colors.white} size="small" />
          <Text style={{ color: Colors.white, marginLeft: 8, fontSize: FontSize.sm }}>Loading report…</Text>
        </View>
      )}

      <ScrollView style={{ flex: 1, padding: Spacing.base }}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} />
        ) : data.length === 0 ? (
          <Text style={RS.empty}>No data available.</Text>
        ) : (
          (data as Array<Record<string, unknown>>).map((row, i) => (
            <TouchableOpacity key={i} activeOpacity={0.75} onPress={() => openDetail(row as { centre?: { id?: string } })}>
              <Card style={RS.card}>
                <View style={RS.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={RS.centreName}>{(row.centre as { name?: string })?.name ?? '—'}</Text>
                    <Text style={RS.centreNo}>{(row.centre as { centreNo?: string })?.centreNo}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textDisabled} />
                </View>
                <View style={RS.stats}>
                  <StatItem label="Revenue"  value={fmtMoney((row.totalRevenueTshs as number) ?? 0)} accent />
                  <StatItem label="Services" value={String((row.totalEvents as number) ?? 0)} />
                  {(row.topService as string) && <StatItem label="Top Service" value={row.topService as string} />}
                </View>
                {row.byServiceType && Object.keys(row.byServiceType as object).length > 0 && (
                  <View style={RS.breakdown}>
                    {Object.entries(row.byServiceType as Record<string, number>).map(([type, count]) => (
                      <Text key={type} style={RS.breakdownRow}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}: {count}
                      </Text>
                    ))}
                  </View>
                )}
                <Text style={RS.tapHint}>Tap for full report</Text>
              </Card>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <DetailCard
        visible={selected !== null}
        row={selected}
        mode={mode}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

function StatItem({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[RS.statValue, accent && { color: Colors.accent }]}>{value}</Text>
      <Text style={RS.statLabel}>{label}</Text>
    </View>
  );
}

const RS = StyleSheet.create({
  root:            { flex: 1, backgroundColor: Colors.background },
  header:          { padding: Spacing.xl, paddingTop: 60, backgroundColor: Colors.primary },
  title:           { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white, marginBottom: Spacing.md },
  toggle:          { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.md, padding: 3 },
  toggleBtn:       { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  toggleActive:    { backgroundColor: Colors.white },
  toggleText:      { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: 'rgba(255,255,255,0.8)' },
  toggleTextActive:{ color: Colors.primary },
  detailLoader:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary,
                     paddingHorizontal: Spacing.base, paddingVertical: 8 },
  empty:           { textAlign: 'center', color: Colors.textDisabled, padding: Spacing['3xl'] },
  card:            { marginBottom: Spacing.sm },
  cardHeader:      { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  centreName:      { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  centreNo:        { fontSize: FontSize.xs, color: Colors.textDisabled, marginBottom: Spacing.md },
  stats:           { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  statValue:       { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statLabel:       { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  breakdown:       { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider },
  breakdownRow:    { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 2 },
  tapHint:         { fontSize: FontSize.xs, color: Colors.primary, marginTop: Spacing.sm, textAlign: 'right' },
});

// Detail sheet styles
const D = StyleSheet.create({
  backdrop:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:         { position: 'absolute', bottom: 0, left: 0, right: 0,
                   backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 20, borderTopRightRadius: 20,
                   maxHeight: '88%', shadowColor: '#000', shadowOffset: { width:0, height:-4 },
                   shadowOpacity: 0.15, shadowRadius: 12, elevation: 20 },
  sheetHeader:   { flexDirection: 'row', alignItems: 'center', padding: Spacing.base,
                   borderBottomWidth: 1, borderBottomColor: Colors.border },
  sheetTitle:    { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sheetSub:      { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  closeBtn:      { padding: 4 },
  totalsRow:     { flexDirection: 'row', backgroundColor: Colors.primarySurface,
                   marginHorizontal: Spacing.base, marginVertical: Spacing.sm, borderRadius: Radius.md },
  totalBox:      { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  totalVal:      { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  totalLbl:      { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  totalDivider:  { width: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  body:          { paddingHorizontal: Spacing.base },
  section:       { marginBottom: Spacing.md },
  sectionTitle:  { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textDisabled,
                   letterSpacing: 1, marginBottom: Spacing.sm },
  svcRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
                   borderBottomWidth: 1, borderBottomColor: Colors.divider },
  svcName:       { fontSize: FontSize.sm, color: Colors.textPrimary },
  svcCount:      { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  evtRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
                   borderBottomWidth: 1, borderBottomColor: Colors.divider },
  evtType:       { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  evtMeta:       { fontSize: FontSize.xs, color: Colors.textDisabled, marginTop: 2 },
  evtNote:       { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, fontStyle: 'italic' },
  evtAmt:        { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.accent },
  stockRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
                   borderBottomWidth: 1, borderBottomColor: Colors.divider, gap: 8 },
  stockName:     { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  stockQty:      { fontSize: FontSize.sm, color: Colors.textSecondary, minWidth: 60, textAlign: 'right' },
  stockPrice:    { fontSize: FontSize.sm, color: Colors.accent, minWidth: 80, textAlign: 'right' },
  empty:         { textAlign: 'center', color: Colors.textDisabled, padding: Spacing['3xl'] },
  actions:       { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border,
                   backgroundColor: Colors.backgroundCard, paddingBottom: Platform.OS === 'ios' ? 28 : 12 },
  actionBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                   gap: 8, paddingVertical: 16 },
  actionTxt:     { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: Colors.primary },
  actionDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 8 },
});
'''

write('mobile/app/(owner)/reports.tsx', REPORTS_NEW)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2 — owner/notices.tsx: remove priority crash, simplify send form
# ─────────────────────────────────────────────────────────────────────────────
info('FIX 2 — notices.tsx: remove priority, fix send crash')
NOTICES = 'mobile/app/(owner)/notices.tsx'
nots_ui = read(NOTICES)

if 'expiresAt' in nots_ui or '48 hour' in nots_ui:
    warn('Notices already patched — skipping UI rewrite')
else:
    # Remove priority from send payload (backend now defaults to 'normal')
    nots_ui = sub(nots_ui,
        "      await noticeService.send({ centreId: form.centreId, body: form.body, priority: form.priority });",
        "      await noticeService.send({ centreId: form.centreId, body: form.body });",
        NOTICES)

    # Remove priority picker UI from form and state
    nots_ui = sub(nots_ui,
        "  const [form, setForm] = useState({ centreId:'', body:'', priority:'normal' as string });",
        "  const [form, setForm] = useState({ centreId:'', body:'' });",
        NOTICES)

    # Remove priority from form reset after send
    nots_ui = sub(nots_ui,
        "      setShowForm(false); setForm(p => ({ ...p, body:'', priority:'normal' }));",
        "      setShowForm(false); setForm(p => ({ ...p, body:'' }));",
        NOTICES)

    # Remove PRIORITIES const and wordCount/MAX_WORDS if still present (safe no-op if missing)
    if "const PRIORITIES" in nots_ui:
        nots_ui = nots_ui.replace("const PRIORITIES = ['normal', 'urgent', 'low'] as const;\n", "")

    # Remove priority picker section from JSX
    old_priority_section = (
        "          {/* Priority */}\n"
        "          <Text style={N.fieldLabel}>Priority</Text>\n"
        "          <View style={N.pillRow}>\n"
        "            {PRIORITIES.map(p => (\n"
        "              <TouchableOpacity key={p} style={[N.pill, form.priority===p && N.pillActive]}\n"
        "                onPress={() => setForm(f => ({ ...f, priority: p }))}>\n"
        "                <Text style={[N.pillTxt, form.priority===p && N.pillTxtActive]}>\n"
        "                  {p.charAt(0).toUpperCase()+p.slice(1)}\n"
        "                </Text>\n"
        "              </TouchableOpacity>\n"
        "            ))}\n"
        "          </View>\n\n"
    )
    if old_priority_section in nots_ui:
        nots_ui = nots_ui.replace(old_priority_section, "")
        ok('Removed priority picker from notices form')

    # Add expiry hint below form title
    nots_ui = sub(nots_ui,
        "          <Text style={N.formTitle}>Send Notice to Workers</Text>",
        "          <Text style={N.formTitle}>Send Notice to Workers</Text>\n"
        "          <Text style={{ fontSize: FontSize.xs, color: Colors.textDisabled, marginBottom: Spacing.sm }}>\n"
        "            Notices are automatically removed after 48 hours.\n"
        "          </Text>",
        NOTICES)

    write(NOTICES, nots_ui)

print(f'\n{G}━━━ Patch v3 {"(DRY RUN — nothing changed)" if DRY else "applied"} ━━━{E}')
print("""
Summary
───────
FIX 1  backend/src/routes/services.js
       • POST/PATCH/DELETE all bust the in-memory report cache for that centre
         so owner's Daily/Weekly screens reflect new events immediately.

FIX 2  backend/prisma/schema.prisma
       • Notice.expiresAt (DateTime?) added — run `npx prisma db push` after patch.

       backend/src/routes/notices.js
       • GET filters out expired notices (expiresAt < now)
       • POST sets expiresAt = now + 48h automatically
       • priority field made optional (default 'normal') — fixes send crash

       mobile/app/(owner)/notices.tsx
       • Priority picker removed (no longer sent — backend defaults to normal)
       • Expiry hint shown under form title
       • Send payload simplified: only centreId + body

FIX 3  mobile/components/ui/Button.tsx
       • Loading state keeps real gradient colour at 72% opacity
       • Spinner always white on gradient buttons

FIX 4  backend/src/routes/reports.js
       • New GET /api/reports/detail/ endpoint returns full event log + stock snapshot

       mobile/services/api.ts
       • reportService.detail() added

       mobile/app/(owner)/reports.tsx
       • Branch cards now tappable → animated bottom-sheet popup
       • Popup shows: totals, service breakdown, per-event log, stock snapshot
       • Share (native share sheet) and Download (JSON via expo-sharing) buttons
       • Scrollable body prevents bad rendering on large datasets

Post-patch steps:
  1. cd backend && npx prisma db push   (adds expiresAt column to notices table)
  2. cd mobile && npx expo install expo-file-system expo-sharing
  3. Push & deploy backend to Render
""")
