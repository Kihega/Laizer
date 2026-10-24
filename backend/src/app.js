// SMSS — Express app factory
const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const cfg          = require('./config');
const errorHandler = require('./middleware/errorHandler');
// __LAIZER_PATCH_V8__
// gzip/deflate API responses (lists, reports) when the optional
// `compression` package is installed. Falls back to a no-op middleware
// so the server still boots if `npm install compression` hasn't run yet.
let compression;
try { compression = require('compression'); }
catch { compression = () => (_req, _res, next) => next(); }

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowed = cfg.corsOrigins.some(p =>
      typeof p === 'string' ? p === origin : p instanceof RegExp && p.test(origin)
    );
    allowed ? cb(null, true) : cb(new Error(`Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 5 MB limit — accommodates base64-encoded profile pictures (≤ 1 MB raw)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(morgan(cfg.isProduction ? 'combined' : 'dev'));

// ── Rate limiting on auth ─────────────────────────────────────────────────────
app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: cfg.auth.ownerLoginRateMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', detail: 'Too many requests. Try again later.' },
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/health/',    require('./routes/health'));
app.use('/api/auth/',      require('./routes/auth'));
app.use('/api/centres/',   require('./routes/centres'));
app.use('/api/workers/',   require('./routes/workers'));
app.use('/api/stock/',     require('./routes/stock'));
app.use('/api/equipment/', require('./routes/equipment'));
app.use('/api/services/',  require('./routes/services'));
app.use('/api/notices/',   require('./routes/notices'));
app.use('/api/reports/',   require('./routes/reports'));
app.use('/api/push-token/',require('./routes/pushToken'));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) =>
  res.status(404).json({ error: 'not_found', detail: 'Endpoint not found.' })
);

app.use(errorHandler);

// __LAIZER_PATCH_V11__
// Second layer of the daily-notice cleanup (see routes/notices.js for the
// primary lazy-delete-on-read layer): sweeps for anything already expired
// every 15 minutes while the process is awake, so notices don't linger
// purely because nobody happened to open the Notices screen.
(function scheduleNoticeCleanup() {
  const prisma = require('./lib/prisma');
  const sweep = async () => {
    try {
      const { count } = await prisma.notice.deleteMany({ where: { expiresAt: { lte: new Date() } } });
      if (count) console.log(`[Notices] Cleaned up ${count} expired notice(s).`);
    } catch (e) { console.error('[Notices] cleanup sweep failed:', e.message); }
  };
  sweep();
  setInterval(sweep, 15 * 60 * 1000);
})();

module.exports = app;
