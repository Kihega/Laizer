// Laizer — Global Express error handler
// Never leaks raw Prisma objects or stack traces to the client.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (process.env.NODE_ENV !== 'production') console.error('[Error]', err.message);

  // ── Prisma unique constraint ──────────────────────────────────────────────
  if (err.code === 'P2002') {
    return res.status(409).json({
      error:  'conflict',
      detail: 'A record with this value already exists.',
    });
  }

  // ── Prisma not found ──────────────────────────────────────────────────────
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'not_found', detail: 'Record not found.' });
  }

  // ── DB unreachable (P1001 / ECONNREFUSED) ─────────────────────────────────
  if (
    err.code === 'P1001' ||
    err.message?.includes('ECONNREFUSED') ||
    err.message?.includes("Can't reach database")
  ) {
    return res.status(503).json({
      error:  'database_unavailable',
      detail: 'Cannot reach the database. Check your connection and try again.',
    });
  }

  // ── PgBouncer prepared-statement conflict (42P05) ─────────────────────────
  // Should not happen after the prisma.js pgbouncer fix, but kept as fallback.
  if (
    err.message?.includes('42P05') ||
    err.message?.includes('prepared statement') ||
    err.message?.includes('already exists')
  ) {
    return res.status(503).json({
      error:  'database_busy',
      detail: 'Database connection issue. Please try again in a moment.',
    });
  }

  // ── Validation / request size ─────────────────────────────────────────────
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error:  'payload_too_large',
      detail: 'Request is too large. Please compress your image and try again.',
    });
  }

  // ── JWT errors ────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'invalid_token', detail: 'Session expired. Please sign in again.' });
  }

  // ── Generic server error — never leak internals ───────────────────────────
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    return res.status(500).json({
      error:  'server_error',
      detail: 'An unexpected error occurred. Please try again.',
    });
  }

  res.status(status).json({ error: err.code || 'error', detail: err.message });
}

module.exports = errorHandler;
