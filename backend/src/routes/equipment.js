/**
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
