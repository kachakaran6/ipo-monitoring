import Bottleneck from 'bottleneck';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Isolated rate limiters per external provider to ensure compliance and avoid blocking.
 */
export class ProviderRateLimiterManager {
  private static limiters: Map<string, Bottleneck> = new Map();

  public static getLimiter(providerName: string): Bottleneck {
    const key = providerName.toUpperCase();
    if (this.limiters.has(key)) {
      return this.limiters.get(key)!;
    }

    let minTimeMs = 2000; // default 30 req/min

    switch (key) {
      case 'NSE':
        minTimeMs = Math.floor(60000 / env.LIMITER_NSE_RPM);
        break;
      case 'BSE':
        minTimeMs = Math.floor(60000 / env.LIMITER_BSE_RPM);
        break;
      case 'MUFG_INTIME':
      case 'LINKINTIME':
        minTimeMs = Math.floor(60000 / env.LIMITER_MUFG_RPM);
        break;
      case 'KFINTECH':
        minTimeMs = Math.floor(60000 / env.LIMITER_KFINTECH_RPM);
        break;
      case 'BIGSHARE':
        minTimeMs = Math.floor(60000 / env.LIMITER_BIGSHARE_RPM);
        break;
      case 'UPSTOX':
        minTimeMs = Math.floor(60000 / env.LIMITER_UPSTOX_RPM);
        break;
      case 'TELEGRAM':
        minTimeMs = 50; // Telegram Bot API allows ~30 msgs/sec
        break;
      case 'PUSHOVER':
        minTimeMs = 100;
        break;
    }

    const limiter = new Bottleneck({
      minTime: minTimeMs,
      maxConcurrent: 2,
    });

    limiter.on('failed', (error, jobInfo) => {
      logger.warn(
        { provider: key, retryCount: jobInfo.retryCount, error: error.message },
        `Rate limited job failed for provider ${key}`
      );
    });

    this.limiters.set(key, limiter);
    return limiter;
  }
}
