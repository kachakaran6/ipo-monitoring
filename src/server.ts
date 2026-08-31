import { buildApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import { closeDatabaseConnection } from './db/index.js';
import { closeRedisConnection } from './queues/connection.js';
import { telegramBot } from './modules/telegram/bot.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

async function startServer(): Promise<void> {
  logger.info('🚀 Initializing IPO Intelligence Server...');

  // Auto-run migrations in non-production or if configured
  try {
    await runMigrations();
    await seedDatabase();
  } catch (error) {
    logger.warn({ error: (error as Error).message }, 'Migration/Seed skipped or failed on startup');
  }

  const app = await buildApp();

  // Start Telegram Bot in Long Polling or Webhook mode
  if (telegramBot && env.NODE_ENV !== 'test') {
    if (env.TELEGRAM_WEBHOOK_URL) {
      const webhookEndpoint = `${env.TELEGRAM_WEBHOOK_URL.replace(/\/$/, '')}/webhooks/telegram`;
      logger.info({ webhookEndpoint }, 'Registering Telegram Webhook with Telegram servers...');
      telegramBot.api
        .setWebhook(webhookEndpoint, {
          secret_token: env.TELEGRAM_WEBHOOK_SECRET || undefined,
        })
        .then(() => logger.info('✅ Telegram Webhook registered successfully'))
        .catch((err) => logger.error({ error: err.message }, 'Failed to set Telegram webhook'));
    } else {
      logger.info('Starting Telegram Bot in long-polling mode...');
      telegramBot.start({
        onStart: (botInfo) => {
          logger.info({ username: botInfo.username }, '🚀 Telegram bot polling active and listening for messages');
        },
      });
    }
  }

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`✨ Server listening at http://${env.HOST}:${env.PORT}`);
    logger.info(`📚 Swagger OpenAPI docs at http://${env.HOST}:${env.PORT}/docs`);
  } catch (err) {
    logger.fatal({ error: (err as Error).message }, 'Failed to start Fastify server');
    process.exit(1);
  }

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down server gracefully...');

    if (telegramBot) {
      await telegramBot.stop();
    }

    await app.close();
    await closeRedisConnection();
    await closeDatabaseConnection();

    logger.info('Server shutdown completed');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Support executing as background worker when PROCESS_TYPE=worker is set
if (process.env.PROCESS_TYPE === 'worker') {
  logger.info('PROCESS_TYPE=worker detected, launching BullMQ worker subsystem...');
  import('./worker.js');
} else {
  startServer();
}
