import { describe, it, expect } from 'vitest';
import { parseBulkPANInput, generateCsvReports } from '../../src/utils/csv.js';

describe('Bulk PAN & CSV Parsing Module', () => {
  it('should parse line-separated PANs, normalize uppercase and deduplicate', () => {
    const rawInput = `
      abcde1234f
      ABCDE1234F
      FGHIJ5678K
      INVALID_PAN_123
    `;

    const result = parseBulkPANInput(rawInput);

    expect(result.totalRows).toBe(4);
    expect(result.uniqueAcceptedPans.length).toBe(2);
    expect(result.duplicateCount).toBe(1);
    expect(result.rejected.length).toBe(1);
    expect(result.rejected[0]?.pan).toBe('INVALID_PAN_123');
  });

  it('should parse structured CSV format with column headers', () => {
    const csvContent = `
pan,label,telegram_chat_id
ABCDE1234F,Primary Account,123456
FGHIJ5678K,Secondary Account,987654
BADPAN9999,Malformed Row,000000
    `;

    const result = parseBulkPANInput(csvContent);

    expect(result.uniqueAcceptedPans.length).toBe(2);
    expect(result.uniqueAcceptedPans[0]?.label).toBe('Primary Account');
    expect(result.rejected.length).toBe(1);
  });

  it('should generate accepted and rejected CSV reports', () => {
    const rawInput = 'ABCDE1234F,Account 1\nBADPAN,Invalid\n';
    const parseResult = parseBulkPANInput(rawInput);
    const reports = generateCsvReports(parseResult);

    expect(reports.acceptedCsv).toContain('XXXXX1234F');
    expect(reports.acceptedCsv).toContain('Account 1');
    expect(reports.rejectedCsv).toContain('BADPAN');
    expect(reports.rejectedCsv).toContain('Invalid PAN');
  });
});
