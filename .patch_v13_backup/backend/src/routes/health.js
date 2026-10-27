// SMSS — Health check
const { Router } = require('express');
const prisma     = require('../lib/prisma');
const redis      = require('../lib/redis');

const router = Router();

router.get('/', async (_req, res) => {
  let db    = 'ok';
  let cache = 'ok';
  try { await prisma.$queryRaw`SELECT 1`; } catch { db = 'error'; }
  try {
    const r = await redis.getClient();
    if (!r) cache = 'disabled';
    else await r.ping();
  } catch { cache = 'error'; }

  const ok = db === 'ok';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    service: 'SMSS API', version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: db, redis: cache,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
