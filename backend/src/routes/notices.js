/**
 * SMSS — Notices routes
 *
 * GET  /api/notices/         — worker: inbox for their centre; owner: sent notices
 * POST /api/notices/         — owner: send notice (triggers push notifications)
 * POST /api/notices/:id/read/— worker: mark as read
 */
const { Router }          = require('express');
const { z }               = require('zod');
const prisma              = require('../lib/prisma');
const logAction           = require('../lib/audit');
const { notifyWorkers }   = require('../lib/push');
const { authenticate, ownerOnly, workerOnly } = require('../middleware/auth');

const router = Router();
router.use(authenticate);

// ── GET /api/notices/ ─────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    // __LAIZER_PATCH_V11__ — belt-and-braces cleanup: hard-delete anything past
    // its expiry before answering, so this is correct immediately even if
    // the periodic sweep in app.js hasn't run yet (e.g. server just woke
    // up from a free-tier sleep).
    await prisma.notice.deleteMany({ where: { expiresAt: { lte: new Date() } } });

    if (req.user.role === 'worker') {
      const nowFilter = new Date();
      const notices = await prisma.notice.findMany({
        where:   { centreId: req.user.centreId,
                   OR: [{ expiresAt: null }, { expiresAt: { gt: nowFilter } }] },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id:true, fullName:true } },
          reads:  { where: { workerId: req.user.id }, select: { readAt:true } },
        },
      });
      return res.json(notices.map(n => ({
        ...n,
        isRead: n.reads.length > 0,
        readAt: n.reads[0]?.readAt || null,
      })));
    }

    if (req.user.role === 'owner') {
      const centreId = req.query.centreId;
      const centres  = await prisma.centre.findMany({
        where:  { ownerId: req.user.id, isActive: true, ...(centreId ? { id: centreId } : {}) },
        select: { id: true },
      });
      const nowFilter2 = new Date();
      try {
        const notices = await prisma.notice.findMany({
          where:   { centreId: { in: centres.map(c => c.id) },
                     OR: [{ expiresAt: null }, { expiresAt: { gt: nowFilter2 } }] },
          orderBy: { createdAt: 'desc' },
          include: {
            centre: { select: { id:true, name:true, centreNo:true } },
            _count: { select: { reads: true } },
          },
        });
        return res.json(notices);
      } catch (prismaErr) {
        // Defensive fallback — never let a notices query error block the
        // owner's screen; an empty list is recoverable, a 500 is not.
        console.error('[Notices] owner GET query failed:', prismaErr.message);
        return res.json([]);
      }
    }
  } catch (err) { next(err); }
});

// ── POST /api/notices/ ────────────────────────────────────────────────────────
const SendNoticeSchema = z.object({
  centreId: z.string().uuid(),
  title:    z.string().max(100).optional(),
  body:     z.string().min(1).max(2000),
  priority: z.enum(['low', 'normal', 'urgent']).default('normal').optional(),
});

router.post('/', ownerOnly, async (req, res, next) => {
  try {
    const parsed = SendNoticeSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    // Verify centre belongs to owner
    const centre = await prisma.centre.findFirst({
      where: { id: parsed.data.centreId, ownerId: req.user.id, isActive: true },
    });
    if (!centre)
      return res.status(404).json({ error: 'not_found', detail: 'Centre not found.' });

    const body  = parsed.data.body;
    const title = parsed.data.title ?? (body.length > 60 ? body.substring(0,60)+'…' : body);
    // __LAIZER_PATCH_V11__ — a notice belongs to the day it was sent: it expires
    // at the next midnight, not a fixed 48h window, so the owner writes a
    // fresh one each day rather than yesterday's notice quietly carrying over.
    const expiresAt = new Date();
    expiresAt.setHours(24, 0, 0, 0); // rolls forward to tomorrow 00:00:00
    const notice = await prisma.notice.create({
      data: {
        centreId: parsed.data.centreId,
        body:     parsed.data.body,
        priority: parsed.data.priority ?? 'normal',
        title,
        senderId: req.user.id,
        expiresAt,
      },
    });

    // Fire-and-forget push notification to all workers of the centre
    notifyWorkers(
      centre.id,
      `📢 ${notice.title}`,
      notice.body,
      { noticeId: notice.id, priority: notice.priority }
    ).catch(e => console.error('[Notices] push failed:', e.message));

    await logAction(req.user.id, logAction.ACTIONS.NOTICE_SENT, { req, noticeId: notice.id });
    return res.status(201).json(notice);
  } catch (err) { next(err); }
});

// ── POST /api/notices/:id/read/ ───────────────────────────────────────────────
router.post('/:id/read/', workerOnly, async (req, res, next) => {
  try {
    await prisma.noticeRead.upsert({
      where:  { noticeId_workerId: { noticeId: req.params.id, workerId: req.user.id } },
      create: { noticeId: req.params.id, workerId: req.user.id },
      update: { readAt: new Date() },
    });
    await logAction(req.user.id, logAction.ACTIONS.NOTICE_READ, { req, noticeId: req.params.id });
    return res.json({ detail: 'Notice marked as read.' });
  } catch (err) { next(err); }
});

module.exports = router;
