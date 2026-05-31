/**
 * SMSS — Centres routes (owner only)
 *
 * GET    /api/centres/           — list owner's active centres
 * POST   /api/centres/           — create centre
 * GET    /api/centres/:id/       — centre detail + active workers
 * PATCH  /api/centres/:id/       — update name/location
 * DELETE /api/centres/:id/       — deactivate (soft delete)
 */
const { Router }       = require('express');
const { z }            = require('zod');
const prisma           = require('../lib/prisma');
const redis            = require('../lib/redis');
const logAction        = require('../lib/audit');
const { authenticate, ownerOnly } = require('../middleware/auth');

const router = Router();
router.use(authenticate, ownerOnly);

// ── GET /api/centres/ ─────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const ownerId  = req.user.id;
    const cacheKey = redis.CacheKey.centres(ownerId);
    let centres    = await redis.cacheGet(cacheKey);

    if (!centres) {
      centres = await prisma.centre.findMany({
        where:   { ownerId, isActive: true },
        orderBy: { createdAt: 'asc' },
        include: {
          _count: { select: { assignments: { where: { isActive: true } } } },
        },
      });
      await redis.cacheSet(cacheKey, centres, redis.CacheTTL.CENTRES);
    }
    return res.json(centres);
  } catch (err) { next(err); }
});

// ── POST /api/centres/ ────────────────────────────────────────────────────────
const CreateCentreSchema = z.object({
  centreNo: z.string().min(2).max(20),
  centreId: z.string().min(2).max(50),
  name:     z.string().min(2),
  location: z.string().min(2),
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = CreateCentreSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const { centreNo, centreId, name, location } = parsed.data;
    const centre = await prisma.centre.create({
      data: { centreNo, centreId, name, location, ownerId: req.user.id },
    });

    await redis.cacheDel(redis.CacheKey.centres(req.user.id));
    await logAction(req.user.id, logAction.ACTIONS.CENTRE_CREATED, { req, centreId: centre.id });
    return res.status(201).json(centre);
  } catch (err) { next(err); }
});

// ── GET /api/centres/:id/ ─────────────────────────────────────────────────────
router.get('/:id/', async (req, res, next) => {
  try {
    const centre = await prisma.centre.findFirst({
      where:   { id: req.params.id, ownerId: req.user.id },
      include: {
        assignments: {
          where:   { isActive: true },
          include: { worker: { select: { id:true, fullName:true, nim:true, phone:true } } },
        },
      },
    });
    if (!centre) return res.status(404).json({ error: 'not_found', detail: 'Centre not found.' });
    return res.json(centre);
  } catch (err) { next(err); }
});

// ── PATCH /api/centres/:id/ ───────────────────────────────────────────────────
router.patch('/:id/', async (req, res, next) => {
  try {
    const { name, location } = req.body;
    const centre = await prisma.centre.updateMany({
      where: { id: req.params.id, ownerId: req.user.id },
      data:  { ...(name ? { name } : {}), ...(location ? { location } : {}) },
    });
    if (!centre.count) return res.status(404).json({ error: 'not_found', detail: 'Centre not found.' });
    await redis.cacheDel(redis.CacheKey.centres(req.user.id));
    return res.json({ detail: 'Centre updated.' });
  } catch (err) { next(err); }
});

// ── DELETE /api/centres/:id/ ──────────────────────────────────────────────────
router.delete('/:id/', async (req, res, next) => {
  try {
    const result = await prisma.centre.updateMany({
      where: { id: req.params.id, ownerId: req.user.id },
      data:  { isActive: false },
    });
    if (!result.count) return res.status(404).json({ error: 'not_found', detail: 'Centre not found.' });
    await redis.cacheDel(redis.CacheKey.centres(req.user.id));
    await logAction(req.user.id, logAction.ACTIONS.CENTRE_DEACTIVATED, { req, centreId: req.params.id });
    return res.json({ detail: 'Centre deactivated.' });
  } catch (err) { next(err); }
});

module.exports = router;
