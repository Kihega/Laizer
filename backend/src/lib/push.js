// SMSS — Expo Push Notification sender
// Called from notices route after a notice is inserted.
const cfg    = require('../config');
const prisma = require('./prisma');

/**
 * Send push notifications to all active workers of a centre.
 * @param {string} centreId
 * @param {string} title
 * @param {string} body
 * @param {object} [data]   Extra data for the notification payload
 */
async function notifyWorkers(centreId, title, body, data = {}) {
  try {
    // Get all active workers of this centre
    const assignments = await prisma.workerCentreAssignment.findMany({
      where:   { centreId, isActive: true },
      select:  { workerId: true },
    });

    const workerIds = assignments.map(a => a.workerId);
    if (!workerIds.length) return;

    // Get their Expo push tokens
    const tokenRows = await prisma.expoPushToken.findMany({
      where:  { userId: { in: workerIds } },
      select: { token: true },
    });

    const tokens = tokenRows.map(r => r.token).filter(Boolean);
    if (!tokens.length) return;

    // Build messages (batches of 100 — Expo limit)
    const messages = tokens.map(to => ({
      to,
      title,
      body,
      data,
      sound: 'default',
      priority: 'high',
    }));

    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      await fetch(cfg.expoPushUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify(batch),
      }).catch(e => console.error('[Push] batch send failed:', e.message));
    }
  } catch (e) {
    console.error('[Push] notifyWorkers error:', e.message);
  }
}

module.exports = { notifyWorkers };
