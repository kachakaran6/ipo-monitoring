export interface AllotmentCheckJobData {
  panHash: string;
  encryptedPan: string;
  ipoId: string;
  userId?: string;
  telegramChatId?: number | string;
  pushoverUserKey?: string;
  sourceJobId?: string;
  isPolling?: boolean;
  pollAttempt?: number;
}

export interface BulkPanJobData {
  bulkJobId: string;
  userId?: string;
  telegramChatId?: number | string;
  pushoverUserKey?: string;
  pans: Array<{
    encryptedPan: string;
    panHash: string;
    panLast4: string;
    label?: string;
  }>;
}

export interface IPOSyncJobData {
  force?: boolean;
  targetProvider?: string;
}

export interface NotificationJobData {
  userId?: string;
  telegramChatId?: number | string;
  pushoverUserKey?: string;
  payload: import('./notification.types.js').NotificationPayload;
}
