import type { NotificationProvider, NotificationPayload, PushoverPriority } from './NotificationProvider.interface.js';
import { env } from '../../config/env.js';
import { ProviderRateLimiterManager } from '../rateLimiter.js';
import { ProviderHealthTracker } from '../health.js';
import { logger } from '../../utils/logger.js';

export class PushoverNotificationProvider implements NotificationProvider {
  public readonly channel = 'PUSHOVER' as const;
  private readonly limiter = ProviderRateLimiterManager.getLimiter('PUSHOVER');

  public async send(payload: NotificationPayload): Promise<boolean> {
    const token = env.PUSHOVER_APP_TOKEN;
    const userKey = payload.pushoverUserKey || env.PUSHOVER_USER_KEY;

    if (!token || !userKey) {
      logger.debug('Pushover credentials not configured, skipping Pushover notification');
      return false;
    }

    const startTime = Date.now();
    let priority: PushoverPriority = payload.priority ?? 0;

    // Map Allotment status to priority rules
    if (payload.data?.allotmentResult?.status === 'ALLOTTED') {
      priority = 1; // High priority
    } else if (payload.data?.allotmentResult?.status === 'NOT_ALLOTTED') {
      priority = 0; // Normal
    } else if (payload.data?.allotmentResult?.status === 'PENDING') {
      priority = -1; // Low
    }

    const bodyData: Record<string, string> = {
      token,
      user: userKey,
      title: payload.title,
      message: payload.message.replace(/<[^>]*>?/gm, ''), // Strip HTML for pushover message body
      priority: String(priority),
    };

    if (payload.url) bodyData.url = payload.url;
    if (payload.urlTitle) bodyData.url_title = payload.urlTitle;
    if (payload.sound) bodyData.sound = payload.sound;

    return this.limiter.schedule(async () => {
      try {
        const response = await fetch('https://api.pushover.net/1/messages.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(bodyData).toString(),
        });

        const duration = Date.now() - startTime;

        if (response.ok) {
          await ProviderHealthTracker.recordSuccess('PUSHOVER', duration);
          logger.info({ userKey: userKey.slice(0, 4) + '***', title: payload.title }, 'Pushover notification delivered');
          return true;
        } else {
          const errText = await response.text();
          await ProviderHealthTracker.recordFailure('PUSHOVER', duration);
          logger.warn({ status: response.status, error: errText }, 'Pushover API returned non-200');
          return false;
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        await ProviderHealthTracker.recordFailure('PUSHOVER', duration);
        logger.warn({ error: (error as Error).message }, 'Failed to deliver Pushover notification');
        return false;
      }
    });
  }
}
