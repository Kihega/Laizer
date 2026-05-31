// SMSS — JWT auth middleware + role guards (Redis-cached user lookup)
const { verify } = require('../lib/jwt');
const prisma     = require('../lib/prisma');
const redis      = require('../lib/redis');

const USER_TTL = 300; // 5 min

/**
 * authenticate
 * Validates Bearer token, attaches full User row to req.user.
 * Reads from Redis cache first; falls back to Postgres.
 */
async function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: 'unauthorized', detail: 'No token provided.' });
  }

  try {
    const payload = verify(token);
    const userId  = payload.sub;

    // Try Redis cache first
    const cacheKey = redis.CacheKey.user(userId);
    let user = await redis.cacheGet(cacheKey);

    if (!user) {
      user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) await redis.cacheSet(cacheKey, user, USER_TTL);
    }

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'unauthorized', detail: 'Account not found or inactive.' });
    }

    // Attach decoded claims + full user row
    req.user = {
      ...user,
      centreId: payload.centreId || null,  // present for workers
      jti:      payload.jti,
    };
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'unauthorized', detail: 'Invalid or expired token.' });
  }
}

/** Only owners can access this route. */
function ownerOnly(req, res, next) {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({ error: 'forbidden', detail: 'Owner role required.' });
  }
  next();
}

/** Only workers can access this route. */
function workerOnly(req, res, next) {
  if (!req.user || req.user.role !== 'worker') {
    return res.status(403).json({ error: 'forbidden', detail: 'Worker role required.' });
  }
  next();
}

module.exports = { authenticate, ownerOnly, workerOnly };
