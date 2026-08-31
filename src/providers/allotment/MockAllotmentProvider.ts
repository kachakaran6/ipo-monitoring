import type { AllotmentProvider, AllotmentResult, IPO } from './AllotmentProvider.interface.js';
import { hashPAN, maskPAN } from '../../security/crypto.js';
import { generateResultFingerprint } from '../../security/fingerprint.js';
import {
  ProviderCaptchaRequiredError,
  ProviderRateLimitError,
  ProviderUnavailableError,
} from '../../errors/index.js';

export class MockAllotmentProvider implements AllotmentProvider {
  public readonly name = 'MOCK_ALLOTMENT_PROVIDER';
  public readonly supportedRegistrars = ['MOCK', 'ALL'];

  public supportsIPO(ipo: IPO): boolean {
    if (!ipo.registrar) return false;
    const r = ipo.registrar.toUpperCase();
    return r === 'MOCK' || r === 'ALL' || r.includes('MOCK');
  }

  public async checkByPAN(pan: string, ipo: IPO): Promise<AllotmentResult> {
    const cleanPan = pan.trim().toUpperCase();
    const panHash = hashPAN(cleanPan);
    const masked = maskPAN(cleanPan);
    const checkedAt = new Date();

    // Deterministic simulation based on PAN suffix
    if (cleanPan.endsWith('4E') || cleanPan.endsWith('ERR')) {
      throw new ProviderUnavailableError(this.name, 'Simulated 503 Service Unavailable');
    }
    if (cleanPan.endsWith('4C') || cleanPan.endsWith('CAP')) {
      throw new ProviderCaptchaRequiredError(this.name, ipo.registrarUrl || 'https://mock.registrar.com');
    }
    if (cleanPan.endsWith('4R') || cleanPan.endsWith('RAT')) {
      throw new ProviderRateLimitError(this.name, 30);
    }

    if (cleanPan.endsWith('4F') || cleanPan.endsWith('1A')) {
      const applied = ipo.lotSize || 44;
      const allotted = ipo.lotSize || 44;
      const price = Number(ipo.issuePrice) || 340;
      const amount = applied * price;
      const status = 'ALLOTTED';
      const fingerprint = generateResultFingerprint({
        panHash,
        ipoId: ipo.id,
        status,
        allottedQuantity: allotted,
        issuePrice: price,
      });

      return {
        panHash,
        maskedPan: masked,
        ipoId: ipo.id,
        symbol: ipo.symbol,
        companyName: ipo.companyName,
        applicationNumber: 'APP-' + cleanPan.slice(-4),
        status,
        appliedQuantity: applied,
        allottedQuantity: allotted,
        issuePrice: price,
        amountApplied: amount,
        amountAllotted: amount,
        refundAmount: 0,
        dematCreditStatus: 'CREDITED',
        source: this.name,
        checkedAt,
        confidence: 'HIGH',
        fingerprint,
      };
    }

    if (cleanPan.endsWith('8K') || cleanPan.endsWith('2N')) {
      const applied = ipo.lotSize || 65;
      const price = Number(ipo.issuePrice) || 210;
      const amount = applied * price;
      const status = 'NOT_ALLOTTED';
      const fingerprint = generateResultFingerprint({
        panHash,
        ipoId: ipo.id,
        status,
        allottedQuantity: 0,
        issuePrice: price,
      });

      return {
        panHash,
        maskedPan: masked,
        ipoId: ipo.id,
        symbol: ipo.symbol,
        companyName: ipo.companyName,
        applicationNumber: 'APP-' + cleanPan.slice(-4),
        status,
        appliedQuantity: applied,
        allottedQuantity: 0,
        issuePrice: price,
        amountApplied: amount,
        amountAllotted: 0,
        refundAmount: amount,
        dematCreditStatus: 'NOT_APPLICABLE',
        source: this.name,
        checkedAt,
        confidence: 'HIGH',
        fingerprint,
      };
    }

    if (cleanPan.endsWith('0N') || cleanPan.endsWith('00F')) {
      const status = 'NOT_FOUND';
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
        checkedAt,
        confidence: 'HIGH',
        fingerprint,
      };
    }

    // Default: PENDING
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
      appliedQuantity: ipo.lotSize,
      allottedQuantity: 0,
      source: this.name,
      checkedAt,
      confidence: 'HIGH',
      fingerprint,
    };
  }

  public async checkByApplicationNumber(applicationNumber: string, ipo: IPO): Promise<AllotmentResult> {
    return this.checkByPAN('ABCDE1234F', ipo);
  }
}
