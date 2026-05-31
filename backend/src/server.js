// SMSS — HTTP server entry point
const app    = require('./app');
const cfg    = require('./config');
const prisma = require('./lib/prisma');
const redis  = require('./lib/redis');

async function start() {
  try {
    console.log('🔄 Connecting to database...');
    await prisma.$connect();
    console.log('✅ Database connected.');

    if (cfg.redisUrl) {
      try {
        const client = await redis.getClient();
        if (client?.isReady) console.log('✅ Redis connected.');
        else console.warn('⚠️  Redis not ready — caching disabled.');
      } catch (e) {
        console.warn('⚠️  Redis failed:', e.message, '— caching disabled.');
      }
    } else {
      console.log('ℹ️  REDIS_URL not set — running without cache.');
    }

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
