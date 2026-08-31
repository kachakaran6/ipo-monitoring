/**
 * DATABASE SEED — REAL-DATA-ONLY
 *
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  ABSOLUTE RULE: This seed must NEVER create IPO records.                   ║
 * ║                                                                            ║
 * ║  IPO data is populated exclusively by the IPO synchronization job          ║
 * ║  (ipoSyncWorker) which pulls from real authoritative sources:              ║
 * ║    • NSE (nseindia.com)                                                    ║
 * ║    • BSE (bseindia.com)                                                    ║
 * ║                                                                            ║
 * ║  DO NOT add any of the following to this file:                             ║
 * ║    ✗ Company names                                                         ║
 * ║    ✗ IPO symbols                                                           ║
 * ║    ✗ Registrar assignments                                                 ║
 * ║    ✗ Issue prices                                                          ║
 * ║    ✗ Application data                                                      ║
 * ║    ✗ Allotment results                                                     ║
 * ║    ✗ Subscription data                                                     ║
 * ║    ✗ Any fabricated or demo records                                        ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { db } from './index.js';
import { tenants, users, providerHealth } from './schema.js';
import { logger } from '../utils/logger.js';

// ══════════════════════════════════════════════════════════════════
// PRODUCTION GUARD
// This seed only creates infrastructure. If somehow fixture data
// is added back, this guard ensures it cannot run in production.
// ══════════════════════════════════════════════════════════════════
function assertNoFixtureData(): void {
  if (process.env.NODE_ENV === 'production' && process.env.FIXTURES_ENABLED === 'true') {
    console.error('');
    console.error('╔══════════════════════════════════════════════════════════════╗');
    console.error('║  FATAL: FIXTURES_ENABLED=true in production mode!           ║');
    console.error('║  Fixture data must NEVER run in production.                 ║');
    console.error('║  Application seed aborted.                                  ║');
    console.error('╚══════════════════════════════════════════════════════════════╝');
    console.error('');
    process.exit(1);
  }
}

/**
 * The list of known providers. These rows are created so the health
 * tracking system has records to update. They contain NO business data.
 */
const KNOWN_PROVIDERS = [
  'MUFG_INTIME',
  'KFINTECH',
  'BIGSHARE',
  'CAMEO',
  'NSE',
  'BSE',
  'UPSTOX',
  'TELEGRAM',
  'PUSHOVER',
] as const;

export async function seedDatabase(): Promise<void> {
  assertNoFixtureData();

  logger.info('Starting database seed (infrastructure-only, no IPO data)...');

  try {
    // 1. Create Default Tenant
    const [defaultTenant] = await db
      .insert(tenants)
      .values({
        name: 'Default Organization',
        slug: 'default',
        isActive: true,
      })
      .onConflictDoNothing()
      .returning();

    const tenantId = defaultTenant?.id;

    // 2. Create Default Admin User placeholder
    if (tenantId) {
      await db
        .insert(users)
        .values({
          tenantId,
          email: 'admin@ipo-intelligence.local',
          role: 'admin',
        })
        .onConflictDoNothing();
    }

    // 3. Initialize Provider Health records (status starts as UNKNOWN until first health check)
    for (const provider of KNOWN_PROVIDERS) {
      await db
        .insert(providerHealth)
        .values({
          provider,
          successCount: 0,
          failureCount: 0,
          consecutiveFailures: 0,
          latencyMs: 0,
          status: 'HEALTHY', // Optimistic initial state; first health check will correct this
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
    }

    logger.info(
      {
        providers: KNOWN_PROVIDERS.length,
        note: 'Zero IPO records seeded. Run sync-ipos to populate from real sources.',
      },
      'Database seed completed — infrastructure only.'
    );
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Failed to seed database');
    throw error;
  }
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
