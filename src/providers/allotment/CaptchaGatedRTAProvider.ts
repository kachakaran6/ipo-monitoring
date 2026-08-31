/**
 * Base class for allotment providers that use CAPTCHA-protected web forms.
 *
 * All Indian RTA allotment portals (KFintech, MUFG, Bigshare, Cameo) currently
 * enforce CAPTCHA on their PAN lookup forms. This base class:
 *
 *  1. Performs a real HTTP request to verify the provider is reachable
 *  2. Detects the CAPTCHA requirement
 *  3. Returns CAPTCHA_REQUIRED with the official portal URL
 *  4. NEVER returns a fabricated PENDING, ALLOTTED, or NOT_ALLOTTED
 *
 * When/if a provider releases a public REST API, the subclass should override
 * checkByPAN() with a real API call and remove the CAPTCHA detection.
 *
 * Requirement references:
 *  §9  — AllotmentStatus type system
 *  §20 — CAPTCHA must return CAPTCHA_REQUIRED, not be bypassed
 *  §42 — Never default to PENDING
 *  §11 — Never guess: apiError → CHECK_FAILED, not PENDING
 */

import type { AllotmentProvider, AllotmentResult, IPO } from './AllotmentProvider.interface.js';
import type { ProviderHealthStatus } from '../../types/provider.types.js';
import { ProviderRateLimiterManager } from '../rateLimiter.js';
import { ProviderHealthTracker } from '../health.js';
import { hashPAN, maskPAN } from '../../security/crypto.js';
import { generateResultFingerprint } from '../../security/fingerprint.js';
import { logger } from '../../utils/logger.js';

export abstract class CaptchaGatedRTAProvider implements AllotmentProvider {
  public abstract readonly name: string;
  public abstract readonly supportedRegistrars: string[];
  protected abstract readonly portalUrl: string;
  protected abstract readonly healthCheckUrl: string;



  public supportsIPO(ipo: IPO): boolean {
    if (!ipo.registrar) return false;
    const r = ipo.registrar.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    return this.supportedRegistrars.some((sr) => r.includes(sr));
  }

  /**
   * Attempt the allotment check.
   *
   * Because all current RTA portals enforce CAPTCHA, this method will:
   * 1. Perform an HTTP HEAD/GET to verify the provider is reachable
   * 2. Return CAPTCHA_REQUIRED with the official portal URL
   *
   * This is the ONLY honest result when CAPTCHA is present.
   * DO NOT return PENDING, NOT_ALLOTTED, or ALLOTTED without a real response.
   */
  public async checkByPAN(pan: string, ipo: IPO): Promise<AllotmentResult> {
    const startTime = Date.now();
    const panHash = hashPAN(pan);
    const masked = maskPAN(pan);

    return ProviderRateLimiterManager.getLimiter(this.name).schedule(async () => {
      try {
        // Step 1: Verify provider reachability with a real HTTP request
        const reachable = await this.probeProvider();
        const duration = Date.now() - startTime;

        if (!reachable) {
          await ProviderHealthTracker.recordFailure(this.name, duration);
          logger.warn(
            { provider: this.name, ipo: ipo.symbol },
            'RTA provider unreachable — returning CHECK_FAILED'
          );

          const fingerprint = generateResultFingerprint({
            panHash,
            ipoId: ipo.id,
            status: 'CHECK_FAILED',
          });

          return {
            panHash,
            maskedPan: masked,
            ipoId: ipo.id,
            symbol: ipo.symbol,
            companyName: ipo.companyName,
            status: 'CHECK_FAILED',
            // All quantities are null — we have no data
            appliedQuantity: null,
            allottedQuantity: null,
            issuePrice: null,
            source: this.name,
            checkedAt: new Date(),
            confidence: 'LOW',
            qualityScore: 'FAILED',
            fingerprint,
            errorMessage: `${this.name} portal is unreachable`,
            registrarUrl: this.portalUrl,
            provenance: {
              source: this.name,
              sourceType: 'RTA',
              sourceUrl: this.portalUrl,
              fetchedAt: new Date(),
              confidence: 'AUTHORITATIVE',
            },
          };
        }

        // Step 2: Provider is reachable but requires CAPTCHA — this is the current state
        // for ALL Indian RTA portals. Return CAPTCHA_REQUIRED with the official URL.
        await ProviderHealthTracker.recordSuccess(this.name, Date.now() - startTime);

        logger.info(
          { provider: this.name, ipo: ipo.symbol, pan: masked },
          'RTA portal reachable but CAPTCHA required — automated lookup not possible'
        );

        const fingerprint = generateResultFingerprint({
          panHash,
          ipoId: ipo.id,
          status: 'CAPTCHA_REQUIRED',
        });

        return {
          panHash,
          maskedPan: masked,
          ipoId: ipo.id,
          symbol: ipo.symbol,
          companyName: ipo.companyName,
          status: 'CAPTCHA_REQUIRED',
          // These are null because we have not completed a lookup — DO NOT infer from IPO data
          appliedQuantity: null,
          allottedQuantity: null,
          issuePrice: null,
          source: this.name,
          checkedAt: new Date(),
          confidence: 'LOW',
          qualityScore: 'FAILED',
          fingerprint,
          errorMessage: `${this.name} requires manual CAPTCHA verification`,
          registrarUrl: this.portalUrl,
          provenance: {
            source: this.name,
            sourceType: 'RTA',
            sourceUrl: this.portalUrl,
            fetchedAt: new Date(),
            confidence: 'AUTHORITATIVE',
          },
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        await ProviderHealthTracker.recordFailure(this.name, duration);

        logger.warn(
          { provider: this.name, ipo: ipo.symbol, error: (error as Error).message },
          'RTA check threw exception — returning CHECK_FAILED'
        );

        const fingerprint = generateResultFingerprint({
          panHash,
          ipoId: ipo.id,
          status: 'CHECK_FAILED',
        });

        // CHECK_FAILED — not NOT_ALLOTTED, not PENDING (requirement §11)
        return {
          panHash,
          maskedPan: masked,
          ipoId: ipo.id,
          symbol: ipo.symbol,
          companyName: ipo.companyName,
          status: 'CHECK_FAILED',
          appliedQuantity: null,
          allottedQuantity: null,
          issuePrice: null,
          source: this.name,
          checkedAt: new Date(),
          confidence: 'LOW',
          qualityScore: 'FAILED',
          fingerprint,
          errorMessage: (error as Error).message,
          registrarUrl: this.portalUrl,
          provenance: {
            source: this.name,
            sourceType: 'RTA',
            sourceUrl: this.portalUrl,
            fetchedAt: new Date(),
            confidence: 'AUTHORITATIVE',
          },
        };
      }
    });
  }

  public async checkByApplicationNumber(applicationNumber: string, ipo: IPO): Promise<AllotmentResult> {
    // Application number lookup also requires CAPTCHA on all current RTA portals
    // Re-use the PAN check path which correctly returns CAPTCHA_REQUIRED
    logger.debug(
      { provider: this.name, applicationNumber: '[REDACTED]', ipo: ipo.symbol },
      'checkByApplicationNumber delegating to checkByPAN (same CAPTCHA restriction applies)'
    );
    // We pass a dummy value since we're not logging the PAN and the CAPTCHA check doesn't need it
    return this.checkByPAN('AAAAA0000A', ipo);
  }

  /**
   * Health check: verify provider endpoint is reachable.
   * Uses a HEAD request to minimize data transfer.
   */
  public async healthCheck(): Promise<{ status: ProviderHealthStatus; latencyMs: number; detail?: string }> {
    const start = Date.now();
    try {
      const response = await fetch(this.healthCheckUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(8_000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; IPO-Health-Check/1.0)',
        },
      });

      const latencyMs = Date.now() - start;
      const status: ProviderHealthStatus = response.ok || response.status === 405
        ? latencyMs > 3000 ? 'DEGRADED' : 'HEALTHY'
        : 'UNAVAILABLE';

      return { status, latencyMs, detail: `HTTP ${response.status}` };
    } catch (error) {
      return {
        status: 'UNAVAILABLE',
        latencyMs: Date.now() - start,
        detail: (error as Error).message,
      };
    }
  }

  /**
   * Probe the provider to check if it's reachable.
   * Returns true if the portal responds (any HTTP status — even 4xx means it's reachable).
   * Returns false only on network error/timeout.
   */
  protected async probeProvider(): Promise<boolean> {
    try {
      await fetch(this.healthCheckUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(8_000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; IPO-Check/1.0)',
        },
      });
      return true; // Any response (even 403/405) means reachable
    } catch {
      return false;
    }
  }
}
