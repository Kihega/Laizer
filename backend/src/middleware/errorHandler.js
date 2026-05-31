// SMSS — Global Express error handler
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const code   = err.code   || 'server_error';
  const detail = err.message || 'An unexpected error occurred.';

  if (process.env.NODE_ENV !== 'production') console.error('[ErrorHandler]', err);

  // Prisma unique constraint
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'conflict', detail: 'A record with this value already exists.' });
  }
  // Prisma not found
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'not_found', detail: 'Record not found.' });
  }

  res.status(status).json({ error: code, detail });
}

module.exports = errorHandler;
