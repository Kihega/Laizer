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
 * POST   /api/stock/:id/sell/ — worker: sell pieces {quantity, unitPriceTshs}; card deleted at 0;
 *                               recorded as a StockSale for the owner's report.
 * POST   /api/stock/:id/add/  — worker: add pieces {quantity} to an existing card.
 * PATCH  /api/stock/:id/      — worker: rename / set quantity (0 deletes the item)
 * DELETE /api/stock/:id/      — worker: delete item
 */
const { Router }                    = require('express');
const { z }                         = require('zod');
const prisma                        = require('../lib/prisma');
const redis                         = require('../lib/redis');
const logAction                     = require('../lib/audit');
const { dayKey }                    = require('../lib/dates');
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

// ── POST /api/stock/:id/sell/ ─────────────────────────────────────────────────
// __LAIZER_PATCH_V18__ — sell pieces at a price each. Stock goes down atomically,
// the card disappears at 0, and a StockSale row feeds the owner's day report.
const SellStockSchema = z.object({
  quantity:      z.number().int().min(1),
  unitPriceTshs: z.number().min(0).max(100000000),
});

router.post('/:id/sell/', workerOnly, async (req, res, next) => {
  try {
    const parsed = SellStockSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const { quantity, unitPriceTshs } = parsed.data;
    const centreId = req.user.centreId;
    const where = { id: req.params.id, centreId };

    const out = await prisma.$transaction(async tx => {
      const item = await tx.stockItem.findFirst({ where });
      if (!item) return { status: 404, body: { error: 'not_found', detail: 'Stock item not found.' } };

      // Atomic decrement — only succeeds if enough pieces are left.
      const dec = await tx.stockItem.updateMany({
        where: { ...where, quantity: { gte: quantity } },
        data:  { quantity: { decrement: quantity } },
      });
      if (!dec.count) {
        const cur = await tx.stockItem.findFirst({ where });
        return { status: 400, body: { error: 'insufficient_stock', detail: `Only ${Number(cur ? cur.quantity : 0)} pcs left in stock.` } };
      }

      const sale = await tx.stockSale.create({
        data: {
          centreId, stockItemId: item.id, itemName: item.itemName, quantity,
          unitPriceTshs, totalTshs: Math.round(quantity * unitPriceTshs * 100) / 100,
          soldBy: req.user.id,
        },
      });

      // Nothing left → the card disappears (the sale row keeps the item name).
      await tx.stockItem.deleteMany({ where: { ...where, quantity: { lte: 0 } } });
      const left = await tx.stockItem.findFirst({ where });
      return { status: 200, body: {
        remaining: left ? Number(left.quantity) : 0, removed: !left,
        sale: { id: sale.id, itemName: sale.itemName, quantity, unitPriceTshs, totalTshs: Number(sale.totalTshs) },
      } };
    });

    if (out.status !== 200) return res.status(out.status).json(out.body);

    await bustCaches(centreId);
    await redis.cacheDelPattern(`report:d:*:${dayKey()}`);
    await logAction(req.user.id, logAction.ACTIONS.STOCK_SOLD, { req, itemId: req.params.id, quantity, unitPriceTshs });
    return res.json(out.body);
  } catch (err) { next(err); }
});

// ── POST /api/stock/:id/add/ ──────────────────────────────────────────────────
// __LAIZER_PATCH_V18__ — add pieces to an existing card.
const AddStockSchema = z.object({ quantity: z.number().int().min(1).max(1000000) });

router.post('/:id/add/', workerOnly, async (req, res, next) => {
  try {
    const parsed = AddStockSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const { quantity } = parsed.data;
    const where = { id: req.params.id, centreId: req.user.centreId };

    const up = await prisma.stockItem.updateMany({ where, data: { quantity: { increment: quantity } } });
    if (!up.count) return res.status(404).json({ error: 'not_found', detail: 'Stock item not found.' });

    const item = await prisma.stockItem.findFirst({ where });
    await bustCaches(req.user.centreId);
    await logAction(req.user.id, logAction.ACTIONS.STOCK_ADDED, { req, itemId: req.params.id, quantity });
    return res.json({ id: req.params.id, quantity: item ? Number(item.quantity) : quantity, addedQuantity: quantity });
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
