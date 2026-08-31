/**
 * NSE IPO Metadata Provider
 *
 * Fetches IPO listing data from NSE public endpoints.
 * This provider supplies IPO METADATA ONLY — it does NOT support PAN allotment lookup.
 *
 * Access method: Session-cookie-based GET requests to nseindia.com/api/
 * All data returned has sourceType='NSE' and confidence='AUTHORITATIVE'.
 *
 * Known limitations:
 *  - Requires a session cookie (`nsit`) obtained from the NSE homepage
 *  - Cookie expires periodically and must be refreshed
 *  - API is not officially documented; structure may change
 *  - Rate limit: ~30 req/min before soft-blocking
 */

import type { IPODataProvider, IPO, IPOSubscriptionData } from './IPODataProvider.interface.js';
import { ProviderRateLimiterManager } from '../rateLimiter.js';
import { ProviderHealthTracker } from '../health.js';
import { ProviderUnavailableError } from '../../errors/index.js';
import { logger } from '../../utils/logger.js';

// ──────────────────────────────────────────────────────────────────
// NSE API Endpoints (public, session-gated)
// ──────────────────────────────────────────────────────────────────
const NSE_BASE = 'https://www.nseindia.com';
const NSE_SESSION_URL = `${NSE_BASE}/`;
const NSE_IPO_ALLOTMENT_URL = `${NSE_BASE}/api/ipo-current-allotment`;
const NSE_IPO_UPCOMING_URL = `${NSE_BASE}/api/allotmentAndListingDate`;

// Session cookie lifetime: refresh if older than 45 minutes
const SESSION_TTL_MS = 45 * 60 * 1000;

const BASE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: NSE_BASE + '/',
  'X-Requested-With': 'XMLHttpRequest',
};

interface NseIPORaw {
  symbol?: string;
  companyName?: string;
  series?: string;
  openDate?: string;
  closeDate?: string;
  allotmentDate?: string;
  listingDate?: string;
  issuePrice?: string | number;
  priceBandMin?: string | number;
  priceBandMax?: string | number;
  lotSize?: string | number;
  faceValue?: string | number;
  issueSize?: string | number;
  registrar?: string;
  status?: string;
  isin?: string;
}

export class NSEIPOProvider implements IPODataProvider {
  public readonly name = 'NSE';
  private readonly limiter = ProviderRateLimiterManager.getLimiter('NSE');

  /** Session cookie refreshed from NSE homepage */
  private sessionCookie: string = '';
  private sessionFetchedAt: number = 0;

  // ──────────────────────────────────────────────────────────────────
  // Session Management
  // ──────────────────────────────────────────────────────────────────

  private sessionIsValid(): boolean {
    return (
      this.sessionCookie.length > 0 &&
      Date.now() - this.sessionFetchedAt < SESSION_TTL_MS
    );
  }

  /**
   * Obtain a fresh `nsit` session cookie from the NSE homepage.
   * This is required before any API call — NSE validates the session server-side.
   */
  private async refreshSession(): Promise<void> {
    try {
      const response = await fetch(NSE_SESSION_URL, {
        method: 'GET',
        headers: {
          'User-Agent': BASE_HEADERS['User-Agent'],
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(10_000),
      });

      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        // Extract nsit cookie specifically
        const nsitMatch = setCookieHeader.match(/nsit=([^;]+)/);
        const nseappdMatch = setCookieHeader.match(/nseappid=([^;]+)/);
        const parts: string[] = [];
        if (nsitMatch) parts.push(`nsit=${nsitMatch[1]}`);
        if (nseappdMatch) parts.push(`nseappid=${nseappdMatch[1]}`);
        if (parts.length > 0) {
          this.sessionCookie = parts.join('; ');
          this.sessionFetchedAt = Date.now();
          logger.debug({ provider: this.name }, 'NSE session cookie refreshed');
          return;
        }
      }

      // If we can't get a session cookie, log but continue — some endpoints may not need it
      logger.warn({ provider: this.name }, 'Could not extract NSE session cookie from homepage');
    } catch (error) {
      logger.warn(
        { provider: this.name, error: (error as Error).message },
        'Failed to refresh NSE session — proceeding without cookie'
      );
    }
  }

  private async fetchNSE(url: string): Promise<unknown> {
    if (!this.sessionIsValid()) {
      await this.refreshSession();
    }

    const headers: Record<string, string> = { ...BASE_HEADERS };
    if (this.sessionCookie) {
      headers['Cookie'] = this.sessionCookie;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      // NSE returns 403/503 when session has expired or rate limit hit
      if (response.status === 401 || response.status === 403) {
        // Invalidate session and retry once
        this.sessionCookie = '';
        this.sessionFetchedAt = 0;
        throw new ProviderUnavailableError(this.name, `NSE returned ${response.status} — session may have expired`);
      }
      throw new ProviderUnavailableError(this.name, `NSE returned HTTP ${response.status}`);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new ProviderUnavailableError(this.name, 'NSE returned non-JSON response');
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // IPO Data Normalisation
  // ──────────────────────────────────────────────────────────────────

  /**
   * Maps a raw NSE API record to the canonical IPO format.
   * Any field not explicitly provided by NSE remains undefined/null — NEVER inferred.
   */
  private normalizeIPO(raw: NseIPORaw, status: IPO['status']): IPO | null {
    // symbol and companyName are required
    if (!raw.symbol && !raw.companyName) {
      logger.warn({ provider: this.name, raw }, 'NSE IPO record missing symbol and companyName — skipping');
      return null;
    }

    const symbol = (raw.symbol || '').toUpperCase().trim();
    const companyName = (raw.companyName || '').trim();
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const sourceId = raw.series || symbol; // NSE series ID or symbol as fallback

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
      id: '', // Will be set by DB after insert
      symbol,
      companyName,
      slug,
      isin: raw.isin || null,
      exchange: 'NSE',
      issueType: 'BOOK_BUILT', // NSE mainboard is always book-built unless noted
      mainboardOrSme: 'MAINBOARD',
      status,
      openDate: parseDate(raw.openDate),
      closeDate: parseDate(raw.closeDate),
      allotmentDate: parseDate(raw.allotmentDate),
      listingDate: parseDate(raw.listingDate),
      faceValue: parseNum(raw.faceValue),
      priceBandMin: parseNum(raw.priceBandMin),
      priceBandMax: parseNum(raw.priceBandMax),
      issuePrice: parseNum(raw.issuePrice),
      lotSize: parseNum(raw.lotSize) ?? 1,
      minimumApplication: parseNum(raw.lotSize) ?? 1,
      issueSize: parseNum(raw.issueSize),
      registrar: raw.registrar ? this.normalizeRegistrar(raw.registrar) : null,
      registrarUrl: raw.registrar ? this.registrarUrl(raw.registrar) : null,
      source: this.name,
      sourceId,
      sourceUrl: `${NSE_BASE}/market-data/ipo#`,
      sourceUpdatedAt: new Date(),
    };
  }

  /**
   * Normalize raw registrar name from NSE to canonical form used in the system.
   * NSE may return "KFin Technologies Limited" — we normalize to 'KFINTECH'.
   */
  private normalizeRegistrar(raw: string): string {
    const upper = raw.toUpperCase();
    if (upper.includes('KFIN') || upper.includes('KARVY')) return 'KFINTECH';
    if (upper.includes('MUFG') || upper.includes('LINK INTIME') || upper.includes('LINKINTIME')) return 'MUFG_INTIME';
    if (upper.includes('BIGSHARE') || upper.includes('BIG SHARE')) return 'BIGSHARE';
    if (upper.includes('CAMEO')) return 'CAMEO';
    if (upper.includes('BEETAL')) return 'BEETAL';
    if (upper.includes('MAASHITLA')) return 'MAASHITLA';
    // Return a sanitized version if unknown — do not invent a mapping
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 50);
  }

  /**
   * Return the canonical allotment portal URL for a given registrar string.
   * Only returns URLs for known, verified registrar portals.
   */
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

  // ──────────────────────────────────────────────────────────────────
  // IPODataProvider interface implementation
  // ──────────────────────────────────────────────────────────────────

  public async getOpenIPOs(): Promise<IPO[]> {
    return this.fetchWithTelemetry('getOpenIPOs', async () => {
      const data = await this.fetchNSE(NSE_IPO_ALLOTMENT_URL);
      return this.parseIPOList(data, 'OPEN');
    });
  }

  public async getUpcomingIPOs(): Promise<IPO[]> {
    return this.fetchWithTelemetry('getUpcomingIPOs', async () => {
      const data = await this.fetchNSE(NSE_IPO_UPCOMING_URL);
      return this.parseIPOList(data, 'UPCOMING');
    });
  }

  public async getClosedIPOs(): Promise<IPO[]> {
    return this.fetchWithTelemetry('getClosedIPOs', async () => {
      // NSE current-allotment endpoint also covers recently closed IPOs
      const data = await this.fetchNSE(NSE_IPO_ALLOTMENT_URL);
      return this.parseIPOList(data, 'ALLOTMENT_PENDING');
    });
  }

  public async getIPO(symbol: string): Promise<IPO | null> {
    // NSE does not have a per-IPO lookup endpoint; search from the full list
    const all = await this.getOpenIPOs();
    return all.find((i) => i.symbol === symbol.toUpperCase()) ?? null;
  }

  public async getSubscriptionData(_id: string): Promise<IPOSubscriptionData | null> {
    // Subscription data is not available through these NSE endpoints
    return null;
  }

  private parseIPOList(data: unknown, defaultStatus: IPO['status']): IPO[] {
    if (!Array.isArray(data)) {
      // NSE may wrap in { data: [...] }
      if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>)['data'])) {
        data = (data as Record<string, unknown>)['data'];
      } else {
        logger.warn({ provider: this.name }, 'NSE API returned unexpected format — expected array');
        return [];
      }
    }

    const results: IPO[] = [];
    for (const raw of data as NseIPORaw[]) {
      const ipo = this.normalizeIPO(raw, defaultStatus);
      if (ipo) results.push(ipo);
    }

    logger.info({ provider: this.name, count: results.length, status: defaultStatus }, 'NSE IPOs fetched');
    return results;
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
      // Return empty rather than throwing — IPO sync is best-effort
      return [] as unknown as T;
    }
  }
}
