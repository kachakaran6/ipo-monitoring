import { describe, it, expect } from 'vitest';
import {
  generateResultFingerprint,
  generateNotificationFingerprint,
} from '../../src/security/fingerprint.js';

describe('Deterministic Fingerprinting Module', () => {
  it('should generate identical fingerprints for identical allotment states', () => {
    const fp1 = generateResultFingerprint({
      panHash: 'hash123',
      ipoId: 'ipo-1',
      status: 'ALLOTTED',
      allottedQuantity: 44,
      issuePrice: 340,
    });

    const fp2 = generateResultFingerprint({
      panHash: 'hash123',
      ipoId: 'ipo-1',
      status: 'ALLOTTED',
      allottedQuantity: 44,
      issuePrice: 340,
    });

    expect(fp1).toBe(fp2);
    expect(fp1.length).toBe(64);
  });

  it('should generate different fingerprints when state changes (e.g. PENDING to ALLOTTED)', () => {
    const fpPending = generateResultFingerprint({
      panHash: 'hash123',
      ipoId: 'ipo-1',
      status: 'PENDING',
    });

    const fpAllotted = generateResultFingerprint({
      panHash: 'hash123',
      ipoId: 'ipo-1',
      status: 'ALLOTTED',
      allottedQuantity: 44,
      issuePrice: 340,
    });

    expect(fpPending).not.toBe(fpAllotted);
  });

  it('should generate deterministic notification fingerprint for deduplication', () => {
    const nfp1 = generateNotificationFingerprint({
      userId: 'user-1',
      panHash: 'pan-hash-1',
      ipoId: 'ipo-1',
      eventType: 'ALLOTMENT_RESULT_CHANGED',
      state: 'ALLOTTED',
    });

    const nfp2 = generateNotificationFingerprint({
      userId: 'user-1',
      panHash: 'pan-hash-1',
      ipoId: 'ipo-1',
      eventType: 'ALLOTMENT_RESULT_CHANGED',
      state: 'ALLOTTED',
    });

    expect(nfp1).toBe(nfp2);
  });
});
