// SMSS — Redis singleton (mirrors PayPark pattern)
// Lazy-connects. Falls back silently if REDIS_URL not set.
const cfg = require('../config');

let _client = null;

async function getClient() {
  if (!cfg.redisUrl) return null;
  if (_client?.isReady) return _client;
  const { createClient } = require('redis');
  _client = createClient({ url: cfg.redisUrl });
  _client.on('error', err => console.error('[Redis]', err.message));
  await _client.connect();
  console.log('[Redis] connected');
  return _client;
}

async function cacheGet(key) {
  try {
    const r = await getClient(); if (!r) return null;
    const v = await r.get(key);
    return v ? JSON.parse(v) : null;
  } catch (e) { console.error('[Redis] GET:', e.message); return null; }
}

async function cacheSet(key, value, ttlSeconds = 300) {
  try {
    const r = await getClient(); if (!r) return;
    await r.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (e) { console.error('[Redis] SET:', e.message); }
}

async function cacheDel(...keys) {
  try {
    const r = await getClient(); if (!r || !keys.length) return;
    await r.del(keys.flat());
  } catch (e) { console.error('[Redis] DEL:', e.message); }
}

async function cacheDelPattern(pattern) {
  try {
    const r = await getClient(); if (!r) return;
    const keys = await r.keys(pattern);
    if (keys.length) await r.del(keys);
  } catch (e) { console.error('[Redis] KEYS/DEL:', e.message); }
}

// ── Cache key builders ─────────────────────────────────────────────────────
const CacheKey = {
  user:         (id)        => `user:${id}`,
  centres:      (ownerId)   => `centres:${ownerId}`,
  workers:      (ownerId)   => `workers:${ownerId}`,
  centreWorkers:(centreId)  => `cworkers:${centreId}`,
  stock:        (centreId)  => `stock:${centreId}`,
  reportDaily:  (centreId, date) => `report:d:${centreId}:${date}`,
  reportWeekly: (centreId, ws)   => `report:w:${centreId}:${ws}`,
};

const CacheTTL = {
  USER:          300,   // 5 min
  CENTRES:       300,
  WORKERS:       300,
  STOCK:         120,   // 2 min — changes often
  REPORT_DAILY:  600,   // 10 min
  REPORT_WEEKLY: 1800,  // 30 min
};

module.exports = { getClient, cacheGet, cacheSet, cacheDel, cacheDelPattern, CacheKey, CacheTTL };
