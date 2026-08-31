import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import multipart from '@fastify/multipart';
import { v1Routes } from './routes/v1/index.js';
import { globalErrorHandler } from './middleware/errorHandler.js';
import { checkDatabaseConnection } from './db/index.js';
import { checkRedisConnection } from './queues/connection.js';
import { telegramBot } from './modules/telegram/bot.js';
import { webhookCallback } from 'grammy';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: logger as any,
  }) as FastifyInstance;

  // 1. Security Headers (Helmet)
  await app.register(helmet, {
    contentSecurityPolicy: false, // Swagger compatibility
  });

  // 2. Cross-Origin Resource Sharing (CORS)
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // 3. Multi-part file upload support (CSV/TXT bulk upload)
  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5 MB
    },
  });

  // 4. Rate Limiting on API requests
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // 5. OpenAPI Swagger Documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Indian IPO Intelligence & Allotment Platform API',
        description: 'High-throughput, secure Indian IPO allotment checker and notification system',
        version: '1.0.0',
      },
      servers: [{ url: `http://localhost:${env.PORT}` }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // 6. Global Error Handler
  app.setErrorHandler(globalErrorHandler);

  // 7. Liveness & Readiness Probes
  app.get('/health', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', async (_req, reply) => {
    const [dbUp, redisUp] = await Promise.all([
      checkDatabaseConnection(),
      checkRedisConnection(),
    ]);

    const isReady = dbUp && redisUp;
    const statusCode = isReady ? 200 : 503;

    return reply.status(statusCode).send({
      status: isReady ? 'ready' : 'degraded',
      checks: {
        database: dbUp ? 'up' : 'down',
        redis: redisUp ? 'up' : 'down',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // 8. Telegram Webhook Endpoint
  const activeBot = telegramBot;
  if (activeBot) {
    app.post('/webhooks/telegram', async (req, reply) => {
      const secret = req.headers['x-telegram-bot-api-secret-token'];
      if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
        return reply.status(401).send({ error: 'Invalid webhook secret' });
      }

      const callback = webhookCallback(activeBot, 'fastify');
      return callback(req as any, reply as any);
    });
  }

  // 9. Register API v1 Routes
  await app.register(v1Routes, { prefix: '/api/v1' });

  return app;
}
