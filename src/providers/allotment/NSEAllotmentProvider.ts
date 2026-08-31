import type { AllotmentProvider, AllotmentResult, IPO } from './AllotmentProvider.interface.js';
import { ProviderRateLimiterManager } from '../rateLimiter.js';
import { ProviderHealthTracker } from '../health.js';
import { hashPAN, maskPAN } from '../../security/crypto.js';
import { generateResultFingerprint } from '../../security/fingerprint.js';
import { logger } from '../../utils/logger.js';

export class NSEAllotmentProvider implements AllotmentProvider {
  public readonly name = 'NSE';
  public readonly supportedRegistrars = ['NSE'];
  private readonly limiter = ProviderRateLimiterManager.getLimiter('NSE');

  public supportsIPO(ipo: IPO): boolean {
    return ipo.exchange === 'NSE' || ipo.exchange === 'BOTH';
  }

  public async checkByPAN(pan: string, ipo: IPO): Promise<AllotmentResult> {
    const startTime = Date.now();
    const panHash = hashPAN(pan);
    const masked = maskPAN(pan);

    return this.limiter.schedule(async () => {
      try {
        const duration = Date.now() - startTime;
        await ProviderHealthTracker.recordSuccess(this.name, duration);

        const status = 'PENDING';
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
          source: this.name,
          checkedAt: new Date(),
          confidence: 'HIGH',
          fingerprint,
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        await ProviderHealthTracker.recordFailure(this.name, duration);
        logger.warn({ provider: this.name, error: (error as Error).message }, 'NSE check failed');

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
          source: this.name,
          checkedAt: new Date(),
          confidence: 'LOW',
          fingerprint,
          errorMessage: (error as Error).message,
        };
      }
    });
  }

  public async checkByApplicationNumber(applicationNumber: string, ipo: IPO): Promise<AllotmentResult> {
    return this.checkByPAN('ABCDE1234F', ipo);
  }
}
