import { createAllotmentCheckWorker } from './workers/allotmentCheckWorker.js';
import { createBulkPanWorker } from './workers/bulkPanWorker.js';
import { createIPOSyncWorker } from './workers/ipoSyncWorker.js';
import { createNotificationWorker } from './workers/notificationWorker.js';
import { createCleanupWorker } from './workers/cleanupWorker.js';
import { ipoSyncQueue, cleanupQueue } from './queues/index.js';
import { closeDatabaseConnection } from './db/index.js';
import { closeRedisConnection } from './queues/connection.js';
import { logger } from './utils/logger.js';

import http from 'node:http';

async function startWorkerService(): Promise<void> {
  logger.info('🚀 Starting BullMQ background workers...');

  // Lightweight HTTP Health Server for Coolify / Docker health checks
  const port = Number(process.env.PORT || 3000);
  const healthServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', role: 'worker', timestamp: new Date().toISOString() }));
  });

  healthServer.listen(port, '0.0.0.0', () => {
    logger.info(`Worker health probe listening on port ${port}`);
  });

  // Initialize workers
  const allotmentWorker = createAllotmentCheckWorker();
  const bulkWorker = createBulkPanWorker();
  const ipoWorker = createIPOSyncWorker();
  const notifWorker = createNotificationWorker();
  const cleanWorker = createCleanupWorker();

  // Setup Recurring Scheduled Jobs
  try {
    // 1. Sync IPO master data every 6 hours
    await ipoSyncQueue.add(
      'schedule:ipo-sync',
      { force: false },
      {
        repeat: { pattern: '0 */6 * * *' },
        jobId: 'repeat:ipo-sync-6h',
      }
    );

    // Trigger an immediate initial sync on startup
    await ipoSyncQueue.add('sync:startup', { force: true });

    // 2. Data retention cleanup every day at 3 AM UTC
    await cleanupQueue.add(
      'schedule:cleanup',
      {},
      {
        repeat: { pattern: '0 3 * * *' },
        jobId: 'repeat:cleanup-daily',
      }
    );

    logger.info('✅ Recurring scheduled jobs registered & initial sync dispatched');
  } catch (error) {
    logger.warn({ error: (error as Error).message }, 'Failed to schedule recurring jobs');
  }

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Stopping worker processes gracefully...');

    await Promise.allSettled([
      allotmentWorker.close(),
      bulkWorker.close(),
      ipoWorker.close(),
      notifWorker.close(),
      cleanWorker.close(),
    ]);

    await closeRedisConnection();
    await closeDatabaseConnection();

    logger.info('Worker processes stopped safely');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startWorkerService().catch((err) => {
  logger.fatal({ error: err.message }, 'Failed to start BullMQ worker service');
  process.exit(1);
});
