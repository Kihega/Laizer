/**
 * SMSS — Reports routes (owner only)
 *
 * GET /api/reports/daily/   — daily summary per centre (?date=YYYY-MM-DD &centreId=)
 * GET /api/reports/weekly/  — weekly summary per centre (?weekStart=YYYY-MM-DD &centreId=)
 */
const { Router }          = require('express');
const prisma              = require('../lib/prisma');
const redis               = require('../lib/redis');
const { authenticate, ownerOnly } = require('../middleware/auth');

const router = Router();
router.use(authenticate, ownerOnly);

// ── GET /api/reports/daily/ ───────────────────────────────────────────────────
router.get('/daily/', async (req, res, next) => {
  try {
    const ownerId   = req.user.id;
    const dateStr   = req.query.date || new Date().toISOString().slice(0, 10);
    const centreId  = req.query.centreId;

    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const cacheKey = redis.CacheKey.reportDaily(centreId || ownerId, dateStr);
    let   report   = await redis.cacheGet(cacheKey);

    if (!report) {
      const centres = await prisma.centre.findMany({
        where: { ownerId, isActive: true, ...(centreId ? { id: centreId } : {}) },
        select: { id:true, name:true, centreNo:true },
      });

      report = await Promise.all(centres.map(async centre => {
        const events = await prisma.serviceEvent.findMany({
          where:  { centreId: centre.id, createdAt: { gte: date, lt: nextDay } },
          select: { serviceType:true, totalAmountTshs:true },
        });

        const totalEvents  = events.length;
        const totalRevenue = events.reduce((s, e) => s + Number(e.totalAmountTshs), 0);

        // Breakdown by service type
        const byType = {};
        for (const e of events) {
          byType[e.serviceType] = (byType[e.serviceType] || 0) + 1;
        }
        const topService = Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        return {
          centre,
          date: dateStr,
          totalEvents,
          totalRevenueTshs: Math.round(totalRevenue * 100) / 100,
          byServiceType: byType,
          topService,
        };
      }));

      await redis.cacheSet(cacheKey, report, redis.CacheTTL.REPORT_DAILY);
    }

    return res.json(report);
  } catch (err) { next(err); }
});

// ── GET /api/reports/weekly/ ──────────────────────────────────────────────────
router.get('/weekly/', async (req, res, next) => {
  try {
    const ownerId     = req.user.id;
    const centreId    = req.query.centreId;

    // weekStart defaults to the most recent Monday
    let weekStart;
    if (req.query.weekStart) {
      weekStart = new Date(req.query.weekStart);
    } else {
      weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    }
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const cacheKey     = redis.CacheKey.reportWeekly(centreId || ownerId, weekStartStr);
    let   report       = await redis.cacheGet(cacheKey);

    if (!report) {
      const centres = await prisma.centre.findMany({
        where:  { ownerId, isActive: true, ...(centreId ? { id: centreId } : {}) },
        select: { id:true, name:true, centreNo:true },
      });

      report = await Promise.all(centres.map(async centre => {
        const events = await prisma.serviceEvent.findMany({
          where:  { centreId: centre.id, createdAt: { gte: weekStart, lt: weekEnd } },
          select: { serviceType:true, totalAmountTshs:true, createdAt:true },
        });

        const totalEvents   = events.length;
        const totalRevenue  = events.reduce((s, e) => s + Number(e.totalAmountTshs), 0);

        // Group by day
        const byDay = {};
        for (const e of events) {
          const day = new Date(e.createdAt).toISOString().slice(0, 10);
          if (!byDay[day]) byDay[day] = { events: 0, revenue: 0 };
          byDay[day].events  += 1;
          byDay[day].revenue += Number(e.totalAmountTshs);
        }

        return {
          centre,
          weekStart: weekStartStr,
          weekEnd:   weekEnd.toISOString().slice(0, 10),
          totalEvents,
          totalRevenueTshs: Math.round(totalRevenue * 100) / 100,
          byDay,
        };
      }));

      await redis.cacheSet(cacheKey, report, redis.CacheTTL.REPORT_WEEKLY);
    }

    return res.json(report);
  } catch (err) { next(err); }
});

module.exports = router;
