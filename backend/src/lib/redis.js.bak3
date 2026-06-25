// Laizer — In-memory cache (replaces Redis)
//
// Provides the exact same API as the old redis.js so no other file needs
// changing.  Uses a plain JavaScript Map with TTL tracking.
//
// Why: Supabase already handles all persistence (DB, JWT blacklisting).
// A process-level cache is sufficient for the MVP — it reduces DB calls
// for hot paths (user profile, centre list) without any external service.
//
// Limitation: cache is lost on container restart (Render free tier sleeps).
// That is acceptable — a cache miss simply reads from Supabase and refills.
// For production scale, swap back to Redis by restoring the original module.

'use strict';

/** @type {Map<string, { value: any, expiresAt: number | null }>} */
const _store = new Map();

/** Evict expired entries every 5 minutes to avoid memory leaks. */
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _store.entries()) {
    if (v.expiresAt !== null && v.expiresAt < now) _store.delete(k);
  }
}, 5 * 60 * 1000).unref(); // .unref() so this timer never keeps the process alive

// ── Public API (mirrors redis.js) ─────────────────────────────────────────────

/** No external client — always returns null (signals 'cache disabled' to callers). */
async function getClient() { return null; }

async function cacheGet(key) {
  const entry = _store.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
    _store.delete(key);
    return null;
  }
  return entry.value;
}

async function cacheSet(key, value, ttlSeconds = 300) {
  _store.set(key, {
    value,
    expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
  });
}

/** Delete one or more exact keys. */
async function cacheDel(...keys) {
  for (const k of keys.flat()) _store.delete(k);
}

/** Delete all keys matching a glob pattern (e.g. 'user:*'). */
async function cacheDelPattern(pattern) {
  const regex = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  for (const k of _store.keys()) {
    if (regex.test(k)) _store.delete(k);
  }
}

// ── Cache key builders ────────────────────────────────────────────────────────
const CacheKey = {
  user:          (id)             => `user:${id}`,
  centres:       (ownerId)        => `centres:${ownerId}`,
  workers:       (ownerId)        => `workers:${ownerId}`,
  centreWorkers: (centreId)       => `cworkers:${centreId}`,
  stock:         (centreId)       => `stock:${centreId}`,
  reportDaily:   (centreId, date) => `report:d:${centreId}:${date}`,
  reportWeekly:  (centreId, ws)   => `report:w:${centreId}:${ws}`,
};

const CacheTTL = {
  USER:          300,
  CENTRES:       300,
  WORKERS:       300,
  STOCK:         120,
  REPORT_DAILY:  600,
  REPORT_WEEKLY: 1800,
};

module.exports = { getClient, cacheGet, cacheSet, cacheDel, cacheDelPattern, CacheKey, CacheTTL };
