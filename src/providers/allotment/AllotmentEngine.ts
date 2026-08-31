import type { AllotmentProvider, AllotmentResult, IPO } from './AllotmentProvider.interface.js';
import { MUFGIntimeProvider } from './MUFGIntimeProvider.js';
import { KFintechProvider } from './KFintechProvider.js';
import { BigshareProvider } from './BigshareProvider.js';
import { NSEAllotmentProvider } from './NSEAllotmentProvider.js';
import { BSEAllotmentProvider } from './BSEAllotmentProvider.js';
import { MockAllotmentProvider } from './MockAllotmentProvider.js';
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

export class AllotmentEngine {
  private providers: AllotmentProvider[] = [];

  constructor() {
    this.providers = [
      new MockAllotmentProvider(),
      new MUFGIntimeProvider(),
      new KFintechProvider(),
      new BigshareProvider(),
      new NSEAllotmentProvider(),
      new BSEAllotmentProvider(),
    ];
  }

  public registerProvider(provider: AllotmentProvider, highPriority: boolean = false): void {
    if (highPriority) {
      this.providers.unshift(provider);
    } else {
      this.providers.push(provider);
    }
  }

  public selectProvider(ipo: IPO): AllotmentProvider {
    // 1. First, match registrar-specific provider (MUFG, KFintech, Bigshare, Mock)
    if (ipo.registrar) {
      for (const provider of this.providers) {
        if (provider.supportsIPO(ipo)) {
          return provider;
        }
      }
    }

    // 2. Second, match exchange provider (NSE, BSE)
    for (const provider of this.providers) {
      if (provider.name === 'NSE' || provider.name === 'BSE') {
        if (provider.supportsIPO(ipo)) {
          return provider;
        }
      }
    }

    // 3. Fallback
    return this.providers.find((p) => p.name === 'MOCK_ALLOTMENT_PROVIDER') || this.providers[0];
  }

  /**
   * Executes allotment verification with full rate limiting, retries, audit logging and normalization.
   */
  public async checkAllotment(pan: string, ipo: IPO): Promise<AllotmentResult> {
    const startTime = Date.now();
    const panHash = hashPAN(pan);
    const masked = maskPAN(pan);
    const provider = this.selectProvider(ipo);

    logger.info(
      { ipo: ipo.symbol, registrar: ipo.registrar, provider: provider.name, pan: masked },
      'Executing allotment check'
    );

    try {
      // Execute via withRetry for transient 502/503/429 failures
      const result = await withRetry(
        async () => {
          return await provider.checkByPAN(pan, ipo);
        },
        {
          maxRetries: 2,
          baseDelayMs: 200,
          jitter: false,
          shouldRetry: (err) => {
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

      const fingerprint = generateResultFingerprint({
        panHash,
        ipoId: ipo.id,
        status,
      });

      return {
        panHash,
        maskedPan: masked,
        ipoId: ipo.id,
        symbol: ipo.symbol,
        companyName: ipo.companyName,
        status,
        source: provider.name,
        checkedAt: new Date(),
        confidence: 'LOW',
        fingerprint,
        errorMessage: (error as Error).message,
      };
    }
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
      // Non-blocking
    }
  }
}

export const allotmentEngine = new AllotmentEngine();
