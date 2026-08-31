import type { IPODataProvider, IPO, IPOSubscriptionData } from './IPODataProvider.interface.js';
import { UpstoxIPOProvider } from './UpstoxIPOProvider.js';
import { LicensedIPOProvider } from './LicensedIPOProvider.js';
import { MockIPOProvider } from './MockIPOProvider.js';
import { logger } from '../../utils/logger.js';

export class IPOProviderRegistry {
  private providers: IPODataProvider[] = [];

  constructor() {
    // Priority order: Upstox -> Licensed -> Mock
    this.providers.push(new UpstoxIPOProvider());
    this.providers.push(new LicensedIPOProvider());
    this.providers.push(new MockIPOProvider());
  }

  public registerProvider(provider: IPODataProvider, highPriority: boolean = false): void {
    if (highPriority) {
      this.providers.unshift(provider);
    } else {
      this.providers.push(provider);
    }
  }

  public async getOpenIPOs(): Promise<IPO[]> {
    for (const provider of this.providers) {
      try {
        const ipos = await provider.getOpenIPOs();
        if (ipos && ipos.length > 0) {
          logger.debug({ provider: provider.name, count: ipos.length }, 'Retrieved open IPOs');
          return ipos;
        }
      } catch (error) {
        logger.debug({ provider: provider.name, error: (error as Error).message }, 'Provider failed for getOpenIPOs');
      }
    }
    return [];
  }

  public async getUpcomingIPOs(): Promise<IPO[]> {
    for (const provider of this.providers) {
      try {
        const ipos = await provider.getUpcomingIPOs();
        if (ipos && ipos.length > 0) {
          return ipos;
        }
      } catch (error) {
        logger.debug({ provider: provider.name, error: (error as Error).message }, 'Provider failed for getUpcomingIPOs');
      }
    }
    return [];
  }

  public async getClosedIPOs(): Promise<IPO[]> {
    for (const provider of this.providers) {
      try {
        const ipos = await provider.getClosedIPOs();
        if (ipos && ipos.length > 0) {
          return ipos;
        }
      } catch (error) {
        logger.debug({ provider: provider.name, error: (error as Error).message }, 'Provider failed for getClosedIPOs');
      }
    }
    return [];
  }

  public async getSubscriptionData(ipoId: string): Promise<IPOSubscriptionData | null> {
    for (const provider of this.providers) {
      try {
        const sub = await provider.getSubscriptionData(ipoId);
        if (sub) return sub;
      } catch (error) {
        logger.debug({ provider: provider.name, ipoId, error: (error as Error).message }, 'Failed to get subscription data');
      }
    }
    return null;
  }
}

export const ipoProviderRegistry = new IPOProviderRegistry();
