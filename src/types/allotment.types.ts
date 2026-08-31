export type AllotmentStatus =
  | 'ALLOTTED'
  | 'NOT_ALLOTTED'
  | 'PENDING'
  | 'NOT_FOUND'
  | 'CHECK_FAILED'
  | 'CAPTCHA_REQUIRED'
  | 'MANUAL_VERIFICATION_REQUIRED'
  | 'RATE_LIMITED'
  | 'ERROR'
  | 'UNKNOWN';

export type AllotmentConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AllotmentResult {
  panHash: string;
  maskedPan: string;
  ipoId: string;
  symbol?: string;
  companyName?: string;

  applicationNumber?: string;
  status: AllotmentStatus;

  appliedQuantity?: number;
  allottedQuantity?: number;

  issuePrice?: number;
  amountApplied?: number;
  amountAllotted?: number;
  refundAmount?: number;

  dematCreditStatus?: string;

  source: string;
  checkedAt: Date;
  confidence: AllotmentConfidence;
  rawReference?: string;
  fingerprint: string;
  errorMessage?: string;
}

export interface PANCheckSummary {
  maskedPan: string;
  totalIposFound: number;
  applicationsFound: number;
  allottedCount: number;
  notAllottedCount: number;
  pendingCount: number;
  results: AllotmentResult[];
}
