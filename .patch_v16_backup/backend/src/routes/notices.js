/**
 * SMSS — Notices routes
 * __LAIZER_PATCH_V12__ — notices no longer expire or auto-delete. A worker
 * removes a notice from THEIR list with DELETE (stored as NoticeRead.deletedAt),
 * so other workers at the same centre, and the owner's sent list, are unaffected.
 *
 * GET    /api/notices/          — worker: inbox for their centre; owner: sent notices
 * POST   /api/notices/          — owner: send notice (triggers push notifications)
 * POST   /api/notices/:id/read/ — worker: mark as read
 * DELETE /api/notices/:id/      — worker: delete from my list; owner: delete the notice for everyone
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
    if (req.user.role === 'worker') {
      const workerId = req.user.id;
      const notices = await prisma.notice.findMany({
        where: {
          centreId: req.user.centreId,
          // hide only the notices THIS worker deleted
          NOT: { reads: { some: { workerId, deletedAt: { not: null } } } },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id:true, fullName:true } },
          reads:  { where: { workerId }, select: { readAt:true } },
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
      try {
        const notices = await prisma.notice.findMany({
          where:   { centreId: { in: centres.map(c => c.id) } },
          orderBy: { createdAt: 'desc' },
          take:    100,
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
    const notice = await prisma.notice.create({
      data: {
        centreId: parsed.data.centreId,
        body:     parsed.data.body,
        priority: parsed.data.priority ?? 'normal',
        title,
        senderId: req.user.id,
      },
    });

    // Fire-and-forget push notification to all workers of the centre
    notifyWorkers(
      centre.id,
      `📢 ${notice.title}`,
      notice.body,
      { noticeId: notice.id }
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

// ── DELETE /api/notices/:id/ ──────────────────────────────────────────────────
router.delete('/:id/', async (req, res, next) => {
  try {
    // Owner: remove the notice completely (its read-receipts cascade).
    if (req.user.role === 'owner') {
      const mine = await prisma.notice.findFirst({
        where:  { id: req.params.id, centre: { ownerId: req.user.id } },
        select: { id: true },
      });
      if (!mine) return res.status(404).json({ error: 'not_found', detail: 'Notice not found.' });
      await prisma.notice.delete({ where: { id: mine.id } });
      await logAction(req.user.id, logAction.ACTIONS.NOTICE_DELETED, { req, noticeId: mine.id });
      return res.json({ detail: 'Notice deleted.' });
    }
    if (req.user.role !== 'worker')
      return res.status(403).json({ error: 'forbidden', detail: 'Not allowed.' });

    // Worker: hide it from this worker's list only.
    const notice = await prisma.notice.findFirst({
      where:  { id: req.params.id, centreId: req.user.centreId },
      select: { id: true },
    });
    if (!notice) return res.status(404).json({ error: 'not_found', detail: 'Notice not found.' });

    const now = new Date();
    await prisma.noticeRead.upsert({
      where:  { noticeId_workerId: { noticeId: notice.id, workerId: req.user.id } },
      create: { noticeId: notice.id, workerId: req.user.id, deletedAt: now },
      update: { deletedAt: now },
    });
    await logAction(req.user.id, logAction.ACTIONS.NOTICE_DELETED, { req, noticeId: notice.id });
    return res.json({ detail: 'Notice deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
