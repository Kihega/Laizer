/**
 * SMSS — Workers routes (owner only)
 *
 * GET    /api/workers/                  — list all workers
 * POST   /api/workers/                  — register worker
 * GET    /api/workers/:id/              — worker detail + current assignment
 * PATCH  /api/workers/:id/              — update worker profile
 * POST   /api/workers/:id/assign/       — assign to centre
 * POST   /api/workers/:id/transfer/     — transfer to another centre
 * DELETE /api/workers/:id/              — deactivate worker
 */
const { Router }       = require('express');
const { z }            = require('zod');
const prisma           = require('../lib/prisma');
const redis            = require('../lib/redis');
const logAction        = require('../lib/audit');
const { authenticate, ownerOnly } = require('../middleware/auth');

const router = Router();
router.use(authenticate, ownerOnly);

// Verify a centre belongs to this owner
async function ownCentre(centreId, ownerId) {
  return prisma.centre.findFirst({ where: { id: centreId, ownerId, isActive: true } });
}

// ── GET /api/workers/ ─────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const ownerId  = req.user.id;
    const cacheKey = redis.CacheKey.workers(ownerId);
    let workers    = await redis.cacheGet(cacheKey);

    if (!workers) {
      // Get all centres for this owner, then all workers assigned to those centres
      const centres = await prisma.centre.findMany({
        where:  { ownerId, isActive: true },
        select: { id: true },
      });
      const centreIds = centres.map(c => c.id);

      workers = await prisma.user.findMany({
        where: {
          role: 'worker',
          assignments: { some: { centreId: { in: centreIds } } },
        },
        include: {
          assignments: {
            where:   { isActive: true },
            include: { centre: { select: { id:true, name:true, centreNo:true } } },
            take: 1,
          },
        },
        orderBy: { createdAt: 'asc' },
      });
      await redis.cacheSet(cacheKey, workers, redis.CacheTTL.WORKERS);
    }
    return res.json(workers.map(w => ({
      id:           w.id,
      fullName:     w.fullName,
      nim:          w.nim,
      phone:        w.phone,
      isActive:     w.isActive,
      assignedCentre: w.assignments?.[0]?.centre || null,
    })));
  } catch (err) { next(err); }
});

// ── POST /api/workers/ ────────────────────────────────────────────────────────
const RegisterWorkerSchema = z.object({
  fullName: z.string().min(2),
  nim:      z.string().min(2).max(20),
  phone:    z.string().min(9).max(15),
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = RegisterWorkerSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const { fullName, nim, phone } = parsed.data;

    const exists = await prisma.user.findUnique({ where: { nim } });
    if (exists)
      return res.status(409).json({ error: 'duplicate', detail: 'A worker with this NIM already exists.' });

    const worker = await prisma.user.create({
      data: { fullName, nim, phone, role: 'worker' },
    });

    await redis.cacheDel(redis.CacheKey.workers(req.user.id));
    await logAction(req.user.id, logAction.ACTIONS.WORKER_REGISTERED, { req, workerId: worker.id });
    return res.status(201).json({ id: worker.id, fullName: worker.fullName, nim: worker.nim, phone: worker.phone });
  } catch (err) { next(err); }
});

// ── GET /api/workers/:id/ ─────────────────────────────────────────────────────
router.get('/:id/', async (req, res, next) => {
  try {
    const worker = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: {
          include: { centre: { select: { id:true, name:true, centreNo:true, location:true } } },
          orderBy: { assignedAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!worker || worker.role !== 'worker')
      return res.status(404).json({ error: 'not_found', detail: 'Worker not found.' });
    const { passwordHash: _, ...safe } = worker;
    return res.json(safe);
  } catch (err) { next(err); }
});

// ── PATCH /api/workers/:id/ ───────────────────────────────────────────────────
router.patch('/:id/', async (req, res, next) => {
  try {
    const { fullName, phone } = req.body;
    const worker = await prisma.user.update({
      where: { id: req.params.id },
      data:  { ...(fullName ? { fullName } : {}), ...(phone ? { phone } : {}) },
    });
    await redis.cacheDel(redis.CacheKey.user(worker.id), redis.CacheKey.workers(req.user.id));
    return res.json({ detail: 'Worker updated.' });
  } catch (err) { next(err); }
});

// ── POST /api/workers/:id/assign/ ─────────────────────────────────────────────
router.post('/:id/assign/', async (req, res, next) => {
  try {
    const { centreId } = req.body;
    if (!centreId) return res.status(400).json({ error: 'centreId required' });

    const centre = await ownCentre(centreId, req.user.id);
    if (!centre) return res.status(404).json({ error: 'not_found', detail: 'Centre not found.' });

    // Deactivate existing assignment
    await prisma.workerCentreAssignment.updateMany({
      where: { workerId: req.params.id, isActive: true },
      data:  { isActive: false },
    });

    const assignment = await prisma.workerCentreAssignment.create({
      data: { workerId: req.params.id, centreId: centre.id },
    });

    await redis.cacheDel(
      redis.CacheKey.workers(req.user.id),
      redis.CacheKey.centreWorkers(centre.id),
    );
    await logAction(req.user.id, logAction.ACTIONS.WORKER_ASSIGNED, { req, workerId: req.params.id, centreId });
    return res.status(201).json(assignment);
  } catch (err) { next(err); }
});

// ── POST /api/workers/:id/transfer/ ──────────────────────────────────────────
router.post('/:id/transfer/', async (req, res, next) => {
  try {
    const { centreId } = req.body;
    if (!centreId) return res.status(400).json({ error: 'centreId required' });

    const newCentre = await ownCentre(centreId, req.user.id);
    if (!newCentre) return res.status(404).json({ error: 'not_found', detail: 'Centre not found.' });

    // Find and close the current assignment
    const current = await prisma.workerCentreAssignment.findFirst({
      where: { workerId: req.params.id, isActive: true },
    });

    await prisma.$transaction([
      prisma.workerCentreAssignment.updateMany({
        where: { workerId: req.params.id, isActive: true },
        data:  { isActive: false },
      }),
      prisma.workerCentreAssignment.create({
        data: {
          workerId:        req.params.id,
          centreId:        newCentre.id,
          transferredFrom: current?.centreId || null,
        },
      }),
    ]);

    await redis.cacheDel(
      redis.CacheKey.workers(req.user.id),
      redis.CacheKey.centreWorkers(newCentre.id),
      ...(current ? [redis.CacheKey.centreWorkers(current.centreId)] : []),
    );
    await logAction(req.user.id, logAction.ACTIONS.WORKER_TRANSFERRED, { req, workerId: req.params.id });
    return res.json({ detail: 'Worker transferred successfully.' });
  } catch (err) { next(err); }
});

// ── DELETE /api/workers/:id/ ──────────────────────────────────────────────────
router.delete('/:id/', async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data:  { isActive: false },
    });
    await redis.cacheDel(redis.CacheKey.user(req.params.id), redis.CacheKey.workers(req.user.id));
    await logAction(req.user.id, logAction.ACTIONS.WORKER_DEACTIVATED, { req, workerId: req.params.id });
    return res.json({ detail: 'Worker deactivated.' });
  } catch (err) { next(err); }
});

module.exports = router;
