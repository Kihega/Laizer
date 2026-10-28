/**
 * Laizer — report-day helpers
 * __LAIZER_PATCH_V16__
 *
 * A "report day" is a calendar day in Tanzania (Africa/Dar_es_Salaam, UTC+3, no
 * daylight saving), not in the server's timezone — Render runs in UTC, which
 * would otherwise cut every day 3 hours late.
 * Day keys are plain 'YYYY-MM-DD' strings.
 */
'use strict';

const OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS    = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' of the Tanzanian day that contains `when`. */
function dayKey(when = new Date()) {
  return new Date(new Date(when).getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** True for a real calendar date written as YYYY-MM-DD. */
function isDayKey(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

/** [start, end) as UTC instants for the Tanzanian day `key`. */
function dayRange(key) {
  const start = new Date(Date.parse(`${key}T00:00:00Z`) - OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** The last `n` day keys, newest first (today included). */
function lastDayKeys(n, from = new Date()) {
  const base = Date.parse(`${dayKey(from)}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(base - i * DAY_MS).toISOString().slice(0, 10));
}

module.exports = { dayKey, isDayKey, dayRange, lastDayKeys };
