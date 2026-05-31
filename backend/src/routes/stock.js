/**
 * SMSS — Stock routes
 *
 * GET    /api/stock/      — worker: their centre; owner: all centres (query ?centreId=)
 * POST   /api/stock/      — worker: register item
 * PATCH  /api/stock/:id/  — worker: update item
 * DELETE /api/stock/:id/  — worker: delete item
 */
const { Router }                    = require('express');
const { z }                         = require('zod');
const prisma                        = require('../lib/prisma');
const redis                         = require('../lib/redis');
const logAction                     = require('../lib/audit');
const { authenticate, ownerOnly, workerOnly } = require('../middleware/auth');

const router = Router();
router.use(authenticate);

// ── GET /api/stock/ ───────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    if (req.user.role === 'worker') {
      const centreId = req.user.centreId;
      const cacheKey = redis.CacheKey.stock(centreId);
      let   items    = await redis.cacheGet(cacheKey);

      if (!items) {
        items = await prisma.stockItem.findMany({
          where:   { centreId },
          orderBy: { itemName: 'asc' },
        });
        await redis.cacheSet(cacheKey, items, redis.CacheTTL.STOCK);
      }
      return res.json(items);
    }

    // Owner: filter by centreId query param or return all their centres' stock
    if (req.user.role === 'owner') {
      const ownerId   = req.user.id;
      const centreId  = req.query.centreId;

      // Verify centreId belongs to owner if provided
      if (centreId) {
        const centre = await prisma.centre.findFirst({ where: { id: centreId, ownerId } });
        if (!centre) return res.status(404).json({ error: 'not_found', detail: 'Centre not found.' });

        const items = await prisma.stockItem.findMany({
          where: { centreId }, orderBy: { itemName: 'asc' },
        });
        return res.json(items);
      }

      // All centres
      const centres = await prisma.centre.findMany({ where: { ownerId, isActive: true }, select: { id: true } });
      const items   = await prisma.stockItem.findMany({
        where:   { centreId: { in: centres.map(c => c.id) } },
        include: { centre: { select: { id:true, name:true, centreNo:true } } },
        orderBy: [{ centre: { name: 'asc' } }, { itemName: 'asc' }],
      });
      return res.json(items);
    }
  } catch (err) { next(err); }
});

// ── POST /api/stock/ ──────────────────────────────────────────────────────────
const CreateStockSchema = z.object({
  itemName:           z.string().min(1),
  quantity:           z.number().min(0),
  unit:               z.enum(['pcs', 'boxes']),
  netStockPriceTshs:  z.number().min(0),
  notes:              z.string().optional(),
});

router.post('/', workerOnly, async (req, res, next) => {
  try {
    const parsed = CreateStockSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const item = await prisma.stockItem.create({
      data: {
        ...parsed.data,
        centreId:     req.user.centreId,
        registeredBy: req.user.id,
      },
    });

    await redis.cacheDel(redis.CacheKey.stock(req.user.centreId));
    await logAction(req.user.id, logAction.ACTIONS.STOCK_CREATED, { req, itemId: item.id });
    return res.status(201).json(item);
  } catch (err) { next(err); }
});

// ── PATCH /api/stock/:id/ ─────────────────────────────────────────────────────
const UpdateStockSchema = z.object({
  itemName:          z.string().min(1).optional(),
  quantity:          z.number().min(0).optional(),
  unit:              z.enum(['pcs', 'boxes']).optional(),
  netStockPriceTshs: z.number().min(0).optional(),
  notes:             z.string().optional(),
});

router.patch('/:id/', workerOnly, async (req, res, next) => {
  try {
    const parsed = UpdateStockSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const item = await prisma.stockItem.updateMany({
      where: { id: req.params.id, centreId: req.user.centreId },
      data:  parsed.data,
    });
    if (!item.count) return res.status(404).json({ error: 'not_found', detail: 'Stock item not found.' });

    await redis.cacheDel(redis.CacheKey.stock(req.user.centreId));
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

    await redis.cacheDel(redis.CacheKey.stock(req.user.centreId));
    await logAction(req.user.id, logAction.ACTIONS.STOCK_DELETED, { req, itemId: req.params.id });
    return res.json({ detail: 'Stock item deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
