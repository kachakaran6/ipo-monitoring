import { Worker, type Job } from 'bullmq';
import { redisClient } from '../queues/connection.js';
import { DEFAULT_CONFIG } from '../config/default.js';
import { notificationDispatcher } from '../providers/notification/NotificationDispatcher.js';
import type { NotificationJobData } from '../types/queue.types.js';
import { logger } from '../utils/logger.js';

export function createNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    DEFAULT_CONFIG.queues.notification,
    async (job: Job<NotificationJobData>) => {
      const { payload } = job.data;
      logger.info(
        { eventType: payload.eventType, fingerprint: payload.fingerprint },
        'Processing outbound notification job'
      );

      const result = await notificationDispatcher.dispatch(payload);
      return result;
    },
    {
      connection: redisClient,
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    logger.warn({ jobId: job?.id, error: err.message }, 'Notification worker failed');
  });

  return worker;
}
