import { Worker, type Job } from 'bullmq';
import { redisClient } from '../queues/connection.js';
import { DEFAULT_CONFIG } from '../config/default.js';
import { env } from '../config/env.js';
import { db } from '../db/index.js';
import { bulkJobs, bulkJobItems, ipoMaster } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { decryptPAN } from '../security/crypto.js';
import { allotmentEngine } from '../providers/allotment/AllotmentEngine.js';
import { notificationQueue } from '../queues/index.js';
import { generateNotificationFingerprint } from '../security/fingerprint.js';
import { formatDuration } from '../utils/datetime.js';
import type { BulkPanJobData } from '../types/queue.types.js';
import type { IPO } from '../types/ipo.types.js';
import { logger } from '../utils/logger.js';

export function createBulkPanWorker(): Worker<BulkPanJobData> {
  const worker = new Worker<BulkPanJobData>(
    DEFAULT_CONFIG.queues.bulkPanCheck,
    async (job: Job<BulkPanJobData>) => {
      const { bulkJobId, userId, telegramChatId, pushoverUserKey, pans } = job.data;
      const startTime = Date.now();

      logger.info({ bulkJobId, totalPans: pans.length }, 'Starting bulk PAN processing worker');

      // Update BulkJob status to PROCESSING
      await db
        .update(bulkJobs)
        .set({ status: 'PROCESSING', startedAt: new Date() })
        .where(eq(bulkJobs.id, bulkJobId));

      // Fetch active/recent IPOs to check against
      const activeIpos = await db
        .select()
        .from(ipoMaster)
        .where(
          inArray(ipoMaster.status, ['OPEN', 'CLOSED', 'ALLOTMENT_PENDING', 'ALLOTTED'])
        );

      let processedCount = 0;
      let successCount = 0;
      let partialCount = 0;
      let failedCount = 0;
      let totalAllotted = 0;
      let totalNotAllotted = 0;
      let totalPending = 0;

      // Process in chunks respecting concurrency
      const chunkSize = DEFAULT_CONFIG.bulk.batchChunkSize;
      for (let i = 0; i < pans.length; i += chunkSize) {
        const chunk = pans.slice(i, i + chunkSize);

        await Promise.all(
          chunk.map(async (panItem) => {
            try {
              const plaintext = decryptPAN(panItem.encryptedPan);
              let itemAllotted = 0;
              let itemNotAllotted = 0;
              let itemPending = 0;

              for (const ipoRecord of activeIpos) {
                const ipo: IPO = {
                  id: ipoRecord.id,
                  symbol: ipoRecord.symbol,
                  companyName: ipoRecord.companyName,
                  slug: ipoRecord.slug,
                  exchange: ipoRecord.exchange as IPO['exchange'],
                  issueType: ipoRecord.issueType as IPO['issueType'],
                  mainboardOrSme: ipoRecord.mainboardOrSme as IPO['mainboardOrSme'],
                  status: ipoRecord.status as IPO['status'],
                  lotSize: ipoRecord.lotSize,
                  minimumApplication: ipoRecord.minimumApplication,
                  issuePrice: ipoRecord.issuePrice ? Number(ipoRecord.issuePrice) : undefined,
                  registrar: ipoRecord.registrar,
                  registrarUrl: ipoRecord.registrarUrl,
                  source: ipoRecord.source,
                };

                const res = await allotmentEngine.checkAllotment(plaintext, ipo);

                if (res.status === 'ALLOTTED') {
                  itemAllotted++;
                  totalAllotted++;
                } else if (res.status === 'NOT_ALLOTTED') {
                  itemNotAllotted++;
                  totalNotAllotted++;
                } else if (res.status === 'PENDING') {
                  itemPending++;
                  totalPending++;
                }
              }

              // Update item record
              await db
                .update(bulkJobItems)
                .set({
                  status: 'COMPLETED',
                  allottedIposCount: itemAllotted,
                  processedAt: new Date(),
                })
                .where(
                  eq(bulkJobItems.panHash, panItem.panHash)
                );

              processedCount++;
              if (itemAllotted > 0 || itemNotAllotted > 0 || itemPending > 0) {
                successCount++;
              } else {
                partialCount++;
              }
            } catch (error) {
              processedCount++;
              failedCount++;
              logger.warn(
                { bulkJobId, panLast4: panItem.panLast4, error: (error as Error).message },
                'Failed processing bulk item'
              );

              await db
                .update(bulkJobItems)
                .set({
                  status: 'FAILED',
                  errorMessage: (error as Error).message,
                  processedAt: new Date(),
                })
                .where(eq(bulkJobItems.panHash, panItem.panHash));
            }
          })
        );

        // Update real-time progress on bulk_jobs
        await db
          .update(bulkJobs)
          .set({
            processedPans: processedCount,
            successfulPans: successCount,
            partialPans: partialCount,
            failedPans: failedCount,
            allottedCount: totalAllotted,
            notAllottedCount: totalNotAllotted,
            pendingCount: totalPending,
          })
          .where(eq(bulkJobs.id, bulkJobId));

        job.updateProgress(Math.round((processedCount / pans.length) * 100));
      }

      const totalDurationSec = (Date.now() - startTime) / 1000;

      // Finalize Job
      await db
        .update(bulkJobs)
        .set({
          status: 'COMPLETED',
          completedAt: new Date(),
        })
        .where(eq(bulkJobs.id, bulkJobId));

      logger.info(
        { bulkJobId, processedCount, totalAllotted, duration: totalDurationSec },
        'Bulk PAN job completed'
      );

      // Dispatch Completion Notification
      const notifFingerprint = generateNotificationFingerprint({
        userId,
        eventType: 'BULK_CHECK_COMPLETED',
        state: bulkJobId,
      });

      const message = `<b>📦 BULK IPO CHECK COMPLETED</b>\n\n` +
        `<b>Job ID:</b> <code>${bulkJobId}</code>\n` +
        `<b>Total PANs:</b> ${pans.length}\n` +
        `<b>Processed:</b> ${processedCount}\n` +
        `<b>Successful:</b> ${successCount}\n` +
        `<b>Partial / No App:</b> ${partialCount}\n` +
        `<b>Failed:</b> ${failedCount}\n\n` +
        `🎉 <b>Allotted:</b> ${totalAllotted}\n` +
        `❌ <b>Not Allotted:</b> ${totalNotAllotted}\n` +
        `⏳ <b>Pending:</b> ${totalPending}\n\n` +
        `⏱️ <b>Duration:</b> ${formatDuration(totalDurationSec)}`;

      await notificationQueue.add(
        'notify:bulk-completed',
        {
          userId,
          telegramChatId,
          pushoverUserKey,
          payload: {
            userId,
            telegramChatId,
            pushoverUserKey,
            eventType: 'BULK_CHECK_COMPLETED',
            title: `Bulk Check Completed (${bulkJobId})`,
            message,
            data: { bulkJobId },
            fingerprint: notifFingerprint,
          },
        },
        { jobId: `notif:${notifFingerprint}` }
      );

      return { bulkJobId, processedCount, totalAllotted, durationSec: totalDurationSec };
    },
    {
      connection: redisClient,
      concurrency: env.BULK_WORKER_CONCURRENCY,
    }
  );

  return worker;
}
