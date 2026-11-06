/**
 * SMSS — Workers routes (owner only)
 *
 * GET    /api/workers/                  — list all workers
 * POST   /api/workers/                  — register worker
 * GET    /api/workers/:id/              — worker detail + current assignment
 * PATCH  /api/workers/:id/              — update worker profile
 * PATCH  /api/workers/:id/password/     — set / reset the worker's password
 * POST   /api/workers/:id/assign/       — assign to centre
 * POST   /api/workers/:id/transfer/     — transfer to another centre
 * DELETE /api/workers/:id/              — delete worker (branch records are kept)
 */
const { Router }       = require('express');
const bcrypt           = require('bcryptjs');
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

// __LAIZER_PATCH_V9__
// Generate a globally-unique, worker-facing login code. Independent of
// Centre ID numbering (which is now scoped per-owner) — this is what lets
// the login endpoint tell workers of different owners apart even when
// their Centre IDs collide (e.g. two owners both having a "STN-01").
async function generateWorkerCode() {
  for (let i = 0; i < 50; i++) {
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const candidate = `WK-${rand}`;
    const exists = await prisma.user.findUnique({ where: { workerCode: candidate } });
    if (!exists) return candidate;
  }
  // Extremely unlikely fallback — still unique-checked by the DB constraint.
  return `WK-${Date.now().toString(36).toUpperCase().slice(-6)}`;
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
      workerCode:   w.workerCode,
      isActive:     w.isActive,
      hasPassword:  !!w.passwordHash,
      assignedCentre: w.assignments?.[0]?.centre || null,
    })));
  } catch (err) { next(err); }
});

// ── POST /api/workers/ ────────────────────────────────────────────────────────
const RegisterWorkerSchema = z.object({
  fullName: z.string().min(2).transform(s => s.trim().toUpperCase()),
  phone:    z.string().min(7).max(20),
  password: z.string().min(6, 'Password must be at least 6 characters').max(72), // __LAIZER_PATCH_V18__
  centreId: z.string().optional(),
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = RegisterWorkerSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const { fullName, phone, password, centreId } = parsed.data;

    // Phone uniqueness (workers identified by phone)
    const exists = await prisma.user.findUnique({ where: { phone } });
    if (exists)
      return res.status(409).json({ error: 'duplicate', detail: 'A worker with this phone number already exists.' });

    const worker = await prisma.user.create({
      data: { fullName, phone, role: 'worker', workerCode: await generateWorkerCode(),
              passwordHash: await bcrypt.hash(password, 10) },
    });

    // If centreId provided, assign immediately
    if (centreId) {
      const centre = await ownCentre(centreId, req.user.id);
      if (centre) {
        await prisma.workerCentreAssignment.create({
          data: { workerId: worker.id, centreId: centre.id },
        });
      }
    }

    await redis.cacheDel(redis.CacheKey.workers(req.user.id));
    await logAction(req.user.id, logAction.ACTIONS.WORKER_REGISTERED, { req, workerId: worker.id });
    return res.status(201).json({
      id: worker.id, fullName: worker.fullName, phone: worker.phone,
      workerCode: worker.workerCode, // give this to the worker for login
    });
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

// ── PATCH /api/workers/:id/password/ ─────────────────────────────────────────
// __LAIZER_PATCH_V18__ — owner sets / resets a worker's login password (also how
// workers registered before passwords existed get one).
const SetPasswordSchema = z.object({ password: z.string().min(6, 'Password must be at least 6 characters').max(72) });

router.patch('/:id/password/', async (req, res, next) => {
  try {
    const parsed = SetPasswordSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    // Only a worker assigned (now or before) to one of THIS owner's centres.
    const owned = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'worker',
               assignments: { some: { centre: { ownerId: req.user.id } } } },
      select: { id: true },
    });
    if (!owned) return res.status(404).json({ error: 'not_found', detail: 'Worker not found.' });

    await prisma.user.update({
      where: { id: owned.id },
      data:  { passwordHash: await bcrypt.hash(parsed.data.password, 10) },
    });
    await redis.cacheDel(redis.CacheKey.workers(req.user.id));
    await logAction(req.user.id, logAction.ACTIONS.WORKER_PASSWORD_SET, { req, workerId: owned.id });
    return res.json({ detail: 'Password updated.' });
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
// __LAIZER_PATCH_V19__ — really deletes the worker (login, assignments, push tokens,
// read marks). The branch's records are kept: each service record keeps the worker's
// name as plain text (workerName) and its worker link is cleared.
router.delete('/:id/', async (req, res, next) => {
  try {
    const worker = await prisma.user.findFirst({
      where: {
        id: req.params.id, role: 'worker',
        OR: [
          { assignments: { some: { centre: { ownerId: req.user.id } } } },
          { assignments: { none: {} } },
        ],
      },
      select: { id: true, fullName: true, assignments: { select: { centreId: true } } },
    });
    if (!worker) return res.status(404).json({ error: 'not_found', detail: 'Worker not found.' });

    await prisma.$transaction([
      prisma.serviceEvent.updateMany({ where: { workerId: worker.id }, data: { workerName: worker.fullName } }),
      prisma.user.delete({ where: { id: worker.id } }),
    ]);

    await redis.cacheDel(
      redis.CacheKey.user(worker.id), redis.CacheKey.workers(req.user.id),
      ...worker.assignments.map(a => redis.CacheKey.centreWorkers(a.centreId)),
    );
    await redis.cacheDelPattern('report:d:*');
    await logAction(req.user.id, logAction.ACTIONS.WORKER_DELETED, { req, workerId: worker.id, name: worker.fullName });
    return res.json({ detail: 'Worker deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
