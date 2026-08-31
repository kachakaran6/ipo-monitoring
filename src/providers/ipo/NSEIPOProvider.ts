/**
 * NSE IPO Metadata Provider
 *
 * Fetches real, authoritative IPO listing data from the National Stock Exchange (NSE)
 * using the `nse-bse-api` client which handles NSE session management, cookies, and headers.
 *
 * This provider supplies IPO METADATA ONLY — it does NOT support PAN allotment lookup.
 * All data returned has sourceType='NSE' and confidence='AUTHORITATIVE'.
 */

import { NSE } from 'nse-bse-api';
import path from 'node:path';
import type { IPODataProvider, IPO, IPOSubscriptionData } from './IPODataProvider.interface.js';
import { ProviderRateLimiterManager } from '../rateLimiter.js';
import { ProviderHealthTracker } from '../health.js';
import { logger } from '../../utils/logger.js';

interface RawNseIpo {
  companyName?: string;
  company?: string;
  symbol?: string;
  series?: string;
  securityType?: string;
  status?: string;
  issueStartDate?: string;
  ipoStartDate?: string;
  issueEndDate?: string;
  ipoEndDate?: string;
  listingDate?: string;
  issuePrice?: string | number;
  priceRange?: string;
  issueSize?: string | number;
  isBse?: string;
  noOfSharesOffered?: string | number;
  noOfsharesBid?: string | number;
  noOfTime?: string | number;
}

export class NSEIPOProvider implements IPODataProvider {
  public readonly name = 'NSE';
  private readonly limiter = ProviderRateLimiterManager.getLimiter('NSE');
  private nseClient: NSE;

  constructor() {
    const downloadDir = path.resolve(process.cwd(), 'downloads');
    this.nseClient = new NSE(downloadDir);
  }

  // ──────────────────────────────────────────────────────────────────
  // Normalization Helpers
  // ──────────────────────────────────────────────────────────────────

  private parseDate(d?: string): Date | null {
    if (!d || d === '-' || d.trim() === '') return null;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  private parsePriceInfo(priceStr?: string | number): { min?: number | null; max?: number | null; final?: number | null } {
    if (priceStr === undefined || priceStr === null || priceStr === '-') return { min: null, max: null, final: null };

    if (typeof priceStr === 'number') {
      return { min: priceStr, max: priceStr, final: priceStr };
    }

    const str = String(priceStr).replace(/Rs\.?/gi, '').trim();
    // Format: "546 to 575" or "546 - 575"
    const rangeMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)/i);
    if (rangeMatch) {
      return {
        min: Number(rangeMatch[1]),
        max: Number(rangeMatch[2]),
        final: Number(rangeMatch[2]), // Cut-off price is upper band
      };
    }

    const singleNum = Number(str);
    if (!isNaN(singleNum) && singleNum > 0) {
      return { min: singleNum, max: singleNum, final: singleNum };
    }

    return { min: null, max: null, final: null };
  }

  private normalizeIPO(raw: RawNseIpo, defaultStatus: IPO['status']): IPO | null {
    const companyName = (raw.companyName || raw.company || '').trim();
    const symbol = (raw.symbol || '').toUpperCase().trim();

    if (!symbol && !companyName) {
      return null;
    }

    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || symbol.toLowerCase();
    const seriesType = (raw.series || raw.securityType || 'EQ').toUpperCase();
    const isSme = seriesType.includes('SME');
    const exchange = raw.isBse === '1' ? 'BOTH' : 'NSE';

    const rawPrice = raw.issuePrice !== '-' && raw.issuePrice ? raw.issuePrice : raw.priceRange;
    const priceInfo = this.parsePriceInfo(rawPrice);

    const openDate = this.parseDate(raw.issueStartDate || raw.ipoStartDate);
    const closeDate = this.parseDate(raw.issueEndDate || raw.ipoEndDate);
    const listingDate = this.parseDate(raw.listingDate);

    // Calculate dynamic status based on dates if available
    let status = defaultStatus;
    const now = new Date();
    if (closeDate && now > closeDate) {
      status = listingDate && now > listingDate ? 'LISTED' : 'ALLOTMENT_PENDING';
    } else if (openDate && now < openDate) {
      status = 'UPCOMING';
    } else if (openDate && closeDate && now >= openDate && now <= closeDate) {
      status = 'OPEN';
    }

    return {
      id: '',
      symbol: symbol || slug.toUpperCase(),
      companyName: companyName || symbol,
      slug,
      exchange,
      issueType: priceInfo.min && priceInfo.max && priceInfo.min !== priceInfo.max ? 'BOOK_BUILT' : 'FIXED_PRICE',
      mainboardOrSme: isSme ? 'SME' : 'MAINBOARD',
      status,
      openDate,
      closeDate,
      listingDate,
      priceBandMin: priceInfo.min,
      priceBandMax: priceInfo.max,
      issuePrice: priceInfo.final,
      lotSize: 1,
      minimumApplication: 1,
      issueSize: raw.issueSize ? Number(raw.issueSize) : null,
      source: this.name,
      sourceId: symbol,
      sourceUrl: 'https://www.nseindia.com/market-data/all-upcoming-issues-ipo',
      sourceUpdatedAt: new Date(),
    };
  }

  // ──────────────────────────────────────────────────────────────────
  // IPODataProvider interface implementation
  // ──────────────────────────────────────────────────────────────────

  public async getOpenIPOs(): Promise<IPO[]> {
    return this.fetchWithTelemetry('getOpenIPOs', async () => {
      const current = await this.nseClient.ipo.listCurrentIPO();
      if (!Array.isArray(current)) return [];
      const results: IPO[] = [];
      for (const item of current) {
        const ipo = this.normalizeIPO(item, 'OPEN');
        if (ipo) results.push(ipo);
      }
      return results;
    });
  }

  public async getUpcomingIPOs(): Promise<IPO[]> {
    return this.fetchWithTelemetry('getUpcomingIPOs', async () => {
      const upcoming = await this.nseClient.ipo.listUpcomingIPO();
      if (!Array.isArray(upcoming)) return [];
      const results: IPO[] = [];
      for (const item of upcoming) {
        const ipo = this.normalizeIPO(item, 'UPCOMING');
        if (ipo) results.push(ipo);
      }
      return results;
    });
  }

  public async getClosedIPOs(): Promise<IPO[]> {
    return this.fetchWithTelemetry('getClosedIPOs', async () => {
      // Pull recent past IPOs from the last 90 days
      const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const toDate = new Date();
      const past = await this.nseClient.ipo.listPastIPO(fromDate, toDate);
      if (!Array.isArray(past)) return [];
      const results: IPO[] = [];
      for (const item of past) {
        const ipo = this.normalizeIPO(item, 'ALLOTMENT_PENDING');
        if (ipo) results.push(ipo);
      }
      return results;
    });
  }

  public async getIPO(symbol: string): Promise<IPO | null> {
    const open = await this.getOpenIPOs();
    const match = open.find((i) => i.symbol.toUpperCase() === symbol.toUpperCase());
    if (match) return match;

    const upcoming = await this.getUpcomingIPOs();
    return upcoming.find((i) => i.symbol.toUpperCase() === symbol.toUpperCase()) ?? null;
  }

  public async getSubscriptionData(_id: string): Promise<IPOSubscriptionData | null> {
    return null;
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
      logger.warn({ provider: this.name, op, error: (error as Error).message }, 'NSE IPO fetch failed');
      return [] as unknown as T;
    }
  }
}
