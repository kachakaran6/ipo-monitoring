import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../errors/index.js';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export function globalErrorHandler(
  error: FastifyError | Error,
  req: FastifyRequest,
  reply: FastifyReply
) {
  logger.error(
    {
      url: req.url,
      method: req.method,
      errorName: error.name,
      errorMessage: error.message,
    },
    'Request processing error'
  );

  // 1. Zod Validation Errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload or query parameters',
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Custom Domain Errors
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.errorCode,
        message: error.message,
        details: error.details,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // 3. Fastify HTTP Errors (e.g. rate limit, 404)
  const statusCode = (error as FastifyError).statusCode || 500;
  return reply.status(statusCode).send({
    success: false,
    error: {
      code: statusCode === 429 ? 'RATE_LIMIT_EXCEEDED' : 'INTERNAL_SERVER_ERROR',
      message: statusCode === 500 ? 'An unexpected server error occurred' : error.message,
    },
    timestamp: new Date().toISOString(),
  });
}
