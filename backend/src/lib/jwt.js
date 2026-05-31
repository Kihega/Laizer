// SMSS — JWT helpers
// Access tokens:  short-lived (60 min), embed role + centreId for fast checks.
// Refresh tokens: long-lived (7 days), include jti (UUID) for blacklisting.
const jwt             = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const cfg             = require('../config');
const prisma          = require('./prisma');

/**
 * Sign an access token.
 * @param {object} user   { id, fullName, role, centreId? }
 * @returns {string}
 */
function signAccess(user) {
  return jwt.sign(
    {
      sub:      String(user.id),
      fullName: user.fullName,
      role:     user.role,
      ...(user.centreId ? { centreId: user.centreId } : {}),
    },
    cfg.jwt.secret,
    { expiresIn: cfg.jwt.accessExpiresIn },
  );
}

/**
 * Sign a refresh token.
 * @param {object} user
 * @returns {{ token: string, jti: string }}
 */
function signRefresh(user) {
  const jti = uuidv4();
  const token = jwt.sign(
    { sub: String(user.id), jti },
    cfg.jwt.secret,
    { expiresIn: cfg.jwt.refreshExpiresIn },
  );
  return { token, jti };
}

/** Verify any token — throws on failure. */
function verify(token) {
  return jwt.verify(token, cfg.jwt.secret);
}

/** Blacklist a refresh token jti in DB. */
async function blacklist(jti, expiresAt) {
  await prisma.blacklistedToken.create({
    data: { jti, expiresAt: new Date(expiresAt * 1000) },
  });
}

/** Returns true if jti is blacklisted. */
async function isBlacklisted(jti) {
  const found = await prisma.blacklistedToken.findUnique({ where: { jti } });
  return Boolean(found);
}

module.exports = { signAccess, signRefresh, verify, blacklist, isBlacklisted };
