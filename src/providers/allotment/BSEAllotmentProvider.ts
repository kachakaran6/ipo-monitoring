/**
 * BSE Allotment Provider
 *
 * BSE does NOT provide PAN-based allotment lookup.
 * BSE redirects all allotment queries to the respective RTA (registrar).
 * BSE's role in this system is exclusively as an IPO METADATA provider (see BSEIPOProvider.ts).
 *
 * This provider returns UNSUPPORTED and directs users to the registrar.
 *
 * DO NOT add PAN lookup logic here.
 */

import type { AllotmentProvider, AllotmentResult, IPO } from './AllotmentProvider.interface.js';
import type { ProviderHealthStatus } from '../../types/provider.types.js';
import { hashPAN, maskPAN } from '../../security/crypto.js';
import { generateResultFingerprint } from '../../security/fingerprint.js';
import { logger } from '../../utils/logger.js';

export class BSEAllotmentProvider implements AllotmentProvider {
  public readonly name = 'BSE';
  public readonly supportedRegistrars: string[] = [];

  public supportsIPO(ipo: IPO): boolean {
    return !ipo.registrar && (ipo.exchange === 'BSE' || ipo.exchange === 'BOTH');
  }

  public async checkByPAN(pan: string, ipo: IPO): Promise<AllotmentResult> {
    const panHash = hashPAN(pan);
    const masked = maskPAN(pan);

    logger.info(
      { provider: this.name, ipo: ipo.symbol },
      'BSE does not support PAN allotment lookup — returning UNSUPPORTED'
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
      source: this.name,
      checkedAt: new Date(),
      confidence: 'LOW',
      qualityScore: 'FAILED',
      fingerprint,
      errorMessage: 'BSE does not provide PAN-based allotment lookup. Please check with the IPO registrar directly.',
      registrarUrl: ipo.registrarUrl || undefined,
      provenance: {
        source: this.name,
        sourceType: 'BSE',
        fetchedAt: new Date(),
        confidence: 'AUTHORITATIVE',
      },
    };
  }

  public async checkByApplicationNumber(applicationNumber: string, ipo: IPO): Promise<AllotmentResult> {
    return this.checkByPAN('AAAAA0000A', ipo);
  }

  public async healthCheck(): Promise<{ status: ProviderHealthStatus; latencyMs: number; detail?: string }> {
    return { status: 'HEALTHY', latencyMs: 0, detail: 'BSE allotment lookup is UNSUPPORTED by design' };
  }
}
