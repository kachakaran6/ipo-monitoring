import { Worker, type Job } from 'bullmq';
import { redisClient } from '../queues/connection.js';
import { DEFAULT_CONFIG } from '../config/default.js';
import { env } from '../config/env.js';
import { db } from '../db/index.js';
import { ipoMaster, allotmentResults, panProfiles } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { decryptPAN, maskPAN } from '../security/crypto.js';
import { allotmentEngine } from '../providers/allotment/AllotmentEngine.js';
import { notificationQueue, allotmentCheckQueue } from '../queues/index.js';
import { generateNotificationFingerprint } from '../security/fingerprint.js';
import { formatToIST } from '../utils/datetime.js';
import type { AllotmentCheckJobData } from '../types/queue.types.js';
import type { IPO } from '../types/ipo.types.js';
import { logger } from '../utils/logger.js';

export function createAllotmentCheckWorker(): Worker<AllotmentCheckJobData> {
  const worker = new Worker<AllotmentCheckJobData>(
    DEFAULT_CONFIG.queues.allotmentCheck,
    async (job: Job<AllotmentCheckJobData>) => {
      const { panHash, encryptedPan, ipoId, userId, telegramChatId, pushoverUserKey, isPolling, pollAttempt } =
        job.data;

      // 1. Fetch IPO details
      const [ipoRecord] = await db.select().from(ipoMaster).where(eq(ipoMaster.id, ipoId));
      if (!ipoRecord) {
        logger.warn({ ipoId }, 'IPO record not found for allotment check');
        return;
      }

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

      // 2. Decrypt PAN for provider query
      const plaintextPan = decryptPAN(encryptedPan);
      const masked = maskPAN(plaintextPan);

      // 3. Execute Allotment Check via AllotmentEngine
      const result = await allotmentEngine.checkAllotment(plaintextPan, ipo);

      // 4. Fetch Previous Result to Detect State Transitions
      const [previous] = await db
        .select()
        .from(allotmentResults)
        .where(
          and(
            eq(allotmentResults.panHash, panHash),
            eq(allotmentResults.ipoId, ipoId)
          )
        )
        .orderBy(desc(allotmentResults.checkedAt))
        .limit(1);

      const hasStateChanged = !previous || previous.status !== result.status;

      // 5. Store / Update result in Database
      const [panProf] = await db
        .select({ id: panProfiles.id })
        .from(panProfiles)
        .where(eq(panProfiles.panHash, panHash))
        .limit(1);

      await db.insert(allotmentResults).values({
        panProfileId: panProf?.id || null,
        panHash,
        ipoId,
        applicationNumber: result.applicationNumber,
        status: result.status,
        appliedQuantity: result.appliedQuantity || 0,
        allottedQuantity: result.allottedQuantity || 0,
        issuePrice: result.issuePrice ? String(result.issuePrice) : '0',
        amountApplied: result.amountApplied ? String(result.amountApplied) : '0',
        amountAllotted: result.amountAllotted ? String(result.amountAllotted) : '0',
        refundAmount: result.refundAmount ? String(result.refundAmount) : '0',
        dematCreditStatus: result.dematCreditStatus,
        source: result.source,
        confidence: result.confidence,
        rawReference: result.rawReference,
        fingerprint: result.fingerprint,
        checkedAt: result.checkedAt,
      });

      // 6. Trigger Notification only if result has changed and is meaningful
      if (hasStateChanged && (result.status === 'ALLOTTED' || result.status === 'NOT_ALLOTTED')) {
        const notifFingerprint = generateNotificationFingerprint({
          userId,
          panHash,
          ipoId,
          eventType: 'ALLOTMENT_RESULT_CHANGED',
          state: result.status,
        });

        let title = '';
        let message = '';

        if (result.status === 'ALLOTTED') {
          title = `🎉 IPO Allotment: ${ipo.companyName}`;
          message = `<b>🎉 IPO ALLOTMENT RESULT</b>\n\n` +
            `<b>Company:</b> ${ipo.companyName}\n` +
            `<b>PAN:</b> ${masked}\n\n` +
            `<b>Status:</b> 🟢 <b>ALLOTTED</b>\n` +
            `<b>Applied:</b> ${result.appliedQuantity} shares\n` +
            `<b>Allotted:</b> ${result.allottedQuantity} shares\n` +
            `<b>Issue Price:</b> ₹${result.issuePrice}\n` +
            `<b>Allotted Value:</b> ₹${result.amountAllotted?.toLocaleString('en-IN')}\n\n` +
            `<b>Registrar:</b> ${ipo.registrar || 'Official'}\n` +
            `<b>Checked:</b> ${formatToIST(result.checkedAt)}\n` +
            `<b>Confidence:</b> ${result.confidence}`;
        } else {
          title = `IPO Result: ${ipo.companyName}`;
          message = `<b>IPO ALLOTMENT RESULT</b>\n\n` +
            `<b>Company:</b> ${ipo.companyName}\n` +
            `<b>PAN:</b> ${masked}\n\n` +
            `<b>Status:</b> 🔴 <b>NOT ALLOTTED</b>\n` +
            `<b>Applied:</b> ${result.appliedQuantity} shares\n` +
            `<b>Allotted:</b> 0 shares\n\n` +
            `Refund expected according to issue timeline.\n` +
            `<b>Registrar:</b> ${ipo.registrar || 'Official'}\n` +
            `<b>Checked:</b> ${formatToIST(result.checkedAt)}`;
        }

        await notificationQueue.add(
          'notify:allotment-changed',
          {
            userId,
            telegramChatId,
            pushoverUserKey,
            payload: {
              userId,
              telegramChatId,
              pushoverUserKey,
              eventType: 'ALLOTMENT_RESULT_CHANGED',
              title,
              message,
              data: { allotmentResult: result, ipo },
              fingerprint: notifFingerprint,
            },
          },
          { jobId: `notif:${notifFingerprint}` }
        );
      }

      // 7. Automatic Polling Reschedule if still PENDING and within retry policy
      const currentAttempt = pollAttempt || 1;
      if (
        isPolling &&
        result.status === 'PENDING' &&
        currentAttempt < env.ALLOTMENT_MAX_ATTEMPTS
      ) {
        const delayMs = env.ALLOTMENT_POLL_INTERVAL_MINUTES * 60 * 1000;
        await allotmentCheckQueue.add(
          'check:poll-next',
          {
            ...job.data,
            pollAttempt: currentAttempt + 1,
          },
          { delay: delayMs, jobId: `poll:${panHash}:${ipoId}:${currentAttempt + 1}` }
        );
      }

      return result;
    },
    {
      connection: redisClient,
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, error: err.message },
      'Allotment check worker failed job'
    );
  });

  return worker;
}
