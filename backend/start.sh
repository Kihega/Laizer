#!/bin/sh
# Laizer API — Docker container entrypoint
# 1. Apply any pending Prisma migrations against the live DB
# 2. Start the Express server
set -e

echo "====================================="
echo "  Laizer API — Container Starting"
echo "====================================="
echo ""
echo "🔄 Syncing Prisma schema to database..."
npx prisma db push --accept-data-loss
echo "✅ Schema synced."
echo ""
exec node src/server.js
