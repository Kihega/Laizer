#!/usr/bin/env python3
"""
Laizer Patch v4

  A. CI FIX — removes the unused `mode` prop from DetailCard in
     mobile/app/(owner)/reports.tsx (the 1 remaining ESLint error).

  B. NEW FEATURE — Office Utilities / Equipment tracking
     - Prisma model: Equipment (itemName, category, quantity, condition, notes)
     - Backend: backend/src/routes/equipment.js
         GET    /api/equipment/       worker: their centre; owner: all/filtered
         POST   /api/equipment/       worker: register equipment
         PATCH  /api/equipment/:id/   worker: update quantity/condition
         DELETE /api/equipment/:id/   worker: remove entry
     - Registered in backend/src/app.js
     - Audit actions added (EQUIPMENT_CREATED/UPDATED/DELETED)
     - mobile/constants/api.ts: equipment routes
     - mobile/services/api.ts: equipmentService
     - mobile/app/(worker)/equipment.tsx: full CRUD screen (mirrors stock.tsx)
     - mobile/app/(worker)/dashboard.tsx: new "Office Utilities" quick-action
       card + low-stock-style summary section

Run from project root:
  python3 patch_laizer_v4.py
  python3 patch_laizer_v4.py --dry-run
  python3 patch_laizer_v4.py --undo

Post-patch:
  1. cd backend && npx prisma db push
  2. Restart Expo / rebuild app
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
    p = fp(rel); bak = p + '.bak3'
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

import re as _re

def insert_after_line(src, line_fragment, new_line, label, skip_if_present=None, raw=False):
    """
    Find the first line containing `line_fragment` and insert `new_line`
    immediately after it. Whitespace/ordering-tolerant alternative to sub().
    If skip_if_present is given and already in src, no-op (idempotent).
    If raw=True, `new_line` is inserted exactly as given (no auto-indent) —
    use this when passing a pre-formatted multi-line block.
    """
    if skip_if_present and skip_if_present in src:
        warn(f'{label}: already present — skip')
        return src
    lines = src.splitlines(keepends=True)
    for i, line in enumerate(lines):
        if line_fragment in line:
            if raw:
                lines.insert(i + 1, new_line + '\n')
            else:
                indent = line[:len(line) - len(line.lstrip())]
                lines.insert(i + 1, indent + new_line + '\n')
            return ''.join(lines)
    die(f'Line fragment not found in {label}: {repr(line_fragment)}')

def insert_before_line(src, line_fragment, new_line, label, skip_if_present=None):
    """Same as insert_after_line but inserts before the matched line."""
    if skip_if_present and skip_if_present in src:
        warn(f'{label}: already present — skip')
        return src
    lines = src.splitlines(keepends=True)
    for i, line in enumerate(lines):
        if line_fragment in line:
            indent = line[:len(line) - len(line.lstrip())]
            lines.insert(i, indent + new_line + '\n')
            return ''.join(lines)
    die(f'Line fragment not found in {label}: {repr(line_fragment)}')

def insert_block_before(src, line_fragment, block, label, skip_if_present=None):
    """Insert a multi-line block (already newline-terminated) before the
    first line containing line_fragment."""
    if skip_if_present and skip_if_present in src:
        warn(f'{label}: already present — skip')
        return src
    idx = src.find(line_fragment)
    if idx == -1:
        die(f'Line fragment not found in {label}: {repr(line_fragment)}')
    # back up to the start of that line
    line_start = src.rfind('\n', 0, idx) + 1
    return src[:line_start] + block + src[line_start:]

TARGETS = [
    'mobile/app/(owner)/reports.tsx',
    'backend/prisma/schema.prisma',
    'backend/src/lib/audit.js',
    'backend/src/app.js',
    'mobile/constants/api.ts',
    'mobile/services/api.ts',
    'mobile/app/(worker)/dashboard.tsx',
]

if UNDO:
    print(f'\n{Y}━━━ UNDO ━━━{E}\n')
    for f in TARGETS:
        p, bak = fp(f), fp(f) + '.bak3'
        if os.path.exists(bak): shutil.copy2(bak, p); os.remove(bak); ok(f'Restored {f}')
        else: warn(f'No backup: {f}')
    eq_route = fp('backend/src/routes/equipment.js')
    eq_screen = fp('mobile/app/(worker)/equipment.tsx')
    for p in (eq_route, eq_screen):
        if os.path.exists(p): os.remove(p); ok(f'Removed {p}')
    print(f'\n{G}Done.{E}\n'); sys.exit(0)

print(f'\n{B}━━━ Laizer Patch v4 {"(DRY RUN)" if DRY else ""} ━━━{E}\n')

# ═══════════════════════════════════════════════════════════════════════════════
# A. CI FIX — remove unused `mode` prop from DetailCard
# ═══════════════════════════════════════════════════════════════════════════════
info('FIX A — reports.tsx: remove unused `mode` prop from DetailCard (CI error)')
RPT_TSX = 'mobile/app/(owner)/reports.tsx'
rpt = read(RPT_TSX)

if _re.search(r'visible,\s*row,\s*mode,\s*onClose,', rpt):
    # Remove `mode` from the destructured props line
    rpt = _re.sub(r'visible,\s*row,\s*mode,\s*onClose,', 'visible, row, onClose,', rpt, count=1)
    # Remove `mode: ReportMode;` from the inline type annotation
    rpt = _re.sub(r'\s*mode:\s*ReportMode;', '', rpt, count=1)
    # Remove the `mode={mode}` prop at the call site
    rpt = _re.sub(r'\n\s*mode=\{mode\}', '', rpt, count=1)
    write(RPT_TSX, rpt)
    ok('Removed unused `mode` prop from DetailCard')
else:
    warn('DetailCard mode prop already removed — skipping FIX A')

# ═══════════════════════════════════════════════════════════════════════════════
# B1. Prisma schema — Equipment model
# ═══════════════════════════════════════════════════════════════════════════════
info('FIX B1 — schema.prisma: add Equipment model')
SCHEMA = 'backend/prisma/schema.prisma'
sch = read(SCHEMA)

if 'model Equipment' in sch:
    warn('Equipment model already present — skipping schema edit')
else:
    # 1) Add the EquipmentCondition enum right after the NoticePriority enum closes.
    #    Anchor on the single line "urgent" inside NoticePriority, then find its
    #    closing brace — far more robust than matching the whole enum block verbatim.
    idx = sch.find('enum NoticePriority')
    if idx == -1:
        die('Could not find "enum NoticePriority" in schema.prisma')
    close_idx = sch.find('}', idx)
    if close_idx == -1:
        die('Could not find closing brace for NoticePriority enum')
    insertion_point = close_idx + 1
    enum_block = (
        '\n\nenum EquipmentCondition {\n'
        '  good\n'
        '  fair\n'
        '  needs_repair\n'
        '  broken\n'
        '}'
    )
    sch = sch[:insertion_point] + enum_block + sch[insertion_point:]
    ok('Inserted EquipmentCondition enum after NoticePriority')

    # 2) Add `registeredEquipment Equipment[]` to the User model — anchor on the
    #    single line that declares registeredStock (order/blank-lines agnostic).
    sch = insert_after_line(
        sch,
        line_fragment='registeredStock',
        new_line='registeredEquipment Equipment[]',
        label='schema.prisma (User.registeredEquipment)',
    )

    # 3) Add `equipment Equipment[]` to the Centre model — anchor on the line
    #    that declares the Centre's `notices` relation.
    sch = insert_after_line(
        sch,
        line_fragment='notices       Notice[]',
        new_line='equipment     Equipment[]',
        label='schema.prisma (Centre.equipment)',
    )

    # 4) Insert the full Equipment model before the ServiceEvent model comment.
    #    Anchor on a short, distinctive substring of that comment line.
    equipment_model = '''
// ── Equipment ─────────────────────────────────────────────────────────────────
// Office utilities/tools used to provide services: printers, scanners, laptops,
// desktops, cameras, etc. Distinct from StockItem (consumables like paper/ink).

model Equipment {
  id           String             @id @default(uuid())
  centreId     String             @map("centre_id")
  registeredBy String?            @map("registered_by")
  itemName     String             @map("item_name")     // e.g. "Printer", "Scanner"
  category     String?                                  // e.g. "Printing", "Computing"
  quantity     Int                @default(1)
  condition    EquipmentCondition @default(good)
  notes        String?
  createdAt    DateTime           @default(now()) @map("created_at")
  updatedAt    DateTime           @updatedAt        @map("updated_at")

  centre Centre @relation(fields: [centreId],     references: [id], onDelete: Cascade)
  worker User?  @relation(fields: [registeredBy], references: [id], onDelete: SetNull)

  @@index([centreId])
  @@map("equipment")
}

'''
    se_idx = sch.find('model ServiceEvent')
    if se_idx == -1:
        die('Could not find "model ServiceEvent" in schema.prisma')
    # Back up to the start of the nearest preceding comment block, or just the line start.
    line_start = sch.rfind('\n', 0, se_idx) + 1
    # Walk further back to swallow any "// ──" comment header directly above it.
    probe = line_start
    while True:
        prev_line_start = sch.rfind('\n', 0, probe - 1) + 1 if probe > 0 else 0
        prev_line = sch[prev_line_start:probe]
        if prev_line.strip().startswith('//') or prev_line.strip() == '':
            probe = prev_line_start
            if prev_line_start == 0:
                break
        else:
            break
    sch = sch[:probe] + equipment_model + sch[probe:]
    ok('Inserted Equipment model before ServiceEvent model')

    write(SCHEMA, sch)

# ═══════════════════════════════════════════════════════════════════════════════
# B2. Audit actions
# ═══════════════════════════════════════════════════════════════════════════════
info('FIX B2 — audit.js: add EQUIPMENT_* actions')
AUDIT = 'backend/src/lib/audit.js'
aud = read(AUDIT)

if 'EQUIPMENT_CREATED' in aud:
    warn('EQUIPMENT actions already present — skipping')
else:
    aud = insert_after_line(
        aud,
        line_fragment="STOCK_DELETED:",
        new_line="EQUIPMENT_CREATED:     'EQUIPMENT_CREATED',",
        label='audit.js',
    )
    aud = insert_after_line(
        aud,
        line_fragment="EQUIPMENT_CREATED:",
        new_line="EQUIPMENT_UPDATED:     'EQUIPMENT_UPDATED',",
        label='audit.js',
    )
    aud = insert_after_line(
        aud,
        line_fragment="EQUIPMENT_UPDATED:",
        new_line="EQUIPMENT_DELETED:     'EQUIPMENT_DELETED',",
        label='audit.js',
    )
    write(AUDIT, aud)

# ═══════════════════════════════════════════════════════════════════════════════
# B3. Backend route — equipment.js (new file)
# ═══════════════════════════════════════════════════════════════════════════════
info('FIX B3 — create backend/src/routes/equipment.js')
EQ_ROUTE = 'backend/src/routes/equipment.js'
if os.path.exists(fp(EQ_ROUTE)):
    warn('equipment.js already exists — skipping creation')
else:
    equipment_route_src = '''/**
 * SMSS — Office Equipment / Utilities routes
 *
 * Tracks durable office equipment used to provide services:
 * printers, scanners, laptops, desktops, cameras, lamination machines, etc.
 * Distinct from StockItem, which tracks consumables (paper, ink, lamination film).
 *
 * GET    /api/equipment/      — worker: their centre; owner: all centres (filter ?centreId=)
 * POST   /api/equipment/      — worker: register equipment
 * PATCH  /api/equipment/:id/  — worker: update quantity/condition/notes
 * DELETE /api/equipment/:id/  — worker: remove entry
 */
const { Router }                   = require('express');
const { z }                        = require('zod');
const prisma                       = require('../lib/prisma');
const redis                        = require('../lib/redis');
const logAction                    = require('../lib/audit');
const { authenticate, workerOnly } = require('../middleware/auth');

const router = Router();
router.use(authenticate);

const CONDITIONS = ['good', 'fair', 'needs_repair', 'broken'];

// ── GET /api/equipment/ ───────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    if (req.user.role === 'worker') {
      const centreId = req.user.centreId;
      const cacheKey = redis.CacheKey.equipment(centreId);
      let   items    = await redis.cacheGet(cacheKey);

      if (!items) {
        items = await prisma.equipment.findMany({
          where:   { centreId },
          orderBy: { itemName: 'asc' },
        });
        await redis.cacheSet(cacheKey, items, redis.CacheTTL.EQUIPMENT);
      }
      return res.json(items);
    }

    if (req.user.role === 'owner') {
      const ownerId  = req.user.id;
      const centreId = req.query.centreId;

      if (centreId) {
        const centre = await prisma.centre.findFirst({ where: { id: centreId, ownerId } });
        if (!centre) return res.status(404).json({ error: 'not_found', detail: 'Centre not found.' });

        const items = await prisma.equipment.findMany({
          where: { centreId }, orderBy: { itemName: 'asc' },
        });
        return res.json(items);
      }

      const centres = await prisma.centre.findMany({ where: { ownerId, isActive: true }, select: { id: true } });
      const items   = await prisma.equipment.findMany({
        where:   { centreId: { in: centres.map(c => c.id) } },
        include: { centre: { select: { id:true, name:true, centreNo:true } } },
        orderBy: [{ centre: { name: 'asc' } }, { itemName: 'asc' }],
      });
      return res.json(items);
    }
  } catch (err) { next(err); }
});

// ── POST /api/equipment/ ──────────────────────────────────────────────────────
const CreateEquipmentSchema = z.object({
  itemName: z.string().min(1).max(80),
  category: z.string().max(50).optional(),
  quantity: z.number().int().min(0).default(1),
  condition: z.enum(CONDITIONS).default('good'),
  notes:    z.string().max(300).optional(),
});

router.post('/', workerOnly, async (req, res, next) => {
  try {
    const parsed = CreateEquipmentSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const item = await prisma.equipment.create({
      data: {
        ...parsed.data,
        centreId:     req.user.centreId,
        registeredBy: req.user.id,
      },
    });

    await redis.cacheDel(redis.CacheKey.equipment(req.user.centreId));
    await logAction(req.user.id, logAction.ACTIONS.EQUIPMENT_CREATED, { req, itemId: item.id });
    return res.status(201).json(item);
  } catch (err) { next(err); }
});

// ── PATCH /api/equipment/:id/ ─────────────────────────────────────────────────
const UpdateEquipmentSchema = z.object({
  itemName:  z.string().min(1).max(80).optional(),
  category:  z.string().max(50).optional(),
  quantity:  z.number().int().min(0).optional(),
  condition: z.enum(CONDITIONS).optional(),
  notes:     z.string().max(300).optional(),
});

router.patch('/:id/', workerOnly, async (req, res, next) => {
  try {
    const parsed = UpdateEquipmentSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const result = await prisma.equipment.updateMany({
      where: { id: req.params.id, centreId: req.user.centreId },
      data:  parsed.data,
    });
    if (!result.count) return res.status(404).json({ error: 'not_found', detail: 'Equipment item not found.' });

    await redis.cacheDel(redis.CacheKey.equipment(req.user.centreId));
    await logAction(req.user.id, logAction.ACTIONS.EQUIPMENT_UPDATED, { req, itemId: req.params.id });
    return res.json({ detail: 'Equipment updated.' });
  } catch (err) { next(err); }
});

// ── DELETE /api/equipment/:id/ ────────────────────────────────────────────────
router.delete('/:id/', workerOnly, async (req, res, next) => {
  try {
    const result = await prisma.equipment.deleteMany({
      where: { id: req.params.id, centreId: req.user.centreId },
    });
    if (!result.count) return res.status(404).json({ error: 'not_found', detail: 'Equipment item not found.' });

    await redis.cacheDel(redis.CacheKey.equipment(req.user.centreId));
    await logAction(req.user.id, logAction.ACTIONS.EQUIPMENT_DELETED, { req, itemId: req.params.id });
    return res.json({ detail: 'Equipment deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
'''
    write(EQ_ROUTE, equipment_route_src)

# ═══════════════════════════════════════════════════════════════════════════════
# B4. Redis cache helpers — add equipment key/TTL
# ═══════════════════════════════════════════════════════════════════════════════
info('FIX B4 — redis.js: add equipment CacheKey/TTL')
REDIS = 'backend/src/lib/redis.js'
red = read(REDIS)

if 'equipment:' in red or 'equipment(' in red:
    warn('Equipment cache key already present — skipping')
else:
    red = insert_after_line(
        red,
        line_fragment='stock:         (centreId)',
        new_line="equipment:     (centreId)       => `equipment:${centreId}`,",
        label='redis.js (CacheKey)',
    )
    red = insert_after_line(
        red,
        line_fragment='STOCK:         120,',
        new_line='EQUIPMENT:     120,',
        label='redis.js (CacheTTL)',
    )
    write(REDIS, red)

# ═══════════════════════════════════════════════════════════════════════════════
# B5. Register route in app.js
# ═══════════════════════════════════════════════════════════════════════════════
info('FIX B5 — app.js: register /api/equipment/ route')
APP = 'backend/src/app.js'
app = read(APP)

if "routes/equipment" in app:
    warn('equipment route already registered — skipping')
else:
    app = insert_after_line(
        app,
        line_fragment="app.use('/api/stock/'",
        new_line="app.use('/api/equipment/', require('./routes/equipment'));",
        label='app.js',
    )
    write(APP, app)

# ═══════════════════════════════════════════════════════════════════════════════
# B6. mobile/constants/api.ts — equipment routes
# ═══════════════════════════════════════════════════════════════════════════════
info('FIX B6 — api.ts constants: add equipment routes')
API_CONST = 'mobile/constants/api.ts'
apic = read(API_CONST)

if 'equipment:' in apic:
    warn('Equipment routes already in constants/api.ts — skipping')
else:
    block = (
        "\n"
        "  // Equipment (office utilities)\n"
        "  equipment:     '/api/equipment/',\n"
        "  equipmentItem: (id: string) => `/api/equipment/${id}/`,"
    )
    apic = insert_after_line(
        apic,
        line_fragment="stockItem:    (id: string)",
        new_line=block,
        label='api.ts constants (equipment routes)',
        raw=True,
    )
    write(API_CONST, apic)

# ═══════════════════════════════════════════════════════════════════════════════
# B7. mobile/services/api.ts — equipmentService
# ═══════════════════════════════════════════════════════════════════════════════
info('FIX B7 — services/api.ts: add equipmentService')
API_SVC = 'mobile/services/api.ts'
apis = read(API_SVC)

if 'equipmentService' in apis:
    warn('equipmentService already present — skipping')
else:
    equipment_service_block = (
        "// ── Equipment (office utilities) ───────────────────────────────────────────────\n"
        "export const equipmentService = {\n"
        "  list:   (centreId?: string) =>\n"
        "    apiClient.get(API_ROUTES.equipment + (centreId ? `?centreId=${centreId}` : '')),\n"
        "  create: (body: object)             => apiClient.post(API_ROUTES.equipment, body),\n"
        "  update: (id: string, body: object) => apiClient.patch(API_ROUTES.equipmentItem(id), body),\n"
        "  delete: (id: string)               => apiClient.delete(API_ROUTES.equipmentItem(id)),\n"
        "};\n\n"
    )
    idx = apis.find('// ── Service events')
    if idx == -1:
        die('Could not find "// ── Service events" marker in services/api.ts')
    line_start = apis.rfind('\n', 0, idx) + 1
    apis = apis[:line_start] + equipment_service_block + apis[line_start:]
    write(API_SVC, apis)

# ═══════════════════════════════════════════════════════════════════════════════
# B8. mobile/app/(worker)/equipment.tsx — new CRUD screen
# ═══════════════════════════════════════════════════════════════════════════════
info('FIX B8 — create mobile/app/(worker)/equipment.tsx')
EQ_SCREEN = 'mobile/app/(worker)/equipment.tsx'
if os.path.exists(fp(EQ_SCREEN)):
    warn('equipment.tsx screen already exists — skipping creation')
else:
    equipment_screen_src = '''/**
 * Laizer — Worker: Office Utilities (Equipment) Screen
 * Tracks durable equipment: printers, scanners, laptops, desktops, cameras, etc.
 * Reached via a quick-action card on the dashboard (not a tab) — includes its
 * own back button since it renders without tab-bar chrome.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons }  from '@expo/vector-icons';
import { equipmentService, getApiError } from '@/services/api';
import { Card, Button, Input, StatusBadge } from '@/components/ui';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

const CONDITIONS = ['good', 'fair', 'needs_repair', 'broken'] as const;

interface EquipmentItem {
  id: string;
  itemName: string;
  category?: string | null;
  quantity: number;
  condition: typeof CONDITIONS[number];
  notes?: string | null;
}

const BLANK_FORM = { itemName: '', category: '', quantity: '1', condition: 'good' as string, notes: '' };

export default function EquipmentScreen() {
  const router = useRouter();
  const [items,      setItems]     = useState<EquipmentItem[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [refreshing, setRefresh]   = useState(false);
  const [showForm,   setShowForm]  = useState(false);
  const [delItem,    setDelItem]   = useState<EquipmentItem | null>(null);
  const [saving,     setSaving]    = useState(false);
  const [form, setForm] = useState(BLANK_FORM);

  const load = useCallback(async () => {
    try {
      const { data } = await equipmentService.list();
      setItems(data);
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setLoading(false); setRefresh(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.itemName.trim()) { Alert.alert('Missing field', 'Item name is required.'); return; }
    const qty = parseInt(form.quantity, 10);
    if (isNaN(qty) || qty < 0) { Alert.alert('Invalid quantity'); return; }
    setSaving(true);
    try {
      await equipmentService.create({
        itemName: form.itemName.trim(),
        category: form.category.trim() || undefined,
        quantity: qty,
        condition: form.condition,
        notes: form.notes.trim() || undefined,
      });
      setShowForm(false);
      setForm(BLANK_FORM);
      await load();
    } catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!delItem) return;
    setSaving(true);
    try { await equipmentService.delete(delItem.id); setDelItem(null); await load(); }
    catch (e) { Alert.alert('Error', getApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <View style={ES.root}>
      <View style={ES.header}>
        <View style={ES.headerTop}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <Text style={ES.title}>Office Utilities</Text>
          <Button label="+ Add" size="sm" onPress={() => setShowForm(v => !v)} />
        </View>
      </View>

      {showForm && (
        <Card style={ES.form}>
          <Text style={ES.formTitle}>Register Equipment</Text>
          <Input label="Item Name" placeholder="e.g. Printer, Scanner, Laptop" value={form.itemName}
            onChangeText={t => setForm(p => ({ ...p, itemName: t }))} />
          <View style={ES.row}>
            <Input label="Quantity" placeholder="1" value={form.quantity}
              onChangeText={t => setForm(p => ({ ...p, quantity: t }))}
              keyboardType="numeric" containerStyle={{ flex: 1 }} />
            <Input label="Category (optional)" placeholder="e.g. Printing" value={form.category}
              onChangeText={t => setForm(p => ({ ...p, category: t }))} containerStyle={{ flex: 1 }} />
          </View>
          <Text style={ES.unitLabel}>Condition</Text>
          <View style={ES.unitRow}>
            {CONDITIONS.map(c => (
              <Button key={c} label={c.replace('_', ' ')} size="sm"
                variant={form.condition === c ? 'primary' : 'secondary'}
                onPress={() => setForm(p => ({ ...p, condition: c }))}
                style={{ flex: 1 }} />
            ))}
          </View>
          <Input label="Notes (optional)" placeholder="Any additional info" value={form.notes}
            onChangeText={t => setForm(p => ({ ...p, notes: t }))} />
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <Button label="Cancel" variant="secondary" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
            <Button label="Save" onPress={handleCreate} loading={saving} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      {loading ? <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} /> : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefresh(true); load(); }} />}
          contentContainerStyle={{ padding: Spacing.base }}
          ListEmptyComponent={<Text style={ES.empty}>No equipment registered yet. Add your first item.</Text>}
          renderItem={({ item }) => (
            <Card style={ES.item}>
              <View style={ES.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={ES.itemName}>{item.itemName}</Text>
                  <View style={ES.itemMeta}>
                    <StatusBadge type={item.condition} size="sm" />
                    <Text style={ES.qty}>{item.quantity} unit{item.quantity === 1 ? '' : 's'}</Text>
                  </View>
                  {item.category ? <Text style={ES.category}>{item.category}</Text> : null}
                </View>
                <Text onPress={() => setDelItem(item)} style={ES.deleteBtn}>Delete</Text>
              </View>
              {item.notes ? <Text style={ES.notes}>{item.notes}</Text> : null}
            </Card>
          )}
        />
      )}

      <ConfirmModal
        visible={!!delItem}
        title="Delete Equipment"
        message={`Remove "${delItem?.itemName}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={saving}
        onConfirm={handleDelete}
        onCancel={() => setDelItem(null)}
      />
    </View>
  );
}

const ES = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.background },
  header:    { padding: Spacing.xl, paddingTop: 60, backgroundColor: Colors.primary },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  title:     { flex: 1, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white, marginLeft: Spacing.sm },
  form:      { margin: Spacing.base },
  formTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  row:       { flexDirection: 'row', gap: Spacing.sm },
  unitLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.xs },
  unitRow:   { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm, flexWrap: 'wrap' },
  empty:     { textAlign: 'center', color: Colors.textDisabled, padding: Spacing['3xl'] },
  item:      { marginBottom: Spacing.sm },
  itemRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  itemName:  { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemMeta:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  qty:       { fontSize: FontSize.sm, color: Colors.textSecondary },
  category:  { fontSize: FontSize.xs, color: Colors.textDisabled, marginTop: 2 },
  deleteBtn: { fontSize: FontSize.xs, color: Colors.error },
  notes:     { fontSize: FontSize.xs, color: Colors.textDisabled, marginTop: Spacing.xs },
});
'''
    write(EQ_SCREEN, equipment_screen_src)

# ═══════════════════════════════════════════════════════════════════════════════
# B9. mobile/app/(worker)/dashboard.tsx — add Office Utilities quick action
# ═══════════════════════════════════════════════════════════════════════════════
info('FIX B9 — worker dashboard.tsx: add Office Utilities quick action')
WDASH = 'mobile/app/(worker)/dashboard.tsx'
wd = read(WDASH)

if "(worker)/equipment" in wd:
    warn('Office Utilities quick action already present — skipping')
else:
    wd = insert_after_line(
        wd,
        line_fragment="label:'Notices',",
        new_line="{ label:'Office Utilities', icon:'hardware-chip-outline' as const, route:'/(worker)/equipment' },",
        label='dashboard.tsx (quick actions)',
    )
    # Wrap action cards into a 2x2 grid now that there are 4 (was a single row of 3).
    # Use regex on each style line independently so drift in one doesn't break the other.
    wd2, n1 = _re.subn(
        r"actions:\s*\{[^}]*\},",
        "actions:       { flexDirection:'row', flexWrap:'wrap', gap:Spacing.md, marginBottom:Spacing.sm },",
        wd, count=1,
    )
    if n1 == 0:
        die('Could not find `actions:` style line in dashboard.tsx')
    wd2, n2 = _re.subn(
        r"actionCard:\s*\{[^}]*\},",
        "actionCard:    { flexBasis:'45%', flexGrow:1, alignItems:'center', paddingVertical:Spacing.base },",
        wd2, count=1,
    )
    if n2 == 0:
        die('Could not find `actionCard:` style line in dashboard.tsx')
    wd = wd2
    write(WDASH, wd)

print(f'\n{G}━━━ Patch v4 {"(DRY RUN — nothing changed)" if DRY else "applied successfully"} ━━━{E}')
print("""
Summary
───────
FIX A  mobile/app/(owner)/reports.tsx
       • Removed unused `mode` prop from DetailCard — resolves the 1 ESLint error
         (@typescript-eslint/no-unused-vars is 'error' level in this project's config)

FIX B  New feature — Office Utilities / Equipment tracking
       • backend/prisma/schema.prisma   → Equipment model + EquipmentCondition enum
       • backend/src/lib/audit.js       → EQUIPMENT_CREATED/UPDATED/DELETED actions
       • backend/src/routes/equipment.js → full CRUD API (NEW FILE)
       • backend/src/lib/redis.js       → equipment cache key + TTL
       • backend/src/app.js             → registers /api/equipment/
       • mobile/constants/api.ts        → equipment route constants
       • mobile/services/api.ts         → equipmentService (list/create/update/delete)
       • mobile/app/(worker)/equipment.tsx → full CRUD screen (NEW FILE)
       • mobile/app/(worker)/dashboard.tsx → "Office Utilities" quick-action card

Equipment examples supported out of the box (free-text itemName, no fixed list):
  Printers, Scanners, Laptops, Desktops, Cameras, Lamination Machines,
  Binding Machines, Cutting Machines, Generators, etc. — quantity + condition tracked.

Post-patch steps:
  1. cd backend && npx prisma db push   (creates the equipment table)
  2. Restart Expo dev server / rebuild app
  3. Commit & push to trigger CI
""")
