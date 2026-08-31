/**
 * NSE Allotment Provider
 *
 * NSE does NOT provide PAN-based allotment lookup.
 * NSE's role in this system is exclusively as an IPO METADATA provider (see NSEIPOProvider.ts).
 *
 * This provider exists in the engine chain to handle the edge case where an IPO
 * has exchange='NSE' but no registrar is set. It immediately returns UNSUPPORTED
 * with a clear message directing the user to the correct RTA.
 *
 * DO NOT add PAN lookup logic here — NSE has no such endpoint.
 */

import type { AllotmentProvider, AllotmentResult, IPO } from './AllotmentProvider.interface.js';
import type { ProviderHealthStatus } from '../../types/provider.types.js';
import { hashPAN, maskPAN } from '../../security/crypto.js';
import { generateResultFingerprint } from '../../security/fingerprint.js';
import { logger } from '../../utils/logger.js';

export class NSEAllotmentProvider implements AllotmentProvider {
  public readonly name = 'NSE';

  /**
   * NSE does not process allotment queries — this is always empty.
   * The exchange name is not a registrar.
   */
  public readonly supportedRegistrars: string[] = [];

  /**
   * NSE is never used as an allotment source.
   * The AllotmentEngine should only call this provider if registrar is unknown
   * and we want to signal UNSUPPORTED clearly.
   */
  public supportsIPO(ipo: IPO): boolean {
    // Only match when no registrar is identified and exchange is NSE — as a last resort
    return !ipo.registrar && (ipo.exchange === 'NSE' || ipo.exchange === 'BOTH');
  }

  public async checkByPAN(pan: string, ipo: IPO): Promise<AllotmentResult> {
    const panHash = hashPAN(pan);
    const masked = maskPAN(pan);

    logger.info(
      { provider: this.name, ipo: ipo.symbol },
      'NSE does not support PAN allotment lookup — returning UNSUPPORTED'
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
      // All quantities null — we have no data and cannot infer any
      appliedQuantity: null,
      allottedQuantity: null,
      issuePrice: null,
      source: this.name,
      checkedAt: new Date(),
      confidence: 'LOW',
      qualityScore: 'FAILED',
      fingerprint,
      errorMessage: 'NSE does not provide PAN-based allotment lookup. Please check with the IPO registrar directly.',
      registrarUrl: ipo.registrarUrl || undefined,
      provenance: {
        source: this.name,
        sourceType: 'NSE',
        fetchedAt: new Date(),
        confidence: 'AUTHORITATIVE',
      },
    };
  }

  public async checkByApplicationNumber(applicationNumber: string, ipo: IPO): Promise<AllotmentResult> {
    return this.checkByPAN('AAAAA0000A', ipo);
  }

  public async healthCheck(): Promise<{ status: ProviderHealthStatus; latencyMs: number; detail?: string }> {
    // NSE is always considered "healthy" for allotment purposes — it's just UNSUPPORTED
    return { status: 'HEALTHY', latencyMs: 0, detail: 'NSE allotment lookup is UNSUPPORTED by design' };
  }
}
