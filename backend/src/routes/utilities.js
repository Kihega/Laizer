/**
 * SMSS — Office utilities routes
 * __LAIZER_PATCH_V18__
 *
 * Each branch keeps a list of its office utilities (scanner, printer, laptop...).
 * Every utility gets an ID unique inside its branch — UTL-01, UTL-02, ... — that is
 * never reused, even after a utility is deleted.
 *
 * GET    /api/utilities/            — worker: their branch; owner: ?centreId= (required)
 * POST   /api/utilities/            — worker: add {name} → issues the next UTL-NN
 * PATCH  /api/utilities/:id/state/  — worker: {state: 'good' | 'defect'}
 * DELETE /api/utilities/:id/        — worker: remove a utility
 */
const { Router }                   = require('express');
const { z }                        = require('zod');
const prisma                       = require('../lib/prisma');
const logAction                    = require('../lib/audit');
const { authenticate, workerOnly } = require('../middleware/auth');

const router = Router();
router.use(authenticate);

const cleanName = s => s.replace(/\s+/g, ' ').trim();
const pad2      = n => String(n).padStart(2, '0');

const pub = u => ({
  id: u.id, code: u.code, name: u.name, state: u.state,
  createdAt: u.createdAt, updatedAt: u.updatedAt,
});

// ── GET /api/utilities/ ───────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    let centreId;
    if (req.user.role === 'worker') {
      centreId = req.user.centreId;
    } else if (req.user.role === 'owner') {
      if (!req.query.centreId)
        return res.status(400).json({ error: 'validation_error', detail: 'centreId is required.' });
      const centre = await prisma.centre.findFirst({
        where: { id: req.query.centreId, ownerId: req.user.id }, select: { id: true },
      });
      if (!centre) return res.status(404).json({ error: 'not_found', detail: 'Centre not found.' });
      centreId = centre.id;
    } else {
      return res.status(403).json({ error: 'forbidden', detail: 'Not allowed.' });
    }

    const items = await prisma.utility.findMany({ where: { centreId }, orderBy: { code: 'asc' } });
    return res.json(items.map(pub));
  } catch (err) { next(err); }
});

// ── POST /api/utilities/ ──────────────────────────────────────────────────────
const CreateSchema = z.object({
  name: z.string().min(1).max(80).transform(cleanName).refine(s => s.length > 0, 'Utility name required'),
});

router.post('/', workerOnly, async (req, res, next) => {
  try {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const centreId = req.user.centreId;

    // The counter is incremented atomically inside the transaction, so two workers
    // adding at the same moment can never receive the same number.
    const created = await prisma.$transaction(async tx => {
      const centre = await tx.centre.update({
        where: { id: centreId }, data: { utilitySeq: { increment: 1 } }, select: { utilitySeq: true },
      });
      return tx.utility.create({
        data: { centreId, code: `UTL-${pad2(centre.utilitySeq)}`, name: parsed.data.name, registeredBy: req.user.id },
      });
    });

    await logAction(req.user.id, logAction.ACTIONS.UTILITY_CREATED, { req, utilityId: created.id, code: created.code });
    return res.status(201).json(pub(created));
  } catch (err) { next(err); }
});

// ── PATCH /api/utilities/:id/state/ ───────────────────────────────────────────
const StateSchema = z.object({ state: z.enum(['good', 'defect']) });

router.patch('/:id/state/', workerOnly, async (req, res, next) => {
  try {
    const parsed = StateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const where = { id: req.params.id, centreId: req.user.centreId };
    const up = await prisma.utility.updateMany({ where, data: { state: parsed.data.state } });
    if (!up.count) return res.status(404).json({ error: 'not_found', detail: 'Utility not found.' });

    const item = await prisma.utility.findFirst({ where });
    await logAction(req.user.id, logAction.ACTIONS.UTILITY_UPDATED, { req, utilityId: req.params.id, state: parsed.data.state });
    return res.json(pub(item));
  } catch (err) { next(err); }
});

// ── DELETE /api/utilities/:id/ ────────────────────────────────────────────────
router.delete('/:id/', workerOnly, async (req, res, next) => {
  try {
    const gone = await prisma.utility.deleteMany({ where: { id: req.params.id, centreId: req.user.centreId } });
    if (!gone.count) return res.status(404).json({ error: 'not_found', detail: 'Utility not found.' });

    await logAction(req.user.id, logAction.ACTIONS.UTILITY_DELETED, { req, utilityId: req.params.id });
    return res.json({ detail: 'Utility deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
