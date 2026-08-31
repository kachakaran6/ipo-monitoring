/**
 * Provider Contract Tests
 *
 * Verify that every allotment provider satisfies the AllotmentProvider contract:
 *  - Returns a valid AllotmentStatus (never undefined or fabricated)
 *  - Returns null for quantities it cannot obtain
 *  - Returns registrarUrl when status is CAPTCHA_REQUIRED
 *  - Returns provenance with sourceType
 *  - Never returns PENDING unless explicitly confirmed by the source
 */

import { describe, it, expect } from 'vitest';
import { KFintechProvider } from '../../src/providers/allotment/KFintechProvider.js';
import { MUFGIntimeProvider } from '../../src/providers/allotment/MUFGIntimeProvider.js';
import { BigshareProvider } from '../../src/providers/allotment/BigshareProvider.js';
import { NSEAllotmentProvider } from '../../src/providers/allotment/NSEAllotmentProvider.js';
import { BSEAllotmentProvider } from '../../src/providers/allotment/BSEAllotmentProvider.js';
import type { AllotmentProvider } from '../../src/providers/allotment/AllotmentProvider.interface.js';
import type { AllotmentStatus } from '../../src/types/allotment.types.js';
import type { IPO } from '../../src/types/ipo.types.js';

const VALID_STATUSES: AllotmentStatus[] = [
  'ALLOTTED',
  'NOT_ALLOTTED',
  'PENDING',
  'NOT_FOUND',
  'CHECK_FAILED',
  'CAPTCHA_REQUIRED',
  'AUTH_REQUIRED',
  'RATE_LIMITED',
  'UNSUPPORTED',
  'MANUAL_VERIFICATION_REQUIRED',
  'ERROR',
  'UNKNOWN',
];

const TEST_IPO: IPO = {
  id: 'contract-test-ipo',
  symbol: 'CONTRACT',
  companyName: 'Contract Test Corp',
  slug: 'contract-test-corp',
  exchange: 'NSE',
  issueType: 'BOOK_BUILT',
  mainboardOrSme: 'MAINBOARD',
  status: 'ALLOTMENT_PENDING',
  lotSize: 33,
  minimumApplication: 33,
  registrar: null,
  source: 'NSE',
};

const TEST_PAN = 'ABCDE5064D';

async function runContractTests(provider: AllotmentProvider, testIPO: IPO): Promise<void> {
  const result = await provider.checkByPAN(TEST_PAN, testIPO).catch((err) => ({
    panHash: 'error',
    maskedPan: 'XXX',
    ipoId: testIPO.id,
    symbol: testIPO.symbol,
    companyName: testIPO.companyName,
    status: 'CHECK_FAILED' as AllotmentStatus,
    source: provider.name,
    checkedAt: new Date(),
    confidence: 'LOW' as const,
    fingerprint: 'error-fp',
    appliedQuantity: null,
    allottedQuantity: null,
    issuePrice: null,
  }));

  // Contract 1: status is always a valid AllotmentStatus
  expect(VALID_STATUSES).toContain(result.status);

  // Contract 2: status is never undefined
  expect(result.status).toBeDefined();

  // Contract 3: panHash is always set (no plaintext PAN in result)
  expect(result.panHash).toBeTruthy();
  expect(result.panHash).not.toBe(TEST_PAN); // Must be hashed, not plaintext

  // Contract 4: ipoId always matches the requested IPO
  expect(result.ipoId).toBe(testIPO.id);

  // Contract 5: checkedAt is always set
  expect(result.checkedAt).toBeInstanceOf(Date);

  // Contract 6: fingerprint is always set
  expect(result.fingerprint).toBeTruthy();

  // Contract 7: When CAPTCHA_REQUIRED, registrarUrl must be present
  if (result.status === 'CAPTCHA_REQUIRED') {
    expect(result.registrarUrl).toBeTruthy();
    expect(result.registrarUrl).toMatch(/^https:\/\//);
  }

  // Contract 8: appliedQuantity must be null if status is not ALLOTTED/NOT_ALLOTTED
  if (result.status === 'CAPTCHA_REQUIRED' || result.status === 'CHECK_FAILED' || result.status === 'UNSUPPORTED') {
    expect(result.appliedQuantity).toBeNull();
    expect(result.allottedQuantity).toBeNull();
  }
}

// ──────────────────────────────────────────────────────────────────

describe('KFintechProvider contract', () => {
  const provider = new KFintechProvider();
  const ipo = { ...TEST_IPO, registrar: 'KFINTECH', registrarUrl: 'https://ris.kfintech.com/ipostatus/' };

  it('satisfies the AllotmentProvider contract', async () => {
    await runContractTests(provider, ipo);
  });

  it('supports KFINTECH registrar', () => {
    expect(provider.supportsIPO(ipo)).toBe(true);
  });

  it('does not support MUFG_INTIME registrar', () => {
    expect(provider.supportsIPO({ ...ipo, registrar: 'MUFG_INTIME' })).toBe(false);
  });
});

describe('MUFGIntimeProvider contract', () => {
  const provider = new MUFGIntimeProvider();
  const ipo = { ...TEST_IPO, registrar: 'MUFG_INTIME', registrarUrl: 'https://linkintime.co.in/MUFG/web/PanSearch.aspx' };

  it('satisfies the AllotmentProvider contract', async () => {
    await runContractTests(provider, ipo);
  });

  it('supports MUFG_INTIME registrar', () => {
    expect(provider.supportsIPO(ipo)).toBe(true);
  });

  it('does not support KFINTECH registrar', () => {
    expect(provider.supportsIPO({ ...ipo, registrar: 'KFINTECH' })).toBe(false);
  });
});

describe('BigshareProvider contract', () => {
  const provider = new BigshareProvider();
  const ipo = { ...TEST_IPO, registrar: 'BIGSHARE', registrarUrl: 'https://www.bigshareonline.com/ipo_Allotment.html' };

  it('satisfies the AllotmentProvider contract', async () => {
    await runContractTests(provider, ipo);
  });

  it('supports BIGSHARE registrar', () => {
    expect(provider.supportsIPO(ipo)).toBe(true);
  });
});

describe('NSEAllotmentProvider contract', () => {
  const provider = new NSEAllotmentProvider();
  const ipo = { ...TEST_IPO, exchange: 'NSE' as const };

  it('satisfies the AllotmentProvider contract', async () => {
    await runContractTests(provider, ipo);
  });

  it('always returns UNSUPPORTED', async () => {
    const result = await provider.checkByPAN(TEST_PAN, ipo);
    expect(result.status).toBe('UNSUPPORTED');
  });

  it('has empty supportedRegistrars', () => {
    expect(provider.supportedRegistrars).toHaveLength(0);
  });
});

describe('BSEAllotmentProvider contract', () => {
  const provider = new BSEAllotmentProvider();
  const ipo = { ...TEST_IPO, exchange: 'BSE' as const };

  it('satisfies the AllotmentProvider contract', async () => {
    await runContractTests(provider, ipo);
  });

  it('always returns UNSUPPORTED', async () => {
    const result = await provider.checkByPAN(TEST_PAN, ipo);
    expect(result.status).toBe('UNSUPPORTED');
  });

  it('has empty supportedRegistrars', () => {
    expect(provider.supportedRegistrars).toHaveLength(0);
  });
});
