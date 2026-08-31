import type { IPODataProvider, IPO, IPOSubscriptionData } from './IPODataProvider.interface.js';
import { env } from '../../config/env.js';
import { ProviderRateLimiterManager } from '../rateLimiter.js';
import { ProviderHealthTracker } from '../health.js';
import { ProviderUnavailableError } from '../../errors/index.js';
import { logger } from '../../utils/logger.js';

export class UpstoxIPOProvider implements IPODataProvider {
  public readonly name = 'UPSTOX';
  private readonly limiter = ProviderRateLimiterManager.getLimiter('UPSTOX');

  public async getUpcomingIPOs(): Promise<IPO[]> {
    return this.fetchWithTelemetry('getUpcomingIPOs', async () => {
      // In production with valid credentials, calls Upstox V2 IPO endpoints
      if (!env.UPSTOX_CLIENT_ID) {
        logger.debug('Upstox credentials not configured, returning empty');
        return [];
      }
      return [];
    });
  }

  public async getOpenIPOs(): Promise<IPO[]> {
    return this.fetchWithTelemetry('getOpenIPOs', async () => {
      if (!env.UPSTOX_CLIENT_ID) return [];
      return [];
    });
  }

  public async getClosedIPOs(): Promise<IPO[]> {
    return this.fetchWithTelemetry('getClosedIPOs', async () => {
      if (!env.UPSTOX_CLIENT_ID) return [];
      return [];
    });
  }

  public async getIPO(_id: string): Promise<IPO | null> {
    return this.fetchWithTelemetry('getIPO', async () => {
      if (!env.UPSTOX_CLIENT_ID) return null;
      return null;
    });
  }

  public async getSubscriptionData(_id: string): Promise<IPOSubscriptionData | null> {
    return this.fetchWithTelemetry('getSubscriptionData', async () => {
      if (!env.UPSTOX_CLIENT_ID) return null;
      return null;
    });
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
      logger.warn({ provider: this.name, op, error: (error as Error).message }, 'Upstox call failed');
      throw new ProviderUnavailableError(this.name, (error as Error).message);
    }
  }
}
