export type AllotmentStatus =
  | 'ALLOTTED'
  | 'NOT_ALLOTTED'
  | 'PENDING'
  | 'NOT_FOUND'
  | 'CHECK_FAILED'
  | 'CAPTCHA_REQUIRED'
  | 'AUTH_REQUIRED'
  | 'RATE_LIMITED'
  | 'UNSUPPORTED'
  | 'MANUAL_VERIFICATION_REQUIRED'
  | 'ERROR'
  | 'UNKNOWN';

export type AllotmentConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * DataQuality score for every allotment result.
 * VERIFIED  = authoritative source returned a valid, complete response.
 * PARTIAL   = authoritative source returned a response but some optional fields are missing.
 * CONFLICT  = two authoritative sources disagree on the status.
 * FAILED    = technical failure; no data could be obtained.
 */
export type DataQuality = 'VERIFIED' | 'PARTIAL' | 'CONFLICT' | 'FAILED';

/**
 * DataProvenance: every data field must be traceable to its authoritative source.
 * This is the anti-fabrication mechanism — if provenance is missing, the data is suspect.
 */
export interface DataProvenance {
  /** Provider identifier, e.g. 'KFINTECH', 'MUFG_INTIME', 'NSE' */
  source: string;
  sourceType: 'NSE' | 'BSE' | 'RTA' | 'LICENSED_API';
  /** The exact URL queried */
  sourceUrl?: string;
  /** When this data was fetched from the source */
  fetchedAt: Date;
  confidence: 'AUTHORITATIVE' | 'SECONDARY';
  /** HMAC of normalized response fields for deduplication */
  responseFingerprint?: string;
}

export interface AllotmentResult {
  panHash: string;
  maskedPan: string;
  ipoId: string;
  symbol?: string;
  companyName?: string;

  applicationNumber?: string;
  status: AllotmentStatus;

  /**
   * Only set if the authoritative source explicitly returned this value.
   * MUST be null if the source did not return it.
   * NEVER infer from lot size, issue price, or subscription data.
   */
  appliedQuantity?: number | null;
  allottedQuantity?: number | null;

  /**
   * Only set if the authoritative source explicitly returned this value.
   * MUST be null if the source did not return it.
   * NEVER calculate or guess.
   */
  issuePrice?: number | null;
  amountApplied?: number | null;
  amountAllotted?: number | null;
  refundAmount?: number | null;

  dematCreditStatus?: string;

  source: string;
  checkedAt: Date;
  confidence: AllotmentConfidence;
  qualityScore?: DataQuality;
  rawReference?: string;
  fingerprint: string;
  errorMessage?: string;

  /** Full provenance chain for this result */
  provenance?: DataProvenance;
  /** Direct URL to registrar portal for manual verification */
  registrarUrl?: string;
}

/**
 * Tracks coverage quality of a PAN check run.
 * Displayed to admin; summary version shown to users.
 */
export interface CheckCoverage {
  discoveredIPOs: number;
  eligibleIPOs: number;
  successfullyChecked: number;
  applicationsFound: number;
  captchaRequired: number;
  providerFailures: number;
  unsupportedProviders: number;
}

/**
 * Summary of a single-PAN check across all eligible IPOs.
 */
export interface PANCheckSummary {
  maskedPan: string;
  totalIposFound: number;
  eligibleIpos: number;
  applicationsFound: number;
  allottedCount: number;
  notAllottedCount: number;
  pendingCount: number;
  captchaRequiredCount: number;
  checkFailedCount: number;
  unsupportedCount: number;
  coverage: CheckCoverage;
  results: AllotmentResult[];
  lastSyncAt?: Date | null;
}
