import pino from 'pino';
import { env } from '../config/env.js';

const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;

/**
 * Recursively redacts PAN occurrences in objects or strings before logging.
 * Protected against circular references and deep Fastify internals.
 */
function redactPAN(value: unknown, seen = new WeakSet(), depth = 0): unknown {
  if (depth > 6) return value;

  if (typeof value === 'string') {
    return value.replace(PAN_REGEX, (match) => {
      const last4 = match.slice(-4);
      return `XXXXX${last4}`;
    });
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value as object)) {
    return '[Circular]';
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redactPAN(item, seen, depth + 1));
  }

  const redacted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    // Skip traversing deep Fastify internal sockets / streams
    if (k === 'req' || k === 'res' || k === 'raw' || k === 'socket') {
      redacted[k] = v;
      continue;
    }

    if (k.toLowerCase().includes('pan') && typeof v === 'string' && v.length === 10) {
      redacted[k] = `XXXXX${v.slice(-4)}`;
    } else {
      redacted[k] = redactPAN(v, seen, depth + 1);
    }
  }
  return redacted;
}

export const logger = pino({
  level: env.LOG_LEVEL,
  formatters: {
    log(obj) {
      return redactPAN(obj) as Record<string, unknown>;
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard',
          },
        }
      : undefined,
});
