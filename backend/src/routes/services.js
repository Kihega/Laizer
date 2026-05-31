/**
 * SMSS — Service Event routes
 *
 * GET    /api/services/      — worker: today at centre; owner: all (filter by ?centreId= &date=)
 * POST   /api/services/      — worker: log event (total computed server-side)
 * PATCH  /api/services/:id/  — worker: edit within 60 min
 * DELETE /api/services/:id/  — worker: delete within 60 min
 */
const { Router }          = require('express');
const { z }               = require('zod');
const prisma              = require('../lib/prisma');
const logAction           = require('../lib/audit');
const cfg                 = require('../config');
const { authenticate, workerOnly } = require('../middleware/auth');

const router = Router();
router.use(authenticate);

const SERVICE_TYPES = ['photocopy', 'printing', 'lamination', 'scanning', 'designing', 'other'];
const SUBTYPES      = ['black_and_white', 'colour'];

// ── GET /api/services/ ────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    if (req.user.role === 'worker') {
      const centreId   = req.user.centreId;
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const events = await prisma.serviceEvent.findMany({
        where:   { centreId, createdAt: { gte: startOfDay } },
        orderBy: { createdAt: 'desc' },
        include: { worker: { select: { id:true, fullName:true } } },
      });
      return res.json(events);
    }

    // Owner: filter by centreId + date
    if (req.user.role === 'owner') {
      const ownerId = req.user.id;
      const dateStr = req.query.date;   // YYYY-MM-DD, default today
      const filterCentreId = req.query.centreId;
      const filterType     = req.query.type;

      const date = dateStr ? new Date(dateStr) : new Date();
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const centres = await prisma.centre.findMany({
        where:  { ownerId, isActive: true, ...(filterCentreId ? { id: filterCentreId } : {}) },
        select: { id: true },
      });
      const centreIds = centres.map(c => c.id);

      const events = await prisma.serviceEvent.findMany({
        where: {
          centreId:    { in: centreIds },
          createdAt:   { gte: date, lt: nextDay },
          ...(filterType ? { serviceType: filterType } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          centre: { select: { id:true, name:true, centreNo:true } },
          worker: { select: { id:true, fullName:true } },
        },
      });
      return res.json(events);
    }
  } catch (err) { next(err); }
});

// ── POST /api/services/ ───────────────────────────────────────────────────────
const CreateServiceSchema = z.object({
  serviceType:      z.enum(SERVICE_TYPES),
  serviceSubtype:   z.enum(SUBTYPES).optional(),
  category:         z.string().optional(),
  pages:            z.number().int().min(1).optional(),
  pricePerPageTshs: z.number().min(0).optional(),
  customerNote:     z.string().optional(),
});

router.post('/', workerOnly, async (req, res, next) => {
  try {
    const parsed = CreateServiceSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const { pages, pricePerPageTshs, ...rest } = parsed.data;

    // Server-side total calculation — never trust client total
    const totalAmountTshs = (pages && pricePerPageTshs)
      ? Math.round(pages * pricePerPageTshs * 100) / 100
      : 0;

    const event = await prisma.serviceEvent.create({
      data: {
        ...rest,
        pages,
        pricePerPageTshs,
        totalAmountTshs,
        centreId: req.user.centreId,
        workerId: req.user.id,
      },
    });

    await logAction(req.user.id, logAction.ACTIONS.SERVICE_LOGGED, { req, eventId: event.id });
    return res.status(201).json(event);
  } catch (err) { next(err); }
});

// ── PATCH /api/services/:id/ ──────────────────────────────────────────────────
router.patch('/:id/', workerOnly, async (req, res, next) => {
  try {
    const existing = await prisma.serviceEvent.findFirst({
      where: { id: req.params.id, workerId: req.user.id },
    });
    if (!existing)
      return res.status(404).json({ error: 'not_found', detail: 'Service event not found.' });

    const ageMs = Date.now() - new Date(existing.createdAt).getTime();
    if (ageMs > cfg.serviceEditWindowMs)
      return res.status(403).json({ error: 'edit_window_expired', detail: 'Events can only be edited within 60 minutes of logging.' });

    const parsed = CreateServiceSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const { pages, pricePerPageTshs, ...rest } = parsed.data;
    const newPages = pages          ?? Number(existing.pages);
    const newPrice = pricePerPageTshs ?? Number(existing.pricePerPageTshs);
    const totalAmountTshs = (newPages && newPrice)
      ? Math.round(newPages * newPrice * 100) / 100
      : Number(existing.totalAmountTshs);

    const updated = await prisma.serviceEvent.update({
      where: { id: req.params.id },
      data:  { ...rest, pages: newPages, pricePerPageTshs: newPrice, totalAmountTshs },
    });

    await logAction(req.user.id, logAction.ACTIONS.SERVICE_EDITED, { req, eventId: req.params.id });
    return res.json(updated);
  } catch (err) { next(err); }
});

// ── DELETE /api/services/:id/ ─────────────────────────────────────────────────
router.delete('/:id/', workerOnly, async (req, res, next) => {
  try {
    const existing = await prisma.serviceEvent.findFirst({
      where: { id: req.params.id, workerId: req.user.id },
    });
    if (!existing)
      return res.status(404).json({ error: 'not_found', detail: 'Service event not found.' });

    const ageMs = Date.now() - new Date(existing.createdAt).getTime();
    if (ageMs > cfg.serviceEditWindowMs)
      return res.status(403).json({ error: 'edit_window_expired', detail: 'Events can only be deleted within 60 minutes.' });

    await prisma.serviceEvent.delete({ where: { id: req.params.id } });
    await logAction(req.user.id, logAction.ACTIONS.SERVICE_DELETED, { req, eventId: req.params.id });
    return res.json({ detail: 'Service event deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
