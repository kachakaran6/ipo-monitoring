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
        // issuePrice from master is authoritative — but still nullable
        issuePrice: ipoRecord.issuePrice ? Number(ipoRecord.issuePrice) : null,
        registrar: ipoRecord.registrar,
        registrarUrl: ipoRecord.registrarUrl,
        source: ipoRecord.source,
        sourceId: (ipoRecord as any).sourceId,
        sourceUrl: (ipoRecord as any).sourceUrl,
      };

      // 2. Decrypt PAN for provider query (plaintext PAN is never logged)
      const plaintextPan = decryptPAN(encryptedPan);
      const masked = maskPAN(plaintextPan);

      // 3. Execute Allotment Check via AllotmentEngine
      const result = await allotmentEngine.checkAllotment(plaintextPan, ipo);

      // 4. Fetch Previous Result to detect state transitions
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

      // 5. Store result in Database
      // CRITICAL: quantities and price stored as null when not returned by source — never 0
      const [panProf] = await db
        .select({ id: panProfiles.id })
        .from(panProfiles)
        .where(eq(panProfiles.panHash, panHash))
        .limit(1);

      // Only persist meaningful results — UNSUPPORTED means the provider doesn't support this IPO
      if (result.status !== 'UNSUPPORTED') {
        try {
          await db.insert(allotmentResults).values({
            panProfileId: panProf?.id || null,
            panHash,
            ipoId,
            applicationNumber: result.applicationNumber,
            status: result.status,
            // CRITICAL: null if not returned by source — never default to 0
            appliedQuantity: result.appliedQuantity ?? null,
            allottedQuantity: result.allottedQuantity ?? null,
            issuePrice: result.issuePrice != null ? String(result.issuePrice) : null,
            amountApplied: result.amountApplied != null ? String(result.amountApplied) : null,
            amountAllotted: result.amountAllotted != null ? String(result.amountAllotted) : null,
            refundAmount: result.refundAmount != null ? String(result.refundAmount) : null,
            dematCreditStatus: result.dematCreditStatus,
            source: result.source,
            sourceType: result.provenance?.sourceType ?? null,
            confidence: result.confidence,
            qualityScore: result.qualityScore ?? 'FAILED',
            rawReference: result.rawReference,
            fingerprint: result.fingerprint,
            checkedAt: result.checkedAt,
          });
        } catch {
          // Suppress duplicate fingerprint constraint (polling may re-check same IPO)
        }
      }

      // 6. Trigger Notification only on meaningful state transitions
      // DO NOT notify on: CAPTCHA_REQUIRED, CHECK_FAILED, UNSUPPORTED, RATE_LIMITED
      // Only notify when the authoritative source explicitly confirms ALLOTTED or NOT_ALLOTTED
      const isAuthoritativeResult = result.status === 'ALLOTTED' || result.status === 'NOT_ALLOTTED';

      if (hasStateChanged && isAuthoritativeResult) {
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
          title = `🎉 IPO Allotment Confirmed: ${ipo.companyName}`;
          message =
            `<b>🎉 IPO ALLOTMENT CONFIRMED</b>\n\n` +
            `<b>Company:</b> ${ipo.companyName}\n` +
            `<b>IPO:</b> ${ipo.symbol}\n` +
            `<b>PAN:</b> ${masked}\n\n` +
            `<b>Status:</b> 🟢 <b>ALLOTTED</b>\n`;

          // Only show fields that the source actually returned — no fabrication
          if (result.appliedQuantity != null) {
            message += `<b>Applied:</b> ${result.appliedQuantity} shares\n`;
          }
          if (result.allottedQuantity != null) {
            message += `<b>Allotted:</b> ${result.allottedQuantity} shares\n`;
          }
          if (result.issuePrice != null) {
            message += `<b>Issue Price:</b> ₹${result.issuePrice}\n`;
          }
          if (result.amountAllotted != null) {
            message += `<b>Allotted Value:</b> ₹${Number(result.amountAllotted).toLocaleString('en-IN')}\n`;
          }

          message +=
            `\n<b>Registrar:</b> ${ipo.registrar || 'Check official registrar'}\n` +
            `<b>Source:</b> ${result.source}\n` +
            `<b>Checked:</b> ${formatToIST(result.checkedAt)}`;
        } else {
          title = `IPO Result: ${ipo.companyName}`;
          message =
            `<b>IPO ALLOTMENT RESULT</b>\n\n` +
            `<b>Company:</b> ${ipo.companyName}\n` +
            `<b>IPO:</b> ${ipo.symbol}\n` +
            `<b>PAN:</b> ${masked}\n\n` +
            `<b>Status:</b> 🔴 <b>NOT ALLOTTED</b>\n`;

          if (result.appliedQuantity != null) {
            message += `<b>Applied:</b> ${result.appliedQuantity} shares\n`;
          }

          message +=
            `\n<b>Registrar:</b> ${ipo.registrar || 'Check official registrar'}\n` +
            `<b>Source:</b> ${result.source}\n` +
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

      // 7. Automatic Polling Reschedule
      // CRITICAL: Only reschedule when provider explicitly returned PENDING.
      // Never reschedule on CAPTCHA_REQUIRED, CHECK_FAILED, or UNSUPPORTED —
      // these are not transient states that will resolve on retry without user action.
      const currentAttempt = pollAttempt || 1;
      const shouldReschedule =
        isPolling &&
        result.status === 'PENDING' && // Source must have explicitly returned PENDING
        currentAttempt < env.ALLOTMENT_MAX_ATTEMPTS;

      if (shouldReschedule) {
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
