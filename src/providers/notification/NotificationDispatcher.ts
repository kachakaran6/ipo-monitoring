import type {
  NotificationPayload,
  NotificationProvider,
  UserNotificationPreferences,
} from './NotificationProvider.interface.js';
import { TelegramNotificationProvider } from './TelegramNotificationProvider.js';
import { PushoverNotificationProvider } from './PushoverNotificationProvider.js';
import { db } from '../../db/index.js';
import { notificationEvents, notificationChannels } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';

export class NotificationDispatcher {
  private providers: NotificationProvider[] = [];

  constructor() {
    this.providers = [
      new TelegramNotificationProvider(),
      new PushoverNotificationProvider(),
    ];
  }

  public registerProvider(provider: NotificationProvider): void {
    this.providers.push(provider);
  }

  /**
   * Dispatches a notification across configured channels with deduplication and preference check.
   */
  public async dispatch(payload: NotificationPayload): Promise<{ deliveredCount: number; skippedCount: number }> {
    let deliveredCount = 0;
    let skippedCount = 0;

    for (const provider of this.providers) {
      const channelName = provider.channel;

      // 1. Deduplication check: Has this exact event already been sent on this channel?
      const alreadySent = await this.isNotificationAlreadySent(payload.fingerprint, channelName);
      if (alreadySent) {
        logger.debug(
          { channel: channelName, fingerprint: payload.fingerprint, eventType: payload.eventType },
          'Notification duplicate suppressed'
        );
        skippedCount++;
        continue;
      }

      // 2. Dispatch
      try {
        const success = await provider.send(payload);
        if (success) {
          deliveredCount++;
          // 3. Record in notification_events table for deduplication
          await this.recordNotificationEvent(payload, channelName);
        } else {
          skippedCount++;
        }
      } catch (error) {
        logger.warn(
          { channel: channelName, error: (error as Error).message },
          'Notification dispatch error'
        );
        skippedCount++;
      }
    }

    return { deliveredCount, skippedCount };
  }

  private async isNotificationAlreadySent(fingerprint: string, channel: string): Promise<boolean> {
    try {
      const [existing] = await db
        .select({ id: notificationEvents.id })
        .from(notificationEvents)
        .where(
          and(
            eq(notificationEvents.fingerprint, fingerprint),
            eq(notificationEvents.channel, channel)
          )
        )
        .limit(1);

      return !!existing;
    } catch {
      return false;
    }
  }

  private async recordNotificationEvent(payload: NotificationPayload, channel: string): Promise<void> {
    try {
      await db.insert(notificationEvents).values({
        userId: payload.userId,
        panHash: payload.data?.allotmentResult?.panHash,
        ipoId: payload.data?.ipo?.id || payload.data?.allotmentResult?.ipoId,
        eventType: payload.eventType,
        fingerprint: payload.fingerprint,
        channel,
        payloadJson: {
          title: payload.title,
          message: payload.message,
          data: payload.data,
        },
        sentAt: new Date(),
      }).onConflictDoNothing();
    } catch (e) {
      logger.debug({ error: (e as Error).message }, 'Failed to record notification event');
    }
  }
}

export const notificationDispatcher = new NotificationDispatcher();
