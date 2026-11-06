/**
 * SMSS — Reports routes (owner only)
 * __LAIZER_PATCH_V18__ — daily reports only. Owner-side deletes are soft (ownerDeletedAt).
 * Stock sales are part of the day report; utilities + stock on hand are shown for today.
 *
 * GET    /api/reports/daily/   — today's (or ?date=) summary per centre  (?centreId= optional)
 * GET    /api/reports/days/    — one centre's daily report cards: its 7 most recent days that
 *                                have records, or all of them with ?all=1  (?centreId= required)
 * GET    /api/reports/detail/  — full report of one centre on one day    (?centreId=&date=)
 * DELETE /api/reports/day/     — hide one past day's report from the OWNER only (workers keep
 *                                their records). Today's report cannot be deleted.
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
            where:  { centreId: centre.id, ownerDeletedAt: null, createdAt: { gte: start, lt: end } },
            select: { serviceType:true, totalAmountTshs:true },
          });
        } catch (evtErr) {
          console.error(`[reports/daily] serviceEvent query failed for centre ${centre.id}:`, evtErr.message);
        }

        let sales = [];
        try {
          sales = await prisma.stockSale.findMany({
            where:  { centreId: centre.id, ownerDeletedAt: null, createdAt: { gte: start, lt: end } },
            select: { totalTshs: true },
          });
        } catch (saleErr) {
          console.error(`[reports/daily] stockSale query failed for centre ${centre.id}:`, saleErr.message);
        }

        const totalRevenue = events.reduce((s, e) => s + Number(e.totalAmountTshs), 0)
                           + sales.reduce((s, x) => s + Number(x.totalTshs), 0);
        const byType = {};
        for (const e of events) byType[e.serviceType] = (byType[e.serviceType] || 0) + 1;
        const topService = Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        return {
          centre,
          date: dateStr,
          totalEvents:      events.length + sales.length,
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

    const [events, sales] = await Promise.all([
      prisma.serviceEvent.findMany({
        where:  { centreId: centre.id, ownerDeletedAt: null },
        select: { totalAmountTshs: true, createdAt: true },
      }),
      prisma.stockSale.findMany({
        where:  { centreId: centre.id, ownerDeletedAt: null },
        select: { totalTshs: true, createdAt: true },
      }),
    ]);

    const byDay = {};
    const bucket = k => byDay[k] || (byDay[k] = { date: k, totalEvents: 0, totalRevenueTshs: 0 });
    for (const e of events) {
      const d = bucket(dayKey(e.createdAt));
      d.totalEvents += 1;
      d.totalRevenueTshs += Number(e.totalAmountTshs);
    }
    for (const x of sales) {
      const d = bucket(dayKey(x.createdAt));
      d.totalEvents += 1;
      d.totalRevenueTshs += Number(x.totalTshs);
    }
    for (const d of Object.values(byDay)) d.totalRevenueTshs = round2(d.totalRevenueTshs);

    // Only days that actually have records get a card (no empty cards).
    const newestFirst = Object.values(byDay).filter(d => d.totalEvents > 0).sort((a, b) => (a.date < b.date ? 1 : -1));
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
        where:  { centreId: centre.id, ownerDeletedAt: null, createdAt: { gte: start, lt: end } },
        select: { id:true, serviceType:true, serviceSubtype:true, pages:true,
                  pricePerPageTshs:true, totalAmountTshs:true, createdAt:true, workerName:true,
                  worker: { select: { fullName:true } } },
        orderBy: { createdAt: 'asc' },
      });
    } catch (e) {
      console.error('[reports/detail] serviceEvent error:', e.message);
    }

    let sales = [];
    try {
      sales = await prisma.stockSale.findMany({
        where:   { centreId: centre.id, ownerDeletedAt: null, createdAt: { gte: start, lt: end } },
        select:  { id:true, itemName:true, quantity:true, unitPriceTshs:true, totalTshs:true, createdAt:true },
        orderBy: { createdAt: 'asc' },
      });
    } catch (e) {
      console.error('[reports/detail] stockSale error:', e.message);
    }

    let stock = [];
    let utilities = [];
    if (isToday) {
      try {
        utilities = await prisma.utility.findMany({
          where:   { centreId: centre.id },
          select:  { code:true, name:true, state:true },
          orderBy: { code: 'asc' },
        });
      } catch (e) {
        console.error('[reports/detail] utility error:', e.message);
      }
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
      totalEvents:      events.length + sales.length,
      servicesRevenueTshs: round2(events.reduce((s, e) => s + Number(e.totalAmountTshs), 0)),
      stockSalesTshs:      round2(sales.reduce((s, x) => s + Number(x.totalTshs), 0)),
      totalRevenueTshs: round2(events.reduce((s, e) => s + Number(e.totalAmountTshs), 0)
                             + sales.reduce((s, x) => s + Number(x.totalTshs), 0)),
      byServiceType:    byType,
      events,
      sales,
      stock,
      utilities,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

// ── DELETE /api/reports/day/ ─────────────────────────────────────────────────
// Hides one PAST day's report from the owner: the service records and stock sales
// of that day get ownerDeletedAt. Workers' own lists are untouched. Today's report
// can never be deleted.
router.delete('/day/', async (req, res, next) => {
  try {
    const { centreId, date } = req.query;
    if (!centreId)       return bad(res, 'centreId is required.');
    if (!isDayKey(date)) return bad(res, 'date must be YYYY-MM-DD.');
    if (date >= dayKey())
      return res.status(400).json({ error: 'today_not_deletable', detail: "Today's report cannot be deleted. Only previous days can." });

    const centre = await ownCentre(req.user.id, centreId, { id: true });
    if (!centre) return res.status(404).json({ error: 'not_found', detail: 'Centre not found.' });

    const { start, end } = dayRange(date);
    const where = { centreId: centre.id, ownerDeletedAt: null, createdAt: { gte: start, lt: end } };
    const now   = new Date();
    const [ev, sl] = await Promise.all([
      prisma.serviceEvent.updateMany({ where, data: { ownerDeletedAt: now } }),
      prisma.stockSale.updateMany({ where, data: { ownerDeletedAt: now } }),
    ]);

    await redis.cacheDelPattern(`report:d:*:${date}`);
    await logAction(req.user.id, logAction.ACTIONS.REPORT_DELETED, { req, centreId: centre.id, date, hidden: ev.count + sl.count });
    return res.json({ detail: 'Report deleted.', date, deleted: ev.count + sl.count });
  } catch (err) { next(err); }
});

module.exports = router;
