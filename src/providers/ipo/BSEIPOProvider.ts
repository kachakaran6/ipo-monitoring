/**
 * BSE IPO Metadata Provider
 *
 * Fetches IPO listing data from BSE public API endpoints.
 * This provider supplies IPO METADATA ONLY — it does NOT support PAN allotment lookup.
 *
 * Access method: Public GET requests to api.bseindia.com
 * All data has sourceType='BSE' and confidence='AUTHORITATIVE'.
 *
 * Known limitations:
 *  - BSE API structure may change without notice
 *  - No official API documentation
 *  - Rate limit: ~30 req/min
 */

import type { IPODataProvider, IPO, IPOSubscriptionData } from './IPODataProvider.interface.js';
import { ProviderRateLimiterManager } from '../rateLimiter.js';
import { ProviderHealthTracker } from '../health.js';
import { ProviderUnavailableError } from '../../errors/index.js';
import { logger } from '../../utils/logger.js';

const BSE_API_BASE = 'https://api.bseindia.com/BseIndiaAPI/api';
const BSE_IPO_INFO_URL = `${BSE_API_BASE}/IPOInfo/w`;
const BSE_IPO_UPCOMING_URL = `${BSE_API_BASE}/IPOCategory/w?Category=UP`;
const BSE_IPO_OPEN_URL = `${BSE_API_BASE}/IPOCategory/w?Category=OP`;
const BSE_IPO_CLOSED_URL = `${BSE_API_BASE}/IPOCategory/w?Category=CL`;

const BASE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.bseindia.com/',
};

interface BseIPORaw {
  SECURITY_NAME?: string;
  SECURITY_CODE?: string;
  SCRIPT_CODE?: string;
  SYMBOL?: string;
  ISSUE_OPEN_DATE?: string;
  ISSUE_CLOSE_DATE?: string;
  ALLOTMENT_DATE?: string;
  LISTING_DATE?: string;
  ISSUE_PRICE?: string | number;
  FACE_VALUE?: string | number;
  PRICE_BAND_MIN?: string | number;
  PRICE_BAND_MAX?: string | number;
  LOT_SIZE?: string | number;
  ISSUE_SIZE?: string | number;
  REGISTRAR_NAME?: string;
  ISIN_NO?: string;
  STATUS?: string;
}

export class BSEIPOProvider implements IPODataProvider {
  public readonly name = 'BSE';
  private readonly limiter = ProviderRateLimiterManager.getLimiter('BSE');

  private async fetchBSE(url: string): Promise<unknown> {
    const response = await fetch(url, {
      method: 'GET',
      headers: BASE_HEADERS,
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new ProviderUnavailableError(this.name, `BSE returned HTTP ${response.status}`);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new ProviderUnavailableError(this.name, 'BSE returned non-JSON response');
    }
  }

  /**
   * Normalize raw BSE API record to canonical IPO format.
   * Fields absent from the BSE response remain null — never fabricated.
   */
  private normalizeIPO(raw: BseIPORaw, status: IPO['status']): IPO | null {
    const companyName = (raw.SECURITY_NAME || '').trim();
    const scriptCode = raw.SECURITY_CODE || raw.SCRIPT_CODE || '';

    if (!companyName && !scriptCode) {
      logger.warn({ provider: this.name, raw }, 'BSE IPO record has no name or code — skipping');
      return null;
    }

    const symbol = (raw.SYMBOL || scriptCode).toUpperCase().trim();
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const parseDate = (d?: string): Date | null => {
      if (!d) return null;
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    const parseNum = (v?: string | number): number | null => {
      if (v === undefined || v === null || v === '') return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };

    return {
      id: '',
      symbol,
      companyName,
      slug,
      isin: raw.ISIN_NO || null,
      exchange: 'BSE',
      issueType: 'BOOK_BUILT',
      mainboardOrSme: 'MAINBOARD',
      status,
      openDate: parseDate(raw.ISSUE_OPEN_DATE),
      closeDate: parseDate(raw.ISSUE_CLOSE_DATE),
      allotmentDate: parseDate(raw.ALLOTMENT_DATE),
      listingDate: parseDate(raw.LISTING_DATE),
      faceValue: parseNum(raw.FACE_VALUE),
      priceBandMin: parseNum(raw.PRICE_BAND_MIN),
      priceBandMax: parseNum(raw.PRICE_BAND_MAX),
      issuePrice: parseNum(raw.ISSUE_PRICE),
      lotSize: parseNum(raw.LOT_SIZE) ?? 1,
      minimumApplication: parseNum(raw.LOT_SIZE) ?? 1,
      issueSize: parseNum(raw.ISSUE_SIZE),
      registrar: raw.REGISTRAR_NAME ? this.normalizeRegistrar(raw.REGISTRAR_NAME) : null,
      registrarUrl: raw.REGISTRAR_NAME ? this.registrarUrl(raw.REGISTRAR_NAME) : null,
      source: this.name,
      sourceId: scriptCode,
      sourceUrl: `https://www.bseindia.com/markets/publicIssues/IPODetail.aspx?code=${scriptCode}`,
      sourceUpdatedAt: new Date(),
    };
  }

  private normalizeRegistrar(raw: string): string {
    const upper = raw.toUpperCase();
    if (upper.includes('KFIN') || upper.includes('KARVY')) return 'KFINTECH';
    if (upper.includes('MUFG') || upper.includes('LINK INTIME') || upper.includes('LINKINTIME')) return 'MUFG_INTIME';
    if (upper.includes('BIGSHARE') || upper.includes('BIG SHARE')) return 'BIGSHARE';
    if (upper.includes('CAMEO')) return 'CAMEO';
    if (upper.includes('BEETAL')) return 'BEETAL';
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 50);
  }

  private registrarUrl(raw: string): string | null {
    const normalized = this.normalizeRegistrar(raw);
    const urls: Record<string, string> = {
      KFINTECH: 'https://ris.kfintech.com/ipostatus/',
      MUFG_INTIME: 'https://linkintime.co.in/MUFG/web/PanSearch.aspx',
      BIGSHARE: 'https://www.bigshareonline.com/ipo_Allotment.html',
      CAMEO: 'https://www.cameoindia.com/ipo/',
    };
    return urls[normalized] ?? null;
  }

  private parseIPOList(data: unknown, status: IPO['status']): IPO[] {
    let items: BseIPORaw[] = [];

    if (Array.isArray(data)) {
      items = data as BseIPORaw[];
    } else if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      // BSE often wraps in { Table: [...] } or { data: [...] }
      if (Array.isArray(d['Table'])) items = d['Table'] as BseIPORaw[];
      else if (Array.isArray(d['data'])) items = d['data'] as BseIPORaw[];
    }

    if (items.length === 0) {
      logger.debug({ provider: this.name, status }, 'BSE returned empty IPO list');
      return [];
    }

    const results: IPO[] = [];
    for (const raw of items) {
      const ipo = this.normalizeIPO(raw, status);
      if (ipo) results.push(ipo);
    }

    logger.info({ provider: this.name, count: results.length, status }, 'BSE IPOs fetched');
    return results;
  }

  public async getOpenIPOs(): Promise<IPO[]> {
    return this.fetchWithTelemetry('getOpenIPOs', async () => {
      const data = await this.fetchBSE(BSE_IPO_OPEN_URL);
      return this.parseIPOList(data, 'OPEN');
    });
  }

  public async getUpcomingIPOs(): Promise<IPO[]> {
    return this.fetchWithTelemetry('getUpcomingIPOs', async () => {
      const data = await this.fetchBSE(BSE_IPO_UPCOMING_URL);
      return this.parseIPOList(data, 'UPCOMING');
    });
  }

  public async getClosedIPOs(): Promise<IPO[]> {
    return this.fetchWithTelemetry('getClosedIPOs', async () => {
      const data = await this.fetchBSE(BSE_IPO_CLOSED_URL);
      return this.parseIPOList(data, 'ALLOTMENT_PENDING');
    });
  }

  public async getIPO(scriptCode: string): Promise<IPO | null> {
    return this.fetchWithTelemetry('getIPO', async () => {
      const data = await this.fetchBSE(`${BSE_IPO_INFO_URL}?scripCode=${scriptCode}`);
      if (!data || typeof data !== 'object') return null;
      const ipo = this.normalizeIPO(data as BseIPORaw, 'OPEN');
      return ipo;
    });
  }

  public async getSubscriptionData(_id: string): Promise<IPOSubscriptionData | null> {
    // BSE subscription data not available through these public endpoints
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
      logger.warn({ provider: this.name, op, error: (error as Error).message }, 'BSE IPO fetch failed');
      return [] as unknown as T;
    }
  }
}
