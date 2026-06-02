// SMSS — HTTP server entry point
const app    = require('./app');
const cfg    = require('./config');
const prisma = require('./lib/prisma');

async function start() {
  try {
    // Verify DB is reachable before accepting traffic.
    // Wrapped in try/catch so a momentary Supabase timeout does
    // not prevent the process from starting — the /api/health/
    // endpoint will report 'degraded' until the DB is reachable.
    console.log('🔄 Checking database connection...');
    try {
      await prisma.$connect();
      console.log('✅ Database connected.');
    } catch (dbErr) {
      console.warn('⚠️  DB not reachable at startup — will retry on first request.');
      console.warn('   Reason:', dbErr.message.split('\n')[0]);
      // Don't exit — Prisma will reconnect when a query runs
    }

    console.log('✅ In-memory cache active.');

    const server = app.listen(cfg.port, '0.0.0.0', () => {
      console.log(`🚀 SMSS API running on port ${cfg.port} [${cfg.nodeEnv}]`);
    });

    const shutdown = async signal => {
      console.log(`\n${signal} — shutting down...`);
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (err) {
    console.error('❌ Failed to start:', err);
    process.exit(1);
  }
}

start();
