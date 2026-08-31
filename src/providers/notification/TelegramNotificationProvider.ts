import { Bot } from 'grammy';
import type { NotificationProvider, NotificationPayload } from './NotificationProvider.interface.js';
import { env } from '../../config/env.js';
import { ProviderRateLimiterManager } from '../rateLimiter.js';
import { ProviderHealthTracker } from '../health.js';
import { logger } from '../../utils/logger.js';

export class TelegramNotificationProvider implements NotificationProvider {
  public readonly channel = 'TELEGRAM' as const;
  private bot: Bot | null = null;
  private readonly limiter = ProviderRateLimiterManager.getLimiter('TELEGRAM');

  constructor(customBot?: Bot) {
    if (customBot) {
      this.bot = customBot;
    } else if (env.TELEGRAM_BOT_TOKEN) {
      this.bot = new Bot(env.TELEGRAM_BOT_TOKEN);
    }
  }

  public setBot(bot: Bot): void {
    this.bot = bot;
  }

  public async send(payload: NotificationPayload): Promise<boolean> {
    if (!this.bot || !payload.telegramChatId) {
      logger.debug({ payload }, 'Telegram bot not initialized or chatId missing, skipping send');
      return false;
    }

    const startTime = Date.now();
    const chatId = payload.telegramChatId;

    return this.limiter.schedule(async () => {
      try {
        await this.bot!.api.sendMessage(chatId, payload.message, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        });

        const duration = Date.now() - startTime;
        await ProviderHealthTracker.recordSuccess('TELEGRAM', duration);
        logger.info({ chatId, eventType: payload.eventType }, 'Telegram notification delivered');
        return true;
      } catch (error) {
        const duration = Date.now() - startTime;
        await ProviderHealthTracker.recordFailure('TELEGRAM', duration);
        logger.warn(
          { chatId, error: (error as Error).message },
          'Failed to deliver Telegram notification'
        );
        return false;
      }
    });
  }
}
