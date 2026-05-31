// SMSS — Express app factory
const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const cfg          = require('./config');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());

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

app.use(express.json());
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
app.use('/api/services/',  require('./routes/services'));
app.use('/api/notices/',   require('./routes/notices'));
app.use('/api/reports/',   require('./routes/reports'));
app.use('/api/push-token/',require('./routes/pushToken'));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) =>
  res.status(404).json({ error: 'not_found', detail: 'Endpoint not found.' })
);

app.use(errorHandler);

module.exports = app;
