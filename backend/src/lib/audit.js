// SMSS — Audit log helper
// Failures are intentionally swallowed — audit errors must never disrupt main flow.
const prisma = require('./prisma');

const ACTIONS = {
  OWNER_LOGIN_SUCCESS:   'OWNER_LOGIN_SUCCESS',
  OWNER_LOGIN_FAILURE:   'OWNER_LOGIN_FAILURE',
  WORKER_LOGIN_SUCCESS:  'WORKER_LOGIN_SUCCESS',
  WORKER_LOGIN_FAILURE:  'WORKER_LOGIN_FAILURE',
  LOGOUT:                'LOGOUT',
  TOKEN_REFRESH:         'TOKEN_REFRESH',
  CENTRE_CREATED:        'CENTRE_CREATED',
  CENTRE_UPDATED:        'CENTRE_UPDATED',
  CENTRE_DEACTIVATED:    'CENTRE_DEACTIVATED',
  WORKER_REGISTERED:     'WORKER_REGISTERED',
  WORKER_ASSIGNED:       'WORKER_ASSIGNED',
  WORKER_TRANSFERRED:    'WORKER_TRANSFERRED',
  WORKER_DEACTIVATED:    'WORKER_DEACTIVATED',
  STOCK_CREATED:         'STOCK_CREATED',
  STOCK_UPDATED:         'STOCK_UPDATED',
  STOCK_DELETED:         'STOCK_DELETED',
  SERVICE_LOGGED:        'SERVICE_LOGGED',
  SERVICE_EDITED:        'SERVICE_EDITED',
  SERVICE_DELETED:       'SERVICE_DELETED',
  NOTICE_SENT:           'NOTICE_SENT',
  NOTICE_READ:           'NOTICE_READ',
};

/**
 * Write an audit entry. userId may be null for anonymous events.
 */
async function logAction(userId, action, meta = {}) {
  try {
    const { req, ...extra } = meta;
    let ipAddress = null;
    let userAgent = '';
    if (req) {
      const fwd = req.headers['x-forwarded-for'];
      ipAddress = fwd ? fwd.split(',')[0].trim() : (req.ip || null);
      userAgent = String(req.headers['user-agent'] || '').slice(0, 300);
    }
    // Store as a generic JSON log in Redis (no dedicated audit table for MVP)
    // In production you'd write to a dedicated audit_logs table.
    // For now we just console.info so it appears in Render logs.
    console.info('[Audit]', JSON.stringify({ userId, action, ipAddress, ...extra }));
  } catch (_) { /* swallowed */ }
}

logAction.ACTIONS = ACTIONS;
module.exports = logAction;
