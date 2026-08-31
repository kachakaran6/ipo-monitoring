import pino from 'pino';
import { env } from '../config/env.js';

const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;

/**
 * Recursively redacts PAN occurrences in objects or strings before logging.
 */
function redactPAN(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(PAN_REGEX, (match) => {
      const last4 = match.slice(-4);
      return `XXXXX${last4}`;
    });
  }

  if (Array.isArray(value)) {
    return value.map(redactPAN);
  }

  if (value !== null && typeof value === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.toLowerCase().includes('pan') && typeof v === 'string' && v.length === 10) {
        redacted[k] = `XXXXX${v.slice(-4)}`;
      } else {
        redacted[k] = redactPAN(v);
      }
    }
    return redacted;
  }

  return value;
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
