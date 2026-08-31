import { Worker } from 'bullmq';
import { redisClient } from '../queues/connection.js';
import { DEFAULT_CONFIG } from '../config/default.js';
import { env } from '../config/env.js';
import { sql } from '../db/index.js';
import { logger } from '../utils/logger.js';

export function createCleanupWorker(): Worker {
  const worker = new Worker(
    DEFAULT_CONFIG.queues.cleanup,
    async () => {
      logger.info('Starting data retention cleanup worker...');

      try {
        // 1. Purge raw allotment checks older than RAW_PROVIDER_DATA_RETENTION_DAYS
        const rawRetentionDays = env.RAW_PROVIDER_DATA_RETENTION_DAYS;
        const resChecks = await sql`
          DELETE FROM allotment_checks
          WHERE created_at < NOW() - (${rawRetentionDays} || ' days')::INTERVAL
        `;
        logger.info({ purgedChecksCount: resChecks.count }, 'Purged old allotment checks');

        // 2. Purge audit logs older than AUDIT_RETENTION_DAYS
        const auditRetentionDays = env.AUDIT_RETENTION_DAYS;
        const resAudit = await sql`
          DELETE FROM audit_logs
          WHERE created_at < NOW() - (${auditRetentionDays} || ' days')::INTERVAL
        `;
        logger.info({ purgedAuditCount: resAudit.count }, 'Purged old audit logs');

        return { success: true };
      } catch (error) {
        logger.error({ error: (error as Error).message }, 'Retention cleanup worker error');
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
