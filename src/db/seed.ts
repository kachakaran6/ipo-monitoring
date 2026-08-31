import { db, sql } from './index.js';
import { tenants, users, ipoMaster, providerHealth } from './schema.js';
import { logger } from '../utils/logger.js';

export async function seedDatabase(): Promise<void> {
  logger.info('Starting database seeding...');

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

    // 2. Create Default Admin User
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

    // 3. Initialize Provider Health records
    const providers = [
      'MUFG_INTIME',
      'KFINTECH',
      'BIGSHARE',
      'NSE',
      'BSE',
      'UPSTOX',
      'TELEGRAM',
      'PUSHOVER',
    ];

    for (const p of providers) {
      await db
        .insert(providerHealth)
        .values({
          provider: p,
          successCount: 0,
          failureCount: 0,
          consecutiveFailures: 0,
          latencyMs: 120,
          status: 'HEALTHY',
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
    }

    // 4. Seed Canonical IPO Master Data
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const inFiveDays = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    const sampleIpos = [
      {
        symbol: 'TECHCORP',
        companyName: 'TechCorp Innovations Limited',
        slug: 'techcorp-innovations',
        isin: 'INE123A01019',
        exchange: 'NSE',
        issueType: 'BOOK_BUILT',
        mainboardOrSme: 'MAINBOARD',
        status: 'ALLOTMENT_PENDING',
        openDate: threeDaysAgo,
        closeDate: yesterday,
        allotmentDate: now,
        refundDate: tomorrow,
        dematCreditDate: inThreeDays,
        listingDate: inFiveDays,
        faceValue: '10.00',
        priceBandMin: '320.00',
        priceBandMax: '340.00',
        issuePrice: '340.00',
        lotSize: 44,
        minimumApplication: 44,
        issueSize: '1250.50',
        registrar: 'MUFG_INTIME',
        registrarUrl: 'https://linkintime.co.in',
        subscriptionQib: '85.40',
        subscriptionNii: '42.10',
        subscriptionRetail: '18.75',
        subscriptionEmployee: '2.50',
        subscriptionTotal: '48.90',
        gmp: '65.00',
        gmpPercentage: '19.12',
        source: 'UPSTOX',
        sourceUpdatedAt: now,
      },
      {
        symbol: 'NEXUSFIN',
        companyName: 'Nexus Finance & Wealth Limited',
        slug: 'nexus-finance-wealth',
        isin: 'INE456B02028',
        exchange: 'BOTH',
        issueType: 'BOOK_BUILT',
        mainboardOrSme: 'MAINBOARD',
        status: 'OPEN',
        openDate: yesterday,
        closeDate: inThreeDays,
        allotmentDate: inFiveDays,
        refundDate: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
        dematCreditDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        listingDate: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
        faceValue: '5.00',
        priceBandMin: '510.00',
        priceBandMax: '540.00',
        issuePrice: '540.00',
        lotSize: 27,
        minimumApplication: 27,
        issueSize: '3400.00',
        registrar: 'KFINTECH',
        registrarUrl: 'https://ris.kfintech.com/ipostatus/',
        subscriptionQib: '12.20',
        subscriptionNii: '8.40',
        subscriptionRetail: '5.10',
        subscriptionEmployee: '1.20',
        subscriptionTotal: '7.80',
        gmp: '110.00',
        gmpPercentage: '20.37',
        source: 'NSE',
        sourceUpdatedAt: now,
      },
      {
        symbol: 'GREENENRG',
        companyName: 'Green Energy Solutions SME Limited',
        slug: 'green-energy-solutions-sme',
        isin: 'INE789C03037',
        exchange: 'BSE',
        issueType: 'FIXED_PRICE',
        mainboardOrSme: 'SME',
        status: 'ALLOTTED',
        openDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        closeDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        allotmentDate: twoDaysAgo,
        refundDate: yesterday,
        dematCreditDate: now,
        listingDate: tomorrow,
        faceValue: '10.00',
        priceBandMin: '115.00',
        priceBandMax: '115.00',
        issuePrice: '115.00',
        lotSize: 1200,
        minimumApplication: 1200,
        issueSize: '35.00',
        registrar: 'BIGSHARE',
        registrarUrl: 'https://www.bigshareonline.com/ipo_Allotment.html',
        subscriptionQib: '0.00',
        subscriptionNii: '24.50',
        subscriptionRetail: '68.20',
        subscriptionEmployee: '0.00',
        subscriptionTotal: '46.35',
        gmp: '45.00',
        gmpPercentage: '39.13',
        source: 'BSE',
        sourceUpdatedAt: now,
      },
      {
        symbol: 'BIOHEALTH',
        companyName: 'BioHealth Care Innovations Limited',
        slug: 'biohealth-care-innovations',
        isin: 'INE999D04046',
        exchange: 'NSE',
        issueType: 'BOOK_BUILT',
        mainboardOrSme: 'MAINBOARD',
        status: 'UPCOMING',
        openDate: inThreeDays,
        closeDate: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
        allotmentDate: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
        refundDate: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000),
        dematCreditDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        listingDate: new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000),
        faceValue: '2.00',
        priceBandMin: '420.00',
        priceBandMax: '445.00',
        issuePrice: '445.00',
        lotSize: 33,
        minimumApplication: 33,
        issueSize: '890.00',
        registrar: 'MUFG_INTIME',
        registrarUrl: 'https://linkintime.co.in',
        subscriptionQib: '0.00',
        subscriptionNii: '0.00',
        subscriptionRetail: '0.00',
        subscriptionEmployee: '0.00',
        subscriptionTotal: '0.00',
        gmp: '32.00',
        gmpPercentage: '7.19',
        source: 'UPSTOX',
        sourceUpdatedAt: now,
      },
    ];

    for (const ipo of sampleIpos) {
      await db
        .insert(ipoMaster)
        .values(ipo)
        .onConflictDoUpdate({
          target: ipoMaster.slug,
          set: {
            status: ipo.status,
            gmp: ipo.gmp,
            gmpPercentage: ipo.gmpPercentage,
            subscriptionTotal: ipo.subscriptionTotal,
            updatedAt: new Date(),
          },
        });
    }

    logger.info('Database seeding completed successfully');
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
