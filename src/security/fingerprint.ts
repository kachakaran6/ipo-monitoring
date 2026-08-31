import crypto from 'node:crypto';

/**
 * Computes deterministic fingerprint for an allotment result to detect state transitions.
 * sha256(panHash + ipoId + status + allottedQuantity + issuePrice)
 */
export function generateResultFingerprint(params: {
  panHash: string;
  ipoId: string;
  status: string;
  allottedQuantity?: number;
  issuePrice?: number;
}): string {
  const content = [
    params.panHash,
    params.ipoId,
    params.status,
    params.allottedQuantity ?? 0,
    params.issuePrice ?? 0,
  ].join(':');

  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generates deduplication fingerprint for outbound notifications.
 * hash(userId + panHash + ipoId + eventType + state)
 */
export function generateNotificationFingerprint(params: {
  userId?: string;
  panHash?: string;
  ipoId?: string;
  eventType: string;
  state?: string;
}): string {
  const content = [
    params.userId || 'global',
    params.panHash || 'none',
    params.ipoId || 'none',
    params.eventType,
    params.state || 'none',
  ].join(':');

  return crypto.createHash('sha256').update(content).digest('hex');
}
