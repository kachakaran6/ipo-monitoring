export const DEFAULT_CONFIG = {
  app: {
    name: 'Indian IPO Intelligence Platform',
    version: '1.0.0',
    description: 'High-throughput Indian IPO Intelligence & Allotment Monitoring Platform',
  },
  pan: {
    regex: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
    maskLength: 5,
  },
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  bulk: {
    maxPansPerJob: 1000,
    batchChunkSize: 20,
  },
  cache: {
    ipoListTtlSeconds: 300, // 5 minutes
    ipoDetailTtlSeconds: 600, // 10 minutes
    providerHealthTtlSeconds: 60, // 1 minute
  },
  queues: {
    ipoSync: 'ipo-sync',
    subscriptionSync: 'subscription-sync',
    allotmentCheck: 'allotment-check',
    bulkPanCheck: 'bulk-pan-check',
    notification: 'notification',
    historySync: 'history-sync',
    cleanup: 'cleanup',
  },
  jobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400, // 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 604800, // 7 days
    },
  },
};
