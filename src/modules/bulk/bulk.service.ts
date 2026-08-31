import { db } from '../../db/index.js';
import { bulkJobs, bulkJobItems } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { encryptPAN, hashPAN, getPANLast4 } from '../../security/crypto.js';
import { bulkPanQueue } from '../../queues/index.js';
import type { CreateBulkCheckInput } from './bulk.schema.js';
import { parseBulkPANInput } from '../../utils/csv.js';

export class BulkService {
  private inMemoryJobs: Map<string, any> = new Map();

  public async createBulkJob(
    input: CreateBulkCheckInput | { rawTextOrCsv: string },
    userId?: string,
    telegramChatId?: number | string,
    pushoverUserKey?: string
  ) {
    let rawPans: Array<{ pan: string; label?: string }> = [];

    if ('rawTextOrCsv' in input) {
      const parsed = parseBulkPANInput(input.rawTextOrCsv);
      rawPans = parsed.uniqueAcceptedPans.map((p) => ({ pan: p.normalizedPan, label: p.label }));
    } else {
      rawPans = input.pans;
    }

    // Deduplicate PANs
    const seen = new Set<string>();
    const uniqueList: Array<{ pan: string; label?: string }> = [];
    for (const item of rawPans) {
      const normalized = item.pan.trim().toUpperCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueList.push({ pan: normalized, label: item.label });
      }
    }

    if (uniqueList.length === 0) {
      throw new Error('No valid unique PANs found in submission');
    }

    const jobId = `BULK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Prepare encrypted items
    const preparedItems = uniqueList.map((item) => {
      const panHash = hashPAN(item.pan);
      const encryptedPan = encryptPAN(item.pan);
      const panLast4 = getPANLast4(item.pan);
      return {
        bulkJobId: jobId,
        panHash,
        panLast4,
        label: item.label || null,
        status: 'PENDING',
        encryptedPan,
      };
    });

    try {
      // Insert BulkJob record
      await db.insert(bulkJobs).values({
        id: jobId,
        userId: userId || null,
        totalPans: uniqueList.length,
        status: 'QUEUED',
        createdAt: new Date(),
      });

      // Insert bulk items into DB
      for (const item of preparedItems) {
        await db.insert(bulkJobItems).values({
          bulkJobId: item.bulkJobId,
          panHash: item.panHash,
          panLast4: item.panLast4,
          label: item.label,
          status: item.status,
        });
      }

      // Dispatch job to BullMQ
      await bulkPanQueue.add(
        'bulk:process',
        {
          bulkJobId: jobId,
          userId,
          telegramChatId,
          pushoverUserKey,
          pans: preparedItems.map((p) => ({
            encryptedPan: p.encryptedPan,
            panHash: p.panHash,
            panLast4: p.panLast4,
            label: p.label || undefined,
          })),
        },
        { jobId: `bulk:${jobId}` }
      );
    } catch {
      // In-memory fallback
      this.inMemoryJobs.set(jobId, {
        id: jobId,
        totalPans: uniqueList.length,
        processedPans: 0,
        status: 'QUEUED',
        createdAt: new Date(),
      });
    }

    return {
      jobId,
      totalPans: rawPans.length,
      uniquePans: uniqueList.length,
      status: 'QUEUED',
      estimatedCompletionSeconds: Math.ceil(uniqueList.length * 1.5),
    };
  }

  public async getBulkJobStatus(jobId: string) {
    try {
      const [job] = await db.select().from(bulkJobs).where(eq(bulkJobs.id, jobId)).limit(1);

      if (job) {
        const items = await db
          .select({
            id: bulkJobItems.id,
            panLast4: bulkJobItems.panLast4,
            label: bulkJobItems.label,
            status: bulkJobItems.status,
            allottedIposCount: bulkJobItems.allottedIposCount,
            errorMessage: bulkJobItems.errorMessage,
            processedAt: bulkJobItems.processedAt,
          })
          .from(bulkJobItems)
          .where(eq(bulkJobItems.bulkJobId, jobId))
          .limit(100);

        const progressPercentage =
          job.totalPans > 0 ? Math.round((job.processedPans / job.totalPans) * 100) : 0;

        return {
          job: {
            id: job.id,
            status: job.status,
            totalPans: job.totalPans,
            processedPans: job.processedPans,
            successfulPans: job.successfulPans,
            partialPans: job.partialPans,
            failedPans: job.failedPans,
            allottedCount: job.allottedCount,
            notAllottedCount: job.notAllottedCount,
            pendingCount: job.pendingCount,
            progressPercentage,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            createdAt: job.createdAt,
          },
          recentItems: items,
        };
      }
    } catch {
      // Fallback
    }

    const mem = this.inMemoryJobs.get(jobId);
    if (!mem) return null;

    return {
      job: {
        id: mem.id,
        status: mem.status,
        totalPans: mem.totalPans,
        processedPans: mem.processedPans,
        successfulPans: 0,
        partialPans: 0,
        failedPans: 0,
        allottedCount: 0,
        notAllottedCount: 0,
        pendingCount: 0,
        progressPercentage: 0,
        createdAt: mem.createdAt,
      },
      recentItems: [],
    };
  }
}

export const bulkService = new BulkService();
