/**
 * SMSS — Stock routes
 * __LAIZER_PATCH_V12__
 *
 * Stock is counted in PIECES only (no boxes / price / notes).
 *
 * GET    /api/stock/          — worker: their centre; owner: all centres (?centreId=)
 * POST   /api/stock/          — worker: register stock. If the item name already exists at
 *                               the centre (case-insensitive) the quantity is ADDED to that
 *                               card instead of creating a new one.
 * POST   /api/stock/:id/use/  — worker: use pieces. The item is deleted when it reaches 0.
 * PATCH  /api/stock/:id/      — worker: rename / set quantity (0 deletes the item)
 * DELETE /api/stock/:id/      — worker: delete item
 */
const { Router }                    = require('express');
const { z }                         = require('zod');
const prisma                        = require('../lib/prisma');
const redis                         = require('../lib/redis');
const logAction                     = require('../lib/audit');
const { authenticate, workerOnly }  = require('../middleware/auth');

const router = Router();
router.use(authenticate);

async function bustCaches(centreId) {
  await redis.cacheDel(redis.CacheKey.stock(centreId));
}

const cleanName = s => s.replace(/\s+/g, ' ').trim();

// ── GET /api/stock/ ───────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    if (req.user.role === 'worker') {
      const centreId = req.user.centreId;
      const cacheKey = redis.CacheKey.stock(centreId);
      let   items    = await redis.cacheGet(cacheKey);

      if (!items) {
        items = await prisma.stockItem.findMany({
          where:   { centreId, quantity: { gt: 0 } },
          orderBy: { itemName: 'asc' },
        });
        await redis.cacheSet(cacheKey, items, redis.CacheTTL.STOCK);
      }
      return res.json(items);
    }

    if (req.user.role === 'owner') {
      const ownerId   = req.user.id;
      const centreId  = req.query.centreId;

      if (centreId) {
        const centre = await prisma.centre.findFirst({ where: { id: centreId, ownerId } });
        if (!centre) return res.status(404).json({ error: 'not_found', detail: 'Centre not found.' });

        const items = await prisma.stockItem.findMany({
          where: { centreId, quantity: { gt: 0 } }, orderBy: { itemName: 'asc' },
        });
        return res.json(items);
      }

      const centres = await prisma.centre.findMany({ where: { ownerId, isActive: true }, select: { id: true } });
      const items   = await prisma.stockItem.findMany({
        where:   { centreId: { in: centres.map(c => c.id) }, quantity: { gt: 0 } },
        include: { centre: { select: { id:true, name:true, centreNo:true } } },
        orderBy: [{ centre: { name: 'asc' } }, { itemName: 'asc' }],
      });
      return res.json(items);
    }
  } catch (err) { next(err); }
});

// ── POST /api/stock/ ──────────────────────────────────────────────────────────
const CreateStockSchema = z.object({
  itemName: z.string().min(1).max(120).transform(cleanName).refine(s => s.length > 0, 'Item name required'),
  quantity: z.number().int().min(1),
});

router.post('/', workerOnly, async (req, res, next) => {
  try {
    const parsed = CreateStockSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const { itemName, quantity } = parsed.data;
    const centreId = req.user.centreId;

    // Same item already in stock (pcs)? Add to it.
    const existing = await prisma.stockItem.findFirst({
      where:   { centreId, unit: 'pcs', itemName: { equals: itemName, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    });

    let item, merged = false;
    if (existing) {
      item   = await prisma.stockItem.update({
        where: { id: existing.id },
        data:  { quantity: { increment: quantity } },
      });
      merged = true;
    } else {
      item = await prisma.stockItem.create({
        data: { itemName, quantity, unit: 'pcs', centreId, registeredBy: req.user.id },
      });
    }

    await bustCaches(centreId);
    await logAction(req.user.id, logAction.ACTIONS.STOCK_CREATED, { req, itemId: item.id, merged });
    return res.status(merged ? 200 : 201).json({ ...item, merged, addedQuantity: quantity });
  } catch (err) { next(err); }
});

// ── POST /api/stock/:id/use/ ──────────────────────────────────────────────────
const UseStockSchema = z.object({ quantity: z.number().int().min(1) });

router.post('/:id/use/', workerOnly, async (req, res, next) => {
  try {
    const parsed = UseStockSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const { quantity } = parsed.data;
    const where = { id: req.params.id, centreId: req.user.centreId };

    // Atomic decrement — only succeeds if enough pieces are left.
    const dec = await prisma.stockItem.updateMany({
      where: { ...where, quantity: { gte: quantity } },
      data:  { quantity: { decrement: quantity } },
    });

    if (!dec.count) {
      const current = await prisma.stockItem.findFirst({ where });
      if (!current) return res.status(404).json({ error: 'not_found', detail: 'Stock item not found.' });
      return res.status(400).json({
        error: 'insufficient_stock',
        detail: `Only ${Number(current.quantity)} pcs left in stock.`,
      });
    }

    // Nothing left → the card disappears.
    await prisma.stockItem.deleteMany({ where: { ...where, quantity: { lte: 0 } } });
    const left = await prisma.stockItem.findFirst({ where });

    await bustCaches(req.user.centreId);
    await logAction(req.user.id, logAction.ACTIONS.STOCK_UPDATED, { req, itemId: req.params.id, used: quantity });
    return res.json({ remaining: left ? Number(left.quantity) : 0, removed: !left });
  } catch (err) { next(err); }
});

// ── PATCH /api/stock/:id/ ─────────────────────────────────────────────────────
const UpdateStockSchema = z.object({
  itemName: z.string().min(1).max(120).transform(cleanName).optional(),
  quantity: z.number().int().min(0).optional(),
});

router.patch('/:id/', workerOnly, async (req, res, next) => {
  try {
    const parsed = UpdateStockSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const where = { id: req.params.id, centreId: req.user.centreId };

    if (parsed.data.quantity === 0) {
      const gone = await prisma.stockItem.deleteMany({ where });
      if (!gone.count) return res.status(404).json({ error: 'not_found', detail: 'Stock item not found.' });
      await bustCaches(req.user.centreId);
      await logAction(req.user.id, logAction.ACTIONS.STOCK_DELETED, { req, itemId: req.params.id });
      return res.json({ detail: 'Stock item removed (quantity reached 0).', removed: true });
    }

    const item = await prisma.stockItem.updateMany({ where, data: parsed.data });
    if (!item.count) return res.status(404).json({ error: 'not_found', detail: 'Stock item not found.' });

    await bustCaches(req.user.centreId);
    await logAction(req.user.id, logAction.ACTIONS.STOCK_UPDATED, { req, itemId: req.params.id });
    return res.json({ detail: 'Stock item updated.' });
  } catch (err) { next(err); }
});

// ── DELETE /api/stock/:id/ ────────────────────────────────────────────────────
router.delete('/:id/', workerOnly, async (req, res, next) => {
  try {
    const result = await prisma.stockItem.deleteMany({
      where: { id: req.params.id, centreId: req.user.centreId },
    });
    if (!result.count) return res.status(404).json({ error: 'not_found', detail: 'Stock item not found.' });

    await bustCaches(req.user.centreId);
    await logAction(req.user.id, logAction.ACTIONS.STOCK_DELETED, { req, itemId: req.params.id });
    return res.json({ detail: 'Stock item deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
