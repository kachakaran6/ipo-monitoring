import { describe, it, expect } from 'vitest';
import { MockAllotmentProvider } from '../../src/providers/allotment/MockAllotmentProvider.js';
import { AllotmentEngine } from '../../src/providers/allotment/AllotmentEngine.js';
import type { IPO } from '../../src/types/ipo.types.js';

describe('Allotment Provider Standard Contract', () => {
  const sampleIpo: IPO = {
    id: '7b8d1b22-83b6-4b2a-a9f1-a1e4c9f13110',
    symbol: 'TECHCORP',
    companyName: 'TechCorp Innovations Limited',
    slug: 'techcorp-innovations',
    exchange: 'NSE',
    issueType: 'BOOK_BUILT',
    mainboardOrSme: 'MAINBOARD',
    status: 'ALLOTMENT_PENDING',
    lotSize: 44,
    minimumApplication: 44,
    issuePrice: 340,
    registrar: 'MOCK',
    source: 'TEST',
  };

  const provider = new MockAllotmentProvider();
  const engine = new AllotmentEngine();

  it('Contract 1: Should return ALLOTTED with valid share allotment details', async () => {
    const res = await provider.checkByPAN('ABCDE1234F', sampleIpo);
    expect(res.status).toBe('ALLOTTED');
    expect(res.allottedQuantity).toBe(44);
    expect(res.amountAllotted).toBe(44 * 340);
    expect(res.confidence).toBe('HIGH');
    expect(res.maskedPan).toBe('XXXXX1234F');
  });

  it('Contract 2: Should return NOT_ALLOTTED with zero shares and refund info', async () => {
    const res = await provider.checkByPAN('FGHIJ5678K', sampleIpo);
    expect(res.status).toBe('NOT_ALLOTTED');
    expect(res.allottedQuantity).toBe(0);
    expect(res.amountAllotted).toBe(0);
    expect(res.refundAmount).toBeGreaterThan(0);
  });

  it('Contract 3: Should return PENDING when allotment is in progress', async () => {
    const res = await provider.checkByPAN('XYZAB9999P', sampleIpo);
    expect(res.status).toBe('PENDING');
  });

  it('Contract 4: Should return NOT_FOUND when no bid was submitted for this PAN', async () => {
    const res = await provider.checkByPAN('NOPQR1100N', sampleIpo);
    expect(res.status).toBe('NOT_FOUND');
  });

  it('Contract 5: Should gracefully degrade to CAPTCHA_REQUIRED without bypass attempt', async () => {
    const res = await engine.checkAllotment('ABCDE1234C', sampleIpo);
    expect(res.status).toBe('CAPTCHA_REQUIRED');
  });

  it('Contract 6: Should gracefully handle RATE_LIMITED without throwing uncaught', async () => {
    const res = await engine.checkAllotment('ABCDE1234R', sampleIpo);
    expect(res.status).toBe('RATE_LIMITED');
  });

  it('Contract 7: CRITICAL RULE - Provider failure must yield CHECK_FAILED and NEVER NOT_ALLOTTED', async () => {
    const res = await engine.checkAllotment('ABCDE1234E', sampleIpo);
    expect(res.status).toBe('CHECK_FAILED');
    expect(res.status).not.toBe('NOT_ALLOTTED');
  });

  it('Contract 8: Result must contain deterministic fingerprint and checkedAt timestamp', async () => {
    const res = await provider.checkByPAN('ABCDE1234F', sampleIpo);
    expect(res.fingerprint).toBeDefined();
    expect(res.fingerprint.length).toBe(64);
    expect(res.checkedAt).toBeInstanceOf(Date);
  });
});
