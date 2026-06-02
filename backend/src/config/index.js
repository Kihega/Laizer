// SMSS — Central config
require('dotenv').config();

function required(key) {
  const val = process.env[key];
  if (!val && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val || '';
}

const cfg = {
  // ── Server ────────────────────────────────────────────────────
  nodeEnv:      process.env.NODE_ENV || 'development',
  port:         parseInt(process.env.PORT || '8000', 10),
  isProduction: process.env.NODE_ENV === 'production',
  isTest:       process.env.NODE_ENV === 'test',

  // ── JWT ───────────────────────────────────────────────────────
  jwt: {
    secret:          process.env.SECRET_KEY || process.env.JWT_SECRET || 'dev-secret-CHANGE-ME',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN  || '60m',
    refreshExpiresIn:process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // ── CORS ──────────────────────────────────────────────────────
  corsOrigins: (() => {
    const origins = (
      process.env.CORS_ALLOWED_ORIGINS ||
      'http://localhost:8081,http://localhost:19006,exp://localhost:19000'
    ).split(',').map(o => o.trim()).filter(Boolean);

    if (process.env.NODE_ENV === 'development') {
      // Allow physical devices on LAN
      origins.push(/^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/);
    }
    return origins;
  })(),

  // ── Auth policy ───────────────────────────────────────────────
  auth: {
    ownerLoginRateMax: parseInt(process.env.OWNER_LOGIN_RATE_MAX || '20', 10),
  },

  // ── Redis ─────────────────────────────────────────────────────
  redisUrl: process.env.REDIS_URL || null,

  // ── Push notifications ────────────────────────────────────────
  expoPushUrl: 'https://exp.host/--/api/v2/push/send',

  // ── Service event edit window (ms) ────────────────────────────
  serviceEditWindowMs: 60 * 60 * 1000, // 60 minutes
};

if (cfg.isProduction) {
  required('SECRET_KEY');
  required('DATABASE_URL');
  // REDIS_URL no longer required — in-process cache is used instead.
  required('CORS_ALLOWED_ORIGINS');
}

module.exports = cfg;
