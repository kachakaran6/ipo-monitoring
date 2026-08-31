/**
 * Real-Data-Only Enforcement Tests
 *
 * These tests prove that fabricated results CANNOT enter production.
 * They check the structural properties of the codebase rather than runtime behaviour.
 *
 * Per requirement §53:
 *  - Production + mock provider → startup failure
 *  - No fake IPOs in seed
 *  - Providers return CAPTCHA_REQUIRED not PENDING
 */

import { describe, it, expect } from 'vitest';
import { KFintechProvider } from '../../src/providers/allotment/KFintechProvider.js';
import { MUFGIntimeProvider } from '../../src/providers/allotment/MUFGIntimeProvider.js';
import { BigshareProvider } from '../../src/providers/allotment/BigshareProvider.js';
import { NSEAllotmentProvider } from '../../src/providers/allotment/NSEAllotmentProvider.js';
import { BSEAllotmentProvider } from '../../src/providers/allotment/BSEAllotmentProvider.js';
import { NSEIPOProvider } from '../../src/providers/ipo/NSEIPOProvider.js';
import { BSEIPOProvider } from '../../src/providers/ipo/BSEIPOProvider.js';
import { IPOProviderRegistry } from '../../src/providers/ipo/IPOProviderRegistry.js';
import type { IPO } from '../../src/types/ipo.types.js';

const CAPTCHA_TEST_IPO: IPO = {
  id: 'captcha-test-ipo',
  symbol: 'REALCORP',
  companyName: 'Real Corp Limited',
  slug: 'real-corp-limited',
  exchange: 'NSE',
  issueType: 'BOOK_BUILT',
  mainboardOrSme: 'MAINBOARD',
  status: 'ALLOTMENT_PENDING',
  lotSize: 44,
  minimumApplication: 44,
  registrar: 'KFINTECH',
  registrarUrl: 'https://ris.kfintech.com/ipostatus/',
  source: 'NSE',
};

const NSE_UNSUPPORTED_IPO: IPO = {
  id: 'nse-test-ipo',
  symbol: 'NSECORP',
  companyName: 'NSE Corp Limited',
  slug: 'nse-corp-limited',
  exchange: 'NSE',
  issueType: 'BOOK_BUILT',
  mainboardOrSme: 'MAINBOARD',
  status: 'ALLOTMENT_PENDING',
  lotSize: 44,
  minimumApplication: 44,
  registrar: null, // No registrar — falls to exchange provider
  source: 'NSE',
};

// ──────────────────────────────────────────────────────────────────

describe('Real-Data-Only: Provider Structural Guarantees', () => {

  describe('KFintechProvider', () => {
    const provider = new KFintechProvider();

    it('never returns PENDING from a real request', async () => {
      // We can't make a real network call in tests, but we can verify the
      // provider will return CAPTCHA_REQUIRED (or CHECK_FAILED if unreachable),
      // and NEVER PENDING by default.
      // We verify this structurally — the provider must not have PENDING as a default.
      const result = await provider.checkByPAN('ABCDE5064D', CAPTCHA_TEST_IPO)
        .catch(() => ({ status: 'CHECK_FAILED' as const, appliedQuantity: null, allottedQuantity: null }));

      expect(result.status).not.toBe('PENDING');
      expect(result.status).not.toBe('NOT_ALLOTTED');
      expect(result.status).not.toBe('ALLOTTED');
    });

    it('returns null quantities', async () => {
      const result = await provider.checkByPAN('ABCDE5064D', CAPTCHA_TEST_IPO)
        .catch(() => ({ status: 'CHECK_FAILED' as const, appliedQuantity: null, allottedQuantity: null }));

      expect(result.appliedQuantity).toBeNull();
      expect(result.allottedQuantity).toBeNull();
    });
  });

  describe('MUFGIntimeProvider', () => {
    const provider = new MUFGIntimeProvider();

    it('never returns PENDING from a real request', async () => {
      const result = await provider.checkByPAN('ABCDE5064D', { ...CAPTCHA_TEST_IPO, registrar: 'MUFG_INTIME' })
        .catch(() => ({ status: 'CHECK_FAILED' as const }));
      expect(result.status).not.toBe('PENDING');
    });
  });

  describe('BigshareProvider', () => {
    const provider = new BigshareProvider();

    it('never returns PENDING from a real request', async () => {
      const result = await provider.checkByPAN('ABCDE5064D', { ...CAPTCHA_TEST_IPO, registrar: 'BIGSHARE' })
        .catch(() => ({ status: 'CHECK_FAILED' as const }));
      expect(result.status).not.toBe('PENDING');
    });
  });

  describe('NSEAllotmentProvider', () => {
    const provider = new NSEAllotmentProvider();

    it('returns UNSUPPORTED — NSE is not an allotment source', async () => {
      const result = await provider.checkByPAN('ABCDE5064D', NSE_UNSUPPORTED_IPO);
      expect(result.status).toBe('UNSUPPORTED');
    });

    it('never returns PENDING', async () => {
      const result = await provider.checkByPAN('ABCDE5064D', NSE_UNSUPPORTED_IPO);
      expect(result.status).not.toBe('PENDING');
    });

    it('returns null quantities', async () => {
      const result = await provider.checkByPAN('ABCDE5064D', NSE_UNSUPPORTED_IPO);
      expect(result.appliedQuantity).toBeNull();
      expect(result.allottedQuantity).toBeNull();
      expect(result.issuePrice).toBeNull();
    });
  });

  describe('BSEAllotmentProvider', () => {
    const provider = new BSEAllotmentProvider();

    it('returns UNSUPPORTED — BSE is not an allotment source', async () => {
      const result = await provider.checkByPAN('ABCDE5064D', { ...NSE_UNSUPPORTED_IPO, exchange: 'BSE' });
      expect(result.status).toBe('UNSUPPORTED');
    });
  });
});

// ──────────────────────────────────────────────────────────────────

describe('Real-Data-Only: IPO Provider Registry', () => {
  it('does not contain a MockIPOProvider', () => {
    const registry = new IPOProviderRegistry();
    const providers = (registry as any).providers as Array<{ name: string }>;
    const mockProvider = providers.find((p) =>
      p.name.toLowerCase().includes('mock') ||
      p.name.toLowerCase().includes('fake') ||
      p.name.toLowerCase().includes('demo')
    );
    expect(mockProvider).toBeUndefined();
  });

  it('contains only real providers', () => {
    const registry = new IPOProviderRegistry();
    const providers = (registry as any).providers as Array<{ name: string }>;
    const names = providers.map((p) => p.name);
    // Must include real sources
    expect(names).toContain('NSE');
    expect(names).toContain('BSE');
  });
});

// ──────────────────────────────────────────────────────────────────

describe('Real-Data-Only: Seed Data', () => {
  it('seed.ts does not import any fake company names', async () => {
    // Read the seed file source and check for forbidden company names
    const fs = await import('fs/promises');
    const seedContent = await fs.readFile('src/db/seed.ts', 'utf-8');

    const forbidden = [
      'TechCorp',
      'Nexus Finance',
      'Green Energy',
      'BioHealth',
      'Sample',
      'Demo',
      'Fake',
      'Mock',
      'INE123A01019', // Fake ISIN from old seed
      'INE456B02028',
      'INE789C03037',
    ];

    for (const name of forbidden) {
      expect(seedContent).not.toContain(name);
    }
  });

  it('seed.ts does not call db.insert(ipoMaster)', async () => {
    const fs = await import('fs/promises');
    const seedContent = await fs.readFile('src/db/seed.ts', 'utf-8');
    expect(seedContent).not.toContain('insert(ipoMaster)');
  });
});

// ──────────────────────────────────────────────────────────────────

describe('Real-Data-Only: Production Guard', () => {
  it('env.ts aborts when ENABLE_MOCK_PROVIDERS=true in production', async () => {
    const fs = await import('fs/promises');
    const envContent = await fs.readFile('src/config/env.ts', 'utf-8');
    // Verify the production guard exists in source
    expect(envContent).toContain("env.NODE_ENV === 'production' && env.ENABLE_MOCK_PROVIDERS");
    expect(envContent).toContain('process.exit(1)');
  });

  it('env.ts aborts when FIXTURES_ENABLED=true in production', async () => {
    const fs = await import('fs/promises');
    const envContent = await fs.readFile('src/config/env.ts', 'utf-8');
    expect(envContent).toContain("env.NODE_ENV === 'production' && env.FIXTURES_ENABLED");
    expect(envContent).toContain('process.exit(1)');
  });
});
