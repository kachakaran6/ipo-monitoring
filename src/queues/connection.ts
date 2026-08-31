import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  connectTimeout: 2000,
  password: env.REDIS_PASSWORD || undefined,
  retryStrategy(times) {
    if (env.NODE_ENV === 'test') {
      return null; // Stop retrying in tests if Redis is offline
    }
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
});

redisClient.on('error', (err) => {
  if (env.NODE_ENV !== 'test') {
    logger.warn({ error: err.message }, 'Redis connection error');
  }
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis server');
});

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const res = await Promise.race([
      redisClient.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000)),
    ]);
    return res === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedisConnection(): Promise<void> {
  try {
    if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
      await redisClient.quit();
    }
  } catch {
    // Non-blocking
  }
}
