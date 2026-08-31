import type { IPODataProvider, IPO, IPOSubscriptionData } from './IPODataProvider.interface.js';
import { env } from '../../config/env.js';
import { ProviderRateLimiterManager } from '../rateLimiter.js';
import { ProviderHealthTracker } from '../health.js';
import { logger } from '../../utils/logger.js';

export class LicensedIPOProvider implements IPODataProvider {
  public readonly name = 'LICENSED_DATA_FEED';
  private readonly limiter = ProviderRateLimiterManager.getLimiter('NSE');

  public async getUpcomingIPOs(): Promise<IPO[]> {
    return this.fetchWithTelemetry('getUpcomingIPOs', async () => {
      if (!env.IPO_GURU_API_KEY && !env.IPO_NOTIFY_API_KEY) return [];
      return [];
    });
  }

  public async getOpenIPOs(): Promise<IPO[]> {
    return this.fetchWithTelemetry('getOpenIPOs', async () => {
      if (!env.IPO_GURU_API_KEY && !env.IPO_NOTIFY_API_KEY) return [];
      return [];
    });
  }

  public async getClosedIPOs(): Promise<IPO[]> {
    return this.fetchWithTelemetry('getClosedIPOs', async () => {
      if (!env.IPO_GURU_API_KEY && !env.IPO_NOTIFY_API_KEY) return [];
      return [];
    });
  }

  public async getIPO(_id: string): Promise<IPO | null> {
    return this.fetchWithTelemetry('getIPO', async () => null);
  }

  public async getSubscriptionData(_id: string): Promise<IPOSubscriptionData | null> {
    return this.fetchWithTelemetry('getSubscriptionData', async () => null);
  }

  private async fetchWithTelemetry<T>(op: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await this.limiter.schedule(fn);
      const latency = Date.now() - startTime;
      await ProviderHealthTracker.recordSuccess(this.name, latency);
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      await ProviderHealthTracker.recordFailure(this.name, latency);
      logger.warn({ provider: this.name, op, error: (error as Error).message }, 'Licensed provider call failed');
      return [] as unknown as T;
    }
  }
}
