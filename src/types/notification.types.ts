import type { AllotmentResult } from './allotment.types.js';
import type { IPO } from './ipo.types.js';

export type NotificationChannelType = 'TELEGRAM' | 'PUSHOVER';

export type NotificationEventType =
  | 'ALLOTMENT_RESULT_CHANGED'
  | 'IPO_OPENED'
  | 'IPO_CLOSING_TODAY'
  | 'IPO_ALLOTMENT_PUBLISHED'
  | 'IPO_LISTING_TODAY'
  | 'BULK_CHECK_COMPLETED'
  | 'SYSTEM_ALERT';

export type PushoverPriority = -2 | -1 | 0 | 1 | 2;

export interface NotificationPayload {
  userId?: string;
  telegramChatId?: number | string;
  pushoverUserKey?: string;
  eventType: NotificationEventType;
  title: string;
  message: string;
  priority?: PushoverPriority;
  sound?: string;
  url?: string;
  urlTitle?: string;
  data?: {
    allotmentResult?: AllotmentResult;
    ipo?: IPO;
    bulkJobId?: string;
  };
  fingerprint: string;
}

export interface UserNotificationPreferences {
  telegramEnabled: boolean;
  pushoverEnabled: boolean;
  allotmentAlerts: boolean;
  ipoOpeningAlerts: boolean;
  ipoClosingAlerts: boolean;
  listingAlerts: boolean;
  gmpAlerts: boolean;
  subscriptionAlerts: boolean;
  highPriorityOnly: boolean;
}

export interface NotificationProvider {
  readonly channel: NotificationChannelType;
  send(payload: NotificationPayload): Promise<boolean>;
}
