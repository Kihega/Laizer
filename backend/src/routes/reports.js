/**
 * SMSS — Reports routes (owner only)
 * __LAIZER_PATCH_V16__ — daily reports only (no weekly report).
 *
 * GET    /api/reports/daily/   — today's (or ?date=) summary per centre  (?centreId= optional)
 * GET    /api/reports/days/    — one centre's daily report cards: its 7 most recent days that
 *                                have records, or all of them with ?all=1  (?centreId= required)
 * GET    /api/reports/detail/  — full report of one centre on one day    (?centreId=&date=)
 * DELETE /api/reports/day/     — delete every service record of one centre on one day
 */
const { Router }          = require('express');
const prisma              = require('../lib/prisma');
const redis               = require('../lib/redis');
const logAction           = require('../lib/audit');
const { dayKey, isDayKey, dayRange } = require('../lib/dates');
const { authenticate, ownerOnly } = require('../middleware/auth');

const router = Router();
router.use(authenticate, ownerOnly);

const round2 = n => Math.round(n * 100) / 100;

const bad = (res, detail) => res.status(400).json({ error: 'validation_error', detail });

// The owner's centre, or null.
const ownCentre = (ownerId, id, select) =>
  prisma.centre.findFirst({ where: { id, ownerId, isActive: true }, select });

// ── GET /api/reports/daily/ ───────────────────────────────────────────────────
router.get('/daily/', async (req, res, next) => {
  try {
    const ownerId  = req.user.id;
    const dateStr  = req.query.date || dayKey();
    const centreId = req.query.centreId;
    if (!isDayKey(dateStr)) return bad(res, 'date must be YYYY-MM-DD.');

    const { start, end } = dayRange(dateStr);

    const cacheKey = redis.CacheKey.reportDaily(centreId || ownerId, dateStr);
    let   report   = await redis.cacheGet(cacheKey);

    if (!report) {
      const centres = await prisma.centre.findMany({
        where: { ownerId, isActive: true, ...(centreId ? { id: centreId } : {}) },
        select: { id:true, name:true, centreNo:true, centreId:true },
      });

      report = await Promise.all(centres.map(async centre => {
        // Graceful fallback — a failed query shows 0 instead of breaking the whole list.
        let events = [];
        try {
          events = await prisma.serviceEvent.findMany({
            where:  { centreId: centre.id, createdAt: { gte: start, lt: end } },
            select: { serviceType:true, totalAmountTshs:true },
          });
        } catch (evtErr) {
          console.error(`[reports/daily] serviceEvent query failed for centre ${centre.id}:`, evtErr.message);
        }

        const totalRevenue = events.reduce((s, e) => s + Number(e.totalAmountTshs), 0);
        const byType = {};
        for (const e of events) byType[e.serviceType] = (byType[e.serviceType] || 0) + 1;
        const topService = Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        return {
          centre,
          date: dateStr,
          totalEvents:      events.length,
          totalRevenueTshs: round2(totalRevenue),
          byServiceType:    byType,
          topService,
        };
      }));

      await redis.cacheSet(cacheKey, report, redis.CacheTTL.REPORT_DAILY);
    }

    return res.json(report);
  } catch (err) { next(err); }
});

// ── GET /api/reports/days/ ────────────────────────────────────────────────────
// The cards on a centre's report list. Only days that HAVE records are listed:
// default = the 7 most recent of them (fewer if the branch has fewer),
// ?all=1 = every one (history). Days with no records never get a card.
router.get('/days/', async (req, res, next) => {
  try {
    const centreId = req.query.centreId;
    if (!centreId) return bad(res, 'centreId is required.');

    const centre = await ownCentre(req.user.id, centreId, { id:true, name:true, centreNo:true, centreId:true });
    if (!centre) return res.status(404).json({ error: 'not_found', detail: 'Centre not found.' });

    const all   = req.query.all === '1' || req.query.all === 'true';
    const today = dayKey();

    const events = await prisma.serviceEvent.findMany({
      where:  { centreId: centre.id },
      select: { totalAmountTshs: true, createdAt: true },
    });

    const byDay = {};
    for (const e of events) {
      const k = dayKey(e.createdAt);
      const d = byDay[k] || (byDay[k] = { date: k, totalEvents: 0, totalRevenueTshs: 0 });
      d.totalEvents += 1;
      d.totalRevenueTshs += Number(e.totalAmountTshs);
    }
    for (const d of Object.values(byDay)) d.totalRevenueTshs = round2(d.totalRevenueTshs);

    const newestFirst = Object.values(byDay).sort((a, b) => (a.date < b.date ? 1 : -1));
    const days = all ? newestFirst : newestFirst.slice(0, 7);

    return res.json({ centre, today, all, days });
  } catch (err) { next(err); }
});

// ── GET /api/reports/detail/ ─────────────────────────────────────────────────
// Full report of one centre on one day: every service record plus (for today
// only — stock has no history) the stock on hand.
router.get('/detail/', async (req, res, next) => {
  try {
    const centreId = req.query.centreId;
    const date     = req.query.date || dayKey();
    if (!centreId)        return bad(res, 'centreId is required.');
    if (!isDayKey(date))  return bad(res, 'date must be YYYY-MM-DD.');

    const centre = await ownCentre(req.user.id, centreId,
      { id:true, name:true, centreNo:true, centreId:true, location:true });
    if (!centre) return res.status(404).json({ error: 'not_found', detail: 'Centre not found.' });

    const { start, end } = dayRange(date);
    const isToday = date === dayKey();

    let events = [];
    try {
      events = await prisma.serviceEvent.findMany({
        where:  { centreId: centre.id, createdAt: { gte: start, lt: end } },
        select: { id:true, serviceType:true, serviceSubtype:true, pages:true,
                  pricePerPageTshs:true, totalAmountTshs:true, createdAt:true,
                  worker: { select: { fullName:true } } },
        orderBy: { createdAt: 'asc' },
      });
    } catch (e) {
      console.error('[reports/detail] serviceEvent error:', e.message);
    }

    let stock = [];
    if (isToday) {
      try {
        stock = await prisma.stockItem.findMany({
          where:   { centreId: centre.id, quantity: { gt: 0 } },
          select:  { itemName:true, quantity:true, unit:true },
          orderBy: { itemName: 'asc' },
        });
      } catch (e) {
        console.error('[reports/detail] stock error:', e.message);
      }
    }

    const byType = {};
    for (const e of events) byType[e.serviceType] = (byType[e.serviceType] || 0) + 1;

    return res.json({
      centre,
      date,
      isToday,
      totalEvents:      events.length,
      totalRevenueTshs: round2(events.reduce((s, e) => s + Number(e.totalAmountTshs), 0)),
      byServiceType:    byType,
      events,
      stock,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

// ── DELETE /api/reports/day/ ─────────────────────────────────────────────────
// Deletes the day's report = every service record the workers entered that day.
router.delete('/day/', async (req, res, next) => {
  try {
    const { centreId, date } = req.query;
    if (!centreId)       return bad(res, 'centreId is required.');
    if (!isDayKey(date)) return bad(res, 'date must be YYYY-MM-DD.');

    const centre = await ownCentre(req.user.id, centreId, { id: true });
    if (!centre) return res.status(404).json({ error: 'not_found', detail: 'Centre not found.' });

    const { start, end } = dayRange(date);
    const gone = await prisma.serviceEvent.deleteMany({
      where: { centreId: centre.id, createdAt: { gte: start, lt: end } },
    });

    await redis.cacheDelPattern(`report:d:*:${date}`);
    await logAction(req.user.id, logAction.ACTIONS.REPORT_DELETED, { req, centreId: centre.id, date, deleted: gone.count });
    return res.json({ detail: 'Report deleted.', date, deleted: gone.count });
  } catch (err) { next(err); }
});

module.exports = router;
