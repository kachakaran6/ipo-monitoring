import { Queue } from 'bullmq';
import { redisClient } from './connection.js';
import { DEFAULT_CONFIG } from '../config/default.js';
import type {
  AllotmentCheckJobData,
  BulkPanJobData,
  IPOSyncJobData,
  NotificationJobData,
} from '../types/queue.types.js';

export const allotmentCheckQueue = new Queue<AllotmentCheckJobData>(
  DEFAULT_CONFIG.queues.allotmentCheck,
  {
    connection: redisClient,
    defaultJobOptions: DEFAULT_CONFIG.jobOptions,
  }
);

export const bulkPanQueue = new Queue<BulkPanJobData>(
  DEFAULT_CONFIG.queues.bulkPanCheck,
  {
    connection: redisClient,
    defaultJobOptions: DEFAULT_CONFIG.jobOptions,
  }
);

export const ipoSyncQueue = new Queue<IPOSyncJobData>(
  DEFAULT_CONFIG.queues.ipoSync,
  {
    connection: redisClient,
    defaultJobOptions: DEFAULT_CONFIG.jobOptions,
  }
);

export const notificationQueue = new Queue<NotificationJobData>(
  DEFAULT_CONFIG.queues.notification,
  {
    connection: redisClient,
    defaultJobOptions: {
      ...DEFAULT_CONFIG.jobOptions,
      attempts: 5,
    },
  }
);

export const cleanupQueue = new Queue(DEFAULT_CONFIG.queues.cleanup, {
  connection: redisClient,
  defaultJobOptions: DEFAULT_CONFIG.jobOptions,
});
