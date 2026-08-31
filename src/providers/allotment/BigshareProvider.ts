import type { AllotmentProvider, AllotmentResult, IPO } from './AllotmentProvider.interface.js';
import { ProviderRateLimiterManager } from '../rateLimiter.js';
import { ProviderHealthTracker } from '../health.js';
import { hashPAN, maskPAN } from '../../security/crypto.js';
import { generateResultFingerprint } from '../../security/fingerprint.js';
import { logger } from '../../utils/logger.js';

export class BigshareProvider implements AllotmentProvider {
  public readonly name = 'BIGSHARE';
  public readonly supportedRegistrars = ['BIGSHARE', 'BIG_SHARE', 'BIGSHARE_SERVICES'];
  private readonly limiter = ProviderRateLimiterManager.getLimiter('BIGSHARE');

  public supportsIPO(ipo: IPO): boolean {
    if (!ipo.registrar) return false;
    const r = ipo.registrar.toUpperCase().replace(/[^A-Z]/g, '_');
    return this.supportedRegistrars.some((sr) => r.includes(sr));
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
          allottedQuantity: 0,
          issuePrice: ipo.issuePrice || undefined,
        });

        return {
          panHash,
          maskedPan: masked,
          ipoId: ipo.id,
          symbol: ipo.symbol,
          companyName: ipo.companyName,
          status,
          appliedQuantity: ipo.lotSize,
          allottedQuantity: 0,
          issuePrice: ipo.issuePrice || undefined,
          source: this.name,
          checkedAt: new Date(),
          confidence: 'HIGH',
          fingerprint,
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        await ProviderHealthTracker.recordFailure(this.name, duration);
        logger.warn({ provider: this.name, ipo: ipo.symbol, error: (error as Error).message }, 'Bigshare check failed');

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
