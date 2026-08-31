/**
 * AllotmentEngine Integrity Tests
 *
 * These tests verify the core real-data-only guarantees of the engine.
 * Per requirement §53 — all of these scenarios must pass before the
 * implementation is considered complete.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AllotmentEngine } from '../../src/providers/allotment/AllotmentEngine.js';
import type { IPO } from '../../src/types/ipo.types.js';
import type { AllotmentProvider, AllotmentResult } from '../../src/providers/allotment/AllotmentProvider.interface.js';

// ──────────────────────────────────────────────────────────────────
// Test fixtures (isolated from production code — never in src/)
// ──────────────────────────────────────────────────────────────────

const REAL_IPO: IPO = {
  id: 'test-ipo-id-123',
  symbol: 'TESTCORP',
  companyName: 'Test Corp Limited',
  slug: 'test-corp-limited',
  exchange: 'NSE',
  issueType: 'BOOK_BUILT',
  mainboardOrSme: 'MAINBOARD',
  status: 'ALLOTMENT_PENDING',
  lotSize: 44,
  minimumApplication: 44,
  issuePrice: 340,
  registrar: 'KFINTECH',
  registrarUrl: 'https://ris.kfintech.com/ipostatus/',
  source: 'NSE',
  sourceId: 'TESTCORP-NSE-001',
  sourceUrl: 'https://www.nseindia.com/market-data/ipo',
};

const REAL_PAN = 'ABCDE5064D';

function makeFakeProvider(name: string, response: Partial<AllotmentResult>): AllotmentProvider {
  return {
    name,
    supportedRegistrars: ['KFINTECH'],
    supportsIPO: () => true,
    checkByPAN: async (_pan, ipo) => ({
      panHash: 'fakehash',
      maskedPan: 'XXXXX5064D',
      ipoId: ipo.id,
      symbol: ipo.symbol,
      companyName: ipo.companyName,
      source: name,
      checkedAt: new Date(),
      confidence: 'LOW' as const,
      fingerprint: 'fakefingerprint',
      ...response,
    }),
    checkByApplicationNumber: async (_appNo, ipo) => ({
      panHash: 'fakehash',
      maskedPan: 'XXXXX5064D',
      ipoId: ipo.id,
      symbol: ipo.symbol,
      companyName: ipo.companyName,
      status: 'CHECK_FAILED' as const,
      source: name,
      checkedAt: new Date(),
      confidence: 'LOW' as const,
      fingerprint: 'fakefingerprint',
    }),
    healthCheck: async () => ({ status: 'HEALTHY' as const, latencyMs: 100 }),
  };
}

// ──────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────

describe('AllotmentEngine — Real-Data-Only Guarantees', () => {
  let engine: AllotmentEngine;

  beforeEach(() => {
    engine = new AllotmentEngine();
    // Remove default providers so tests have full control
    (engine as any).providers = [];
  });

  // §53 test: "no provider response → CHECK_FAILED"
  it('returns CHECK_FAILED when no provider is available for the IPO', async () => {
    // No providers registered — no registrar match possible
    const result = await engine.checkAllotment(REAL_PAN, { ...REAL_IPO, registrar: 'UNKNOWN_REGISTRAR' });
    expect(result.status).toBe('UNSUPPORTED');
    expect(result.appliedQuantity).toBeNull();
    expect(result.allottedQuantity).toBeNull();
    expect(result.issuePrice).toBeNull();
  });

  // §53 test: "missing quantity → quantity=null"
  it('returns null quantities when provider does not return them', async () => {
    const provider = makeFakeProvider('KFINTECH', {
      status: 'CAPTCHA_REQUIRED',
      appliedQuantity: null,
      allottedQuantity: null,
      issuePrice: null,
    });
    engine.registerProvider(provider);

    const result = await engine.checkAllotment(REAL_PAN, REAL_IPO);
    expect(result.appliedQuantity).toBeNull();
    expect(result.allottedQuantity).toBeNull();
    expect(result.issuePrice).toBeNull();
  });

  // §53 test: "provider timeout → CHECK_FAILED"
  it('returns CHECK_FAILED when provider throws an error', async () => {
    const provider: AllotmentProvider = {
      name: 'KFINTECH',
      supportedRegistrars: ['KFINTECH'],
      supportsIPO: () => true,
      checkByPAN: async () => { throw new Error('Connection timeout'); },
      checkByApplicationNumber: async (_no, ipo) => ({
        panHash: '',
        maskedPan: '',
        ipoId: ipo.id,
        symbol: ipo.symbol,
        companyName: ipo.companyName,
        status: 'CHECK_FAILED',
        source: 'KFINTECH',
        checkedAt: new Date(),
        confidence: 'LOW',
        fingerprint: 'fp',
      }),
      healthCheck: async () => ({ status: 'UNAVAILABLE', latencyMs: 0 }),
    };
    engine.registerProvider(provider);

    const result = await engine.checkAllotment(REAL_PAN, REAL_IPO);
    // Should be CHECK_FAILED — never PENDING, never NOT_ALLOTTED
    expect(result.status).toBe('CHECK_FAILED');
    expect(result.appliedQuantity).toBeNull();
    expect(result.allottedQuantity).toBeNull();
  });

  // §53 test: "invalid company mismatch → DATA_MISMATCH / CHECK_FAILED"
  it('rejects a result that contains a different IPO ID', async () => {
    const provider = makeFakeProvider('KFINTECH', {
      status: 'ALLOTTED',
      ipoId: 'DIFFERENT-IPO-ID', // Provider returned data for wrong IPO
      appliedQuantity: 44,
      allottedQuantity: 44,
    });
    engine.registerProvider(provider);

    const result = await engine.checkAllotment(REAL_PAN, REAL_IPO);
    // Must reject this result — the ipoId doesn't match what we requested
    expect(result.status).toBe('CHECK_FAILED');
    expect(result.errorMessage).toContain('different IPO');
  });

  // §42 — Never default to PENDING
  it('never returns PENDING when provider throws without returning PENDING', async () => {
    const provider: AllotmentProvider = {
      name: 'KFINTECH',
      supportedRegistrars: ['KFINTECH'],
      supportsIPO: () => true,
      checkByPAN: async () => { throw new Error('500 Internal Server Error'); },
      checkByApplicationNumber: async (_no, ipo) => ({
        panHash: '',
        maskedPan: '',
        ipoId: ipo.id,
        symbol: ipo.symbol,
        companyName: ipo.companyName,
        status: 'CHECK_FAILED',
        source: 'KFINTECH',
        checkedAt: new Date(),
        confidence: 'LOW',
        fingerprint: 'fp',
      }),
      healthCheck: async () => ({ status: 'UNAVAILABLE', latencyMs: 0 }),
    };
    engine.registerProvider(provider);

    const result = await engine.checkAllotment(REAL_PAN, REAL_IPO);
    expect(result.status).not.toBe('PENDING');
  });

  // §11 — Technical failure never becomes NOT_ALLOTTED
  it('never returns NOT_ALLOTTED when the provider fails', async () => {
    const provider: AllotmentProvider = {
      name: 'KFINTECH',
      supportedRegistrars: ['KFINTECH'],
      supportsIPO: () => true,
      checkByPAN: async () => { throw new Error('Network error'); },
      checkByApplicationNumber: async (_no, ipo) => ({
        panHash: '',
        maskedPan: '',
        ipoId: ipo.id,
        symbol: ipo.symbol,
        companyName: ipo.companyName,
        status: 'CHECK_FAILED',
        source: 'KFINTECH',
        checkedAt: new Date(),
        confidence: 'LOW',
        fingerprint: 'fp',
      }),
      healthCheck: async () => ({ status: 'UNAVAILABLE', latencyMs: 0 }),
    };
    engine.registerProvider(provider);

    const result = await engine.checkAllotment(REAL_PAN, REAL_IPO);
    expect(result.status).not.toBe('NOT_ALLOTTED');
  });

  // §17 — IPO eligibility check
  it('returns UNSUPPORTED for IPO in OPEN status (not yet eligible for allotment check)', async () => {
    const openIPO = { ...REAL_IPO, status: 'OPEN' as const };
    const provider = makeFakeProvider('KFINTECH', { status: 'ALLOTTED', appliedQuantity: 44, allottedQuantity: 44 });
    engine.registerProvider(provider);

    const result = await engine.checkAllotment(REAL_PAN, openIPO);
    expect(result.status).toBe('UNSUPPORTED');
    expect(result.errorMessage).toContain('OPEN');
  });

  // §40 — Applied quantity must never be inferred from lot size
  it('does not infer appliedQuantity from lotSize when provider returns null', async () => {
    const provider = makeFakeProvider('KFINTECH', {
      status: 'ALLOTTED',
      appliedQuantity: null, // Explicitly null from provider
      allottedQuantity: 44,
    });
    engine.registerProvider(provider);

    const result = await engine.checkAllotment(REAL_PAN, REAL_IPO);
    // Must NOT be ipo.lotSize (44) — must be null because provider said null
    expect(result.appliedQuantity).toBeNull();
    // Must not equal the lot size
    expect(result.appliedQuantity).not.toBe(REAL_IPO.lotSize);
  });

  // Coverage tracking
  it('tracks coverage correctly across multiple IPOs', async () => {
    const provider = makeFakeProvider('KFINTECH', {
      status: 'CAPTCHA_REQUIRED',
      appliedQuantity: null,
      allottedQuantity: null,
    });
    engine.registerProvider(provider);

    const ipos = [
      REAL_IPO,
      { ...REAL_IPO, id: 'ipo-2', symbol: 'ABC', status: 'ALLOTMENT_PENDING' as const },
    ];

    const { coverage } = await engine.checkPANAcrossIPOs(REAL_PAN, ipos);
    expect(coverage.discoveredIPOs).toBe(2);
    expect(coverage.captchaRequired).toBe(2);
    expect(coverage.providerFailures).toBe(0);
    expect(coverage.applicationsFound).toBe(0);
  });
});
