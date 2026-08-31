/**
 * AllotmentEngine
 *
 * Orchestrates allotment checking across all registered providers.
 * Enforces the real-data-only invariants at the engine level.
 *
 * Key guarantees:
 *  - Provider selection is based on IPO's registrar — never random
 *  - No provider → UNSUPPORTED (not CHECK_FAILED, not PENDING)
 *  - Technical failure → CHECK_FAILED
 *  - All quantities remain null unless a real source provides them
 *  - CheckCoverage is tracked and returned for every check
 *
 * Requirement references:
 *  §8  — AllotmentProvider contract
 *  §17 — canCheckAllotment() pre-flight
 *  §18 — Provider adapters
 *  §28 — CheckCoverage
 *  §31 — ProviderRegistry
 */

import type { AllotmentProvider, AllotmentResult, IPO } from './AllotmentProvider.interface.js';
import type { CheckCoverage } from '../../types/allotment.types.js';
import { MUFGIntimeProvider } from './MUFGIntimeProvider.js';
import { KFintechProvider } from './KFintechProvider.js';
import { BigshareProvider } from './BigshareProvider.js';
import { NSEAllotmentProvider } from './NSEAllotmentProvider.js';
import { BSEAllotmentProvider } from './BSEAllotmentProvider.js';
import { db } from '../../db/index.js';
import { allotmentChecks } from '../../db/schema.js';
import { hashPAN, maskPAN } from '../../security/crypto.js';
import { generateResultFingerprint } from '../../security/fingerprint.js';
import { withRetry } from '../../utils/retry.js';
import { logger } from '../../utils/logger.js';
import {
  ProviderCaptchaRequiredError,
  ProviderRateLimitError,
  ProviderUnavailableError,
} from '../../errors/index.js';

export interface AllotmentEngineResult {
  result: AllotmentResult;
  provider: string;
}

export class AllotmentEngine {
  private providers: AllotmentProvider[] = [];

  constructor() {
    /**
     * Provider registry — order matters for registrar matching.
     * RTA providers (KFintech, MUFG, Bigshare) must come before exchange providers (NSE, BSE).
     * Exchange providers are last-resort and return UNSUPPORTED for allotment queries.
     */
    this.providers = [
      new KFintechProvider(),
      new MUFGIntimeProvider(),
      new BigshareProvider(),
      new NSEAllotmentProvider(),
      new BSEAllotmentProvider(),
    ];

    logger.info(
      { providers: this.providers.map((p) => p.name) },
      'AllotmentEngine initialized — real providers only, no mock'
    );
  }

  public registerProvider(provider: AllotmentProvider, highPriority: boolean = false): void {
    if (highPriority) {
      this.providers.unshift(provider);
    } else {
      this.providers.push(provider);
    }
  }

  /**
   * Select the best provider for an IPO based on its registrar.
   *
   * Selection priority:
   *  1. Registrar-specific RTA provider (KFintech, MUFG, Bigshare)
   *  2. Exchange-level provider (NSE/BSE) as fallback — returns UNSUPPORTED
   *  3. null if no provider can handle this at all
   */
  public selectProvider(ipo: IPO): AllotmentProvider | null {
    // 1. Registrar match — most authoritative
    if (ipo.registrar) {
      for (const provider of this.providers) {
        if (provider.supportsIPO(ipo)) {
          return provider;
        }
      }
    }

    // 2. Exchange fallback — returns UNSUPPORTED explicitly
    for (const provider of this.providers) {
      if (provider.name === 'NSE' || provider.name === 'BSE') {
        if (provider.supportsIPO(ipo)) {
          logger.debug(
            { ipo: ipo.symbol, registrar: ipo.registrar },
            'No registrar match — falling back to exchange provider (will return UNSUPPORTED)'
          );
          return provider;
        }
      }
    }

    return null;
  }

  /**
   * Validates whether allotment checking is possible/appropriate for this IPO.
   * Returns null if OK to proceed, or a reason string if not.
   */
  public canCheckAllotment(ipo: IPO): string | null {
    if (!ipo.id) return 'IPO ID is missing';
    if (!ipo.symbol) return 'IPO symbol is missing';
    if (!ipo.companyName) return 'IPO company name is missing';

    const checkableStatuses: IPO['status'][] = ['CLOSED', 'ALLOTMENT_PENDING', 'ALLOTTED', 'LISTED'];
    if (!checkableStatuses.includes(ipo.status)) {
      return `IPO is in status '${ipo.status}' — allotment checking is not yet applicable`;
    }

    return null; // OK to proceed
  }

  /**
   * Execute allotment verification for a single PAN + IPO combination.
   *
   * This is the single source of truth for allotment checking — both single-PAN
   * and bulk checks MUST call this method. No separate simplified implementation.
   */
  public async checkAllotment(pan: string, ipo: IPO): Promise<AllotmentResult> {
    const startTime = Date.now();
    const panHash = hashPAN(pan);
    const masked = maskPAN(pan);

    // Pre-flight eligibility check
    const ineligibleReason = this.canCheckAllotment(ipo);
    if (ineligibleReason) {
      logger.info(
        { ipo: ipo.symbol, status: ipo.status, reason: ineligibleReason },
        'IPO not eligible for allotment check'
      );

      const fingerprint = generateResultFingerprint({
        panHash,
        ipoId: ipo.id,
        status: 'UNSUPPORTED',
      });

      return {
        panHash,
        maskedPan: masked,
        ipoId: ipo.id,
        symbol: ipo.symbol,
        companyName: ipo.companyName,
        status: 'UNSUPPORTED',
        appliedQuantity: null,
        allottedQuantity: null,
        issuePrice: null,
        source: 'NONE',
        checkedAt: new Date(),
        confidence: 'LOW',
        qualityScore: 'FAILED',
        fingerprint,
        errorMessage: ineligibleReason,
        registrarUrl: ipo.registrarUrl ?? undefined,
      };
    }

    const provider = this.selectProvider(ipo);

    // No provider at all — return UNSUPPORTED (not CHECK_FAILED)
    if (!provider) {
      logger.warn(
        { ipo: ipo.symbol, registrar: ipo.registrar, exchange: ipo.exchange },
        'No provider available for this IPO — returning UNSUPPORTED'
      );

      const fingerprint = generateResultFingerprint({
        panHash,
        ipoId: ipo.id,
        status: 'UNSUPPORTED',
      });

      return {
        panHash,
        maskedPan: masked,
        ipoId: ipo.id,
        symbol: ipo.symbol,
        companyName: ipo.companyName,
        status: 'UNSUPPORTED',
        appliedQuantity: null,
        allottedQuantity: null,
        issuePrice: null,
        source: 'NONE',
        checkedAt: new Date(),
        confidence: 'LOW',
        qualityScore: 'FAILED',
        fingerprint,
        errorMessage: `No allotment provider available for registrar '${ipo.registrar ?? 'UNKNOWN'}' on exchange '${ipo.exchange}'`,
        registrarUrl: ipo.registrarUrl ?? undefined,
      };
    }

    logger.info(
      { ipo: ipo.symbol, registrar: ipo.registrar, provider: provider.name, pan: masked },
      'Executing allotment check via provider'
    );

    try {
      const result = await withRetry(
        async () => provider.checkByPAN(pan, ipo),
        {
          maxRetries: 2,
          baseDelayMs: 200,
          jitter: false,
          shouldRetry: (err) => {
            // Only retry transient failures — not CAPTCHA (user must solve manually)
            if (err instanceof ProviderCaptchaRequiredError) return false;
            if (err instanceof ProviderRateLimitError) return true;
            if (err instanceof ProviderUnavailableError) return true;
            return false;
          },
        },
        `checkAllotment:${provider.name}`
      );

      const durationMs = Date.now() - startTime;

      this.recordAuditCheck({
        panHash,
        ipoId: ipo.id,
        provider: provider.name,
        status: result.status,
        durationMs,
      }).catch((e) => logger.debug({ error: e.message }, 'Failed to record audit check'));

      // Validate: ensure the result is for the correct IPO
      // (guard against provider returning data for a different company)
      if (result.ipoId && result.ipoId !== ipo.id) {
        logger.error(
          { expectedIpoId: ipo.id, receivedIpoId: result.ipoId, provider: provider.name },
          'PROVIDER DATA MISMATCH — received result for wrong IPO'
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
          appliedQuantity: null,
          allottedQuantity: null,
          issuePrice: null,
          source: provider.name,
          checkedAt: new Date(),
          confidence: 'LOW',
          qualityScore: 'FAILED',
          fingerprint,
          errorMessage: 'Provider returned data for a different IPO — result discarded',
        };
      }

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      let status: AllotmentResult['status'] = 'CHECK_FAILED';
      let errorCode = 'UNKNOWN';

      if (error instanceof ProviderCaptchaRequiredError) {
        status = 'CAPTCHA_REQUIRED';
        errorCode = 'CAPTCHA_REQUIRED';
      } else if (error instanceof ProviderRateLimitError) {
        status = 'RATE_LIMITED';
        errorCode = 'RATE_LIMITED';
      } else if (error instanceof ProviderUnavailableError) {
        status = 'CHECK_FAILED';
        errorCode = 'PROVIDER_UNAVAILABLE';
      }

      this.recordAuditCheck({
        panHash,
        ipoId: ipo.id,
        provider: provider.name,
        status,
        durationMs,
        errorCode,
      }).catch((e) => logger.debug({ error: e.message }, 'Failed to record audit check error'));

      const fingerprint = generateResultFingerprint({ panHash, ipoId: ipo.id, status });

      return {
        panHash,
        maskedPan: masked,
        ipoId: ipo.id,
        symbol: ipo.symbol,
        companyName: ipo.companyName,
        status,
        appliedQuantity: null,
        allottedQuantity: null,
        issuePrice: null,
        source: provider.name,
        checkedAt: new Date(),
        confidence: 'LOW',
        qualityScore: 'FAILED',
        fingerprint,
        errorMessage: (error as Error).message,
        registrarUrl: ipo.registrarUrl ?? undefined,
      };
    }
  }

  /**
   * Check a PAN across multiple IPOs and return coverage metrics.
   */
  public async checkPANAcrossIPOs(
    pan: string,
    ipos: IPO[]
  ): Promise<{ results: AllotmentResult[]; coverage: CheckCoverage }> {
    const coverage: CheckCoverage = {
      discoveredIPOs: ipos.length,
      eligibleIPOs: 0,
      successfullyChecked: 0,
      applicationsFound: 0,
      captchaRequired: 0,
      providerFailures: 0,
      unsupportedProviders: 0,
    };

    // Count eligible
    coverage.eligibleIPOs = ipos.filter((ipo) => this.canCheckAllotment(ipo) === null).length;

    const results: AllotmentResult[] = [];

    for (const ipo of ipos) {
      const result = await this.checkAllotment(pan, ipo);
      results.push(result);

      switch (result.status) {
        case 'ALLOTTED':
        case 'NOT_ALLOTTED':
        case 'NOT_FOUND':
        case 'PENDING':
          coverage.successfullyChecked++;
          if (result.status === 'ALLOTTED') coverage.applicationsFound++;
          break;
        case 'CAPTCHA_REQUIRED':
          coverage.captchaRequired++;
          break;
        case 'UNSUPPORTED':
          coverage.unsupportedProviders++;
          break;
        case 'CHECK_FAILED':
        case 'RATE_LIMITED':
        case 'AUTH_REQUIRED':
          coverage.providerFailures++;
          break;
      }
    }

    return { results, coverage };
  }

  private async recordAuditCheck(params: {
    panHash: string;
    ipoId: string;
    provider: string;
    status: string;
    durationMs: number;
    errorCode?: string;
  }): Promise<void> {
    try {
      await db.insert(allotmentChecks).values({
        panHash: params.panHash,
        ipoId: params.ipoId,
        provider: params.provider,
        status: params.status,
        durationMs: params.durationMs,
        errorCode: params.errorCode,
        createdAt: new Date(),
      });
    } catch {
      // Non-blocking — audit logging failure must not affect the main result
    }
  }
}

export const allotmentEngine = new AllotmentEngine();
