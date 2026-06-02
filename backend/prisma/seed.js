// Laizer — Database seed script
// Run:  npm run db:seed
//
// Creates / refreshes the test owner account so you can log in immediately
// after a fresh deployment.  Safe to run multiple times (upsert).

'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt           = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('');
  console.log('🌱 Laizer — seeding database...');
  console.log('');

  // ── Test Owner ─────────────────────────────────────────────────────────────
  // Use this account to log in, create a Centre, then add a Worker.
  const passwordHash = await bcrypt.hash('Laizer@2026', 12);

  const owner = await prisma.user.upsert({
    where:  { email: 'owner@laizer.com' },
    update: {
      fullName:     'LAIZER TEST OWNER',
      passwordHash,
      isActive:     true,
    },
    create: {
      email:        'owner@laizer.com',
      fullName:     'LAIZER TEST OWNER',
      phone:        '+255700000001',
      nim:          'LAIZER DEMO SHOP',
      passwordHash,
      role:         'owner',
      isActive:     true,
    },
  });

  console.log('✅ Test owner ready:');
  console.log(`   Email:    ${owner.email}`);
  console.log('   Password: Laizer@2026');
  console.log(`   Role:     ${owner.role}`);
  console.log(`   Active:   ${owner.isActive}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Log in at the mobile app with the credentials above.');
  console.log('  2. Go to Centres → Add a new centre.');
  console.log('  3. Go to Workers  → Add a new worker to that centre.');
  console.log('  4. The worker can now log in with the Centre ID.');
  console.log('');
}

main()
  .catch(err => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
