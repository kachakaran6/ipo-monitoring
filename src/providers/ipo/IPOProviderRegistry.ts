/**
 * IPO Provider Registry
 *
 * Maintains the set of authoritative IPO metadata providers.
 * Results from all providers are merged and deduplicated by ISIN/symbol.
 *
 * REAL-DATA-ONLY rule:
 *  - MockIPOProvider is NEVER registered here.
 *  - If all providers return empty, returns [] — never falls back to mock data.
 *  - Every IPO that enters the system must have sourceId and sourceUrl from a real provider.
 */

import type { IPODataProvider, IPO, IPOSubscriptionData } from './IPODataProvider.interface.js';
import { NSEIPOProvider } from './NSEIPOProvider.js';
import { BSEIPOProvider } from './BSEIPOProvider.js';
import { UpstoxIPOProvider } from './UpstoxIPOProvider.js';
import { LicensedIPOProvider } from './LicensedIPOProvider.js';
import { logger } from '../../utils/logger.js';

export class IPOProviderRegistry {
  private providers: IPODataProvider[] = [];

  constructor() {
    // Priority: NSE + BSE (public, authoritative) → Upstox (if credentials available) → Licensed feed
    // MockIPOProvider is NEVER added here — it violates the real-data-only requirement.
    this.providers.push(new NSEIPOProvider());
    this.providers.push(new BSEIPOProvider());
    this.providers.push(new UpstoxIPOProvider());
    this.providers.push(new LicensedIPOProvider());

    logger.info(
      { providers: this.providers.map((p) => p.name) },
      'IPOProviderRegistry initialized — real providers only'
    );
  }

  public registerProvider(provider: IPODataProvider): void {
    this.providers.push(provider);
  }

  /**
   * Fetch open IPOs from ALL providers and merge results.
   * Deduplicated by symbol (first-seen wins).
   * If all providers fail or return empty, returns [] — never fabricates.
   */
  public async getOpenIPOs(): Promise<IPO[]> {
    return this.mergeFromAllProviders('getOpenIPOs');
  }

  public async getUpcomingIPOs(): Promise<IPO[]> {
    return this.mergeFromAllProviders('getUpcomingIPOs');
  }

  public async getClosedIPOs(): Promise<IPO[]> {
    return this.mergeFromAllProviders('getClosedIPOs');
  }

  public async getSubscriptionData(ipoId: string): Promise<IPOSubscriptionData | null> {
    for (const provider of this.providers) {
      try {
        const sub = await provider.getSubscriptionData(ipoId);
        if (sub) return sub;
      } catch (error) {
        logger.debug(
          { provider: provider.name, ipoId, error: (error as Error).message },
          'Failed to get subscription data'
        );
      }
    }
    return null;
  }

  /**
   * Queries all providers and merges results, deduplicating by symbol.
   * NSE takes precedence over BSE for dual-listed IPOs (NSE is primary exchange).
   * Returns [] if no provider returns any data — NEVER creates synthetic records.
   */
  private async mergeFromAllProviders(method: 'getOpenIPOs' | 'getUpcomingIPOs' | 'getClosedIPOs'): Promise<IPO[]> {
    const seen = new Set<string>(); // dedup by symbol
    const merged: IPO[] = [];

    for (const provider of this.providers) {
      try {
        const ipos: IPO[] = await (provider[method] as () => Promise<IPO[]>)();
        for (const ipo of ipos) {
          const key = ipo.symbol.toUpperCase();
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(ipo);
          } else {
            // If already seen from NSE and this is from BSE, update exchange to 'BOTH'
            const existing = merged.find((i) => i.symbol.toUpperCase() === key);
            if (existing && existing.exchange !== ipo.exchange) {
              existing.exchange = 'BOTH';
            }
          }
        }
      } catch (error) {
        logger.warn(
          { provider: provider.name, method, error: (error as Error).message },
          'Provider failed — skipping, other providers may still have data'
        );
      }
    }

    logger.info({ method, totalMerged: merged.length }, 'IPO provider registry merge complete');
    return merged;
  }
}

export const ipoProviderRegistry = new IPOProviderRegistry();
