import { Worker, type Job } from 'bullmq';
import { redisClient } from '../queues/connection.js';
import { DEFAULT_CONFIG } from '../config/default.js';
import { db } from '../db/index.js';
import { ipoMaster, ipoSubscriptionSnapshots } from '../db/schema.js';
import { ipoProviderRegistry } from '../providers/ipo/IPOProviderRegistry.js';
import type { IPOSyncJobData } from '../types/queue.types.js';
import { logger } from '../utils/logger.js';

export function createIPOSyncWorker(): Worker<IPOSyncJobData> {
  const worker = new Worker<IPOSyncJobData>(
    DEFAULT_CONFIG.queues.ipoSync,
    async (job: Job<IPOSyncJobData>) => {
      logger.info('Starting IPO synchronization job...');

      try {
        // 1. Fetch Open & Upcoming IPOs from Registry
        const [openIpos, upcomingIpos] = await Promise.all([
          ipoProviderRegistry.getOpenIPOs(),
          ipoProviderRegistry.getUpcomingIPOs(),
        ]);

        const allIpos = [...openIpos, ...upcomingIpos];
        logger.info({ count: allIpos.length }, 'Fetched IPO listings from providers');

        for (const ipo of allIpos) {
          // Upsert into ipo_master
          await db
            .insert(ipoMaster)
            .values({
              symbol: ipo.symbol,
              companyName: ipo.companyName,
              slug: ipo.slug,
              isin: ipo.isin,
              exchange: ipo.exchange,
              issueType: ipo.issueType,
              mainboardOrSme: ipo.mainboardOrSme,
              status: ipo.status,
              openDate: ipo.openDate,
              closeDate: ipo.closeDate,
              allotmentDate: ipo.allotmentDate,
              refundDate: ipo.refundDate,
              dematCreditDate: ipo.dematCreditDate,
              listingDate: ipo.listingDate,
              faceValue: ipo.faceValue ? String(ipo.faceValue) : undefined,
              priceBandMin: ipo.priceBandMin ? String(ipo.priceBandMin) : undefined,
              priceBandMax: ipo.priceBandMax ? String(ipo.priceBandMax) : undefined,
              issuePrice: ipo.issuePrice ? String(ipo.issuePrice) : undefined,
              lotSize: ipo.lotSize,
              minimumApplication: ipo.minimumApplication,
              issueSize: ipo.issueSize ? String(ipo.issueSize) : undefined,
              registrar: ipo.registrar,
              registrarUrl: ipo.registrarUrl,
              sourceId: ipo.sourceId,
              sourceUrl: ipo.sourceUrl,
              gmp: ipo.gmp ? String(ipo.gmp) : '0',
              gmpPercentage: ipo.gmpPercentage ? String(ipo.gmpPercentage) : '0',
              source: ipo.source,
              sourceUpdatedAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: ipoMaster.slug,
              set: {
                status: ipo.status,
                openDate: ipo.openDate,
                closeDate: ipo.closeDate,
                allotmentDate: ipo.allotmentDate,
                gmp: ipo.gmp ? String(ipo.gmp) : undefined,
                gmpPercentage: ipo.gmpPercentage ? String(ipo.gmpPercentage) : undefined,
                sourceUpdatedAt: new Date(),
                updatedAt: new Date(),
              },
            });

          // 2. Fetch and snapshot subscription data if available
          if (ipo.subscription) {
            const sub = ipo.subscription;
            await db.insert(ipoSubscriptionSnapshots).values({
              ipoId: ipo.id,
              qib: String(sub.qib),
              nii: String(sub.nii),
              retail: String(sub.retail),
              employee: String(sub.employee),
              total: String(sub.total),
              snapshotAt: new Date(),
            }).onConflictDoNothing();
          }
        }

        logger.info('IPO synchronization completed successfully');
        return { syncedCount: allIpos.length };
      } catch (error) {
        logger.error({ error: (error as Error).message }, 'IPO synchronization job failed');
        throw error;
      }
    },
    {
      connection: redisClient,
      concurrency: 1,
    }
  );

  return worker;
}
