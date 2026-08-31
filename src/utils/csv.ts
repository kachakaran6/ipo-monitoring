import { parse } from 'csv-parse/sync';
import { isValidPAN, normalizeAndValidatePAN, maskPAN } from '../security/crypto.js';

export interface ParsedPANRow {
  pan: string;
  normalizedPan: string;
  maskedPan: string;
  label?: string;
  telegramChatId?: string;
  pushoverUserKey?: string;
  isValid: boolean;
  errorReason?: string;
}

export interface BulkParseResult {
  totalRows: number;
  accepted: ParsedPANRow[];
  rejected: ParsedPANRow[];
  uniqueAcceptedPans: ParsedPANRow[];
  duplicateCount: number;
}

/**
 * Parses raw text or CSV content containing PAN numbers.
 * Supports:
 * 1. Plain line-separated PANs
 * 2. CSV with header 'pan,label,telegram_chat_id,pushover_user_key'
 * 3. Headerless CSV 'PAN,Label'
 */
export function parseBulkPANInput(content: string): BulkParseResult {
  if (!content || typeof content !== 'string') {
    return {
      totalRows: 0,
      accepted: [],
      rejected: [],
      uniqueAcceptedPans: [],
      duplicateCount: 0,
    };
  }

  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return {
      totalRows: 0,
      accepted: [],
      rejected: [],
      uniqueAcceptedPans: [],
      duplicateCount: 0,
    };
  }

  const accepted: ParsedPANRow[] = [];
  const rejected: ParsedPANRow[] = [];

  // Check if first line contains a header
  const firstLineTokens = lines[0]?.split(/[,\s\t]+/).map((s) => s.trim()) || [];
  const firstToken = firstLineTokens[0] || '';
  const firstLineIsHeader = !isValidPAN(firstToken) && isNaN(Number(firstToken)) && firstToken.length < 10;

  const dataLines = firstLineIsHeader ? lines.slice(1) : lines;

  for (const line of dataLines) {
    // Split by comma or whitespace
    let parts: string[] = [];
    if (line.includes(',')) {
      try {
        const parsedRow = parse(line, { relax_quotes: true, skip_empty_lines: true })[0] as string[];
        parts = parsedRow.map((s) => (s ? s.trim() : ''));
      } catch {
        parts = line.split(',').map((s) => s.trim());
      }
    } else {
      parts = line.split(/[\s\t]+/).map((s) => s.trim()).filter(Boolean);
    }

    const rawPan = parts[0] || '';
    const label = parts[1] || undefined;
    const telegramChatId = parts[2] || undefined;
    const pushoverUserKey = parts[3] || undefined;

    if (isValidPAN(rawPan)) {
      const normalized = normalizeAndValidatePAN(rawPan);
      accepted.push({
        pan: rawPan,
        normalizedPan: normalized,
        maskedPan: maskPAN(normalized),
        label,
        telegramChatId,
        pushoverUserKey,
        isValid: true,
      });
    } else {
      rejected.push({
        pan: rawPan,
        normalizedPan: '',
        maskedPan: maskPAN(rawPan),
        label,
        isValid: false,
        errorReason: 'Invalid PAN format',
      });
    }
  }

  // Deduplicate accepted PANs
  const seen = new Set<string>();
  const uniqueAccepted: ParsedPANRow[] = [];
  let duplicates = 0;

  for (const item of accepted) {
    if (!seen.has(item.normalizedPan)) {
      seen.add(item.normalizedPan);
      uniqueAccepted.push(item);
    } else {
      duplicates++;
    }
  }

  return {
    totalRows: accepted.length + rejected.length,
    accepted,
    rejected,
    uniqueAcceptedPans: uniqueAccepted,
    duplicateCount: duplicates,
  };
}

/**
 * Generates accepted and rejected CSV string reports.
 */
export function generateCsvReports(result: BulkParseResult): {
  acceptedCsv: string;
  rejectedCsv: string;
} {
  const acceptedLines = [
    'pan_masked,label,status',
    ...result.uniqueAcceptedPans.map(
      (r) => `"${r.maskedPan}","${r.label || ''}","ACCEPTED"`
    ),
  ];

  const rejectedLines = [
    'raw_input,label,reason',
    ...result.rejected.map(
      (r) => `"${r.pan}","${r.label || ''}","${r.errorReason || 'Invalid PAN'}"`
    ),
  ];

  return {
    acceptedCsv: acceptedLines.join('\n'),
    rejectedCsv: rejectedLines.join('\n'),
  };
}
