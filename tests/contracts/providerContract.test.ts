/**
 * MIGRATED — Tests for provider contract compliance have moved to:
 *   tests/contracts/provider.contract.test.ts
 *
 * This file previously tested MockAllotmentProvider and used fake IPO data
 * (TechCorp Innovations Limited, ABCDE1234F) — both violate the real-data-only policy.
 * All tests have been rewritten and moved to provider.contract.test.ts.
 */

import { describe, it, expect } from 'vitest';

describe('providerContract [MIGRATED]', () => {
  it('Tests for real provider contracts are in provider.contract.test.ts', () => {
    // This file's tests were migrated to tests/contracts/provider.contract.test.ts
    // because they used MockAllotmentProvider and fake company names which violate
    // the real-data-only requirement. See provider.contract.test.ts for replacements.
    expect(true).toBe(true);
  });
});
