import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  APP_NAME: z.string().default('IPO-Intelligence-Platform'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // PostgreSQL Database
  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/ipo_db'),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(20),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),

  // Security & Cryptography
  PAN_ENCRYPTION_KEY: z
    .string()
    .min(64, 'PAN_ENCRYPTION_KEY must be a 64 hex characters (32 bytes)')
    .default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  PAN_HMAC_SECRET: z
    .string()
    .min(32, 'PAN_HMAC_SECRET must be at least 32 characters')
    .default('fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'),
  API_KEY_SECRET: z.string().default('dev_api_secret_key_for_rest_endpoints'),

  // Telegram Bot
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_URL: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  ADMIN_TELEGRAM_IDS: z
    .string()
    .default('')
    .transform((val) =>
      val
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map(Number)
    ),

  // Pushover API
  PUSHOVER_APP_TOKEN: z.string().optional(),
  PUSHOVER_USER_KEY: z.string().optional(),

  // IPO Data Providers
  UPSTOX_CLIENT_ID: z.string().optional(),
  UPSTOX_CLIENT_SECRET: z.string().optional(),
  IPO_GURU_API_KEY: z.string().optional(),
  IPO_NOTIFY_API_KEY: z.string().optional(),

  // Allotment Polling Policy
  ALLOTMENT_POLL_INTERVAL_MINUTES: z.coerce.number().default(5),
  ALLOTMENT_MAX_ATTEMPTS: z.coerce.number().default(100),
  ALLOTMENT_MAX_AGE_HOURS: z.coerce.number().default(72),
  BULK_WORKER_CONCURRENCY: z.coerce.number().default(5),

  // Mock Provider Safety
  ENABLE_MOCK_PROVIDERS: z
    .string()
    .default('false')
    .transform((val) => val.toLowerCase() === 'true'),

  // Fixture Safety — fixtures are ONLY allowed in test/development
  FIXTURES_ENABLED: z
    .string()
    .default('false')
    .transform((val) => val.toLowerCase() === 'true'),

  // Rate Limiting (RPM)
  LIMITER_NSE_RPM: z.coerce.number().default(30),
  LIMITER_BSE_RPM: z.coerce.number().default(30),
  LIMITER_MUFG_RPM: z.coerce.number().default(20),
  LIMITER_KFINTECH_RPM: z.coerce.number().default(20),
  LIMITER_BIGSHARE_RPM: z.coerce.number().default(20),
  LIMITER_UPSTOX_RPM: z.coerce.number().default(60),

  // Data Retention (Days)
  RAW_PROVIDER_DATA_RETENTION_DAYS: z.coerce.number().default(30),
  AUDIT_RETENTION_DAYS: z.coerce.number().default(365),
  RESULT_RETENTION_DAYS: z.coerce.number().default(3650),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env;

try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment configuration error:');
    for (const issue of error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
  }
  process.exit(1);
}

export const env = parsedEnv;

// ══════════════════════════════════════════════════════════════════
// PRODUCTION GUARD: Prevent fabricated/mock data from ever reaching production.
// If NODE_ENV=production and ENABLE_MOCK_PROVIDERS=true, abort immediately.
// ══════════════════════════════════════════════════════════════════
if (env.NODE_ENV === 'production' && env.ENABLE_MOCK_PROVIDERS) {
  console.error('');
  console.error('╔══════════════════════════════════════════════════════════════╗');
  console.error('║  FATAL: ENABLE_MOCK_PROVIDERS=true in production mode!      ║');
  console.error('║  Mock providers generate FABRICATED data.                   ║');
  console.error('║  This violates the REAL-DATA-ONLY policy.                   ║');
  console.error('║  Remove ENABLE_MOCK_PROVIDERS or set NODE_ENV=development.  ║');
  console.error('╚══════════════════════════════════════════════════════════════╝');
  console.error('');
  process.exit(1);
}

if (env.NODE_ENV === 'production' && env.FIXTURES_ENABLED) {
  console.error('');
  console.error('╔══════════════════════════════════════════════════════════════╗');
  console.error('║  FATAL: FIXTURES_ENABLED=true in production mode!           ║');
  console.error('║  Fixture/test data must NEVER run in production.            ║');
  console.error('║  Remove FIXTURES_ENABLED or set NODE_ENV=development.       ║');
  console.error('╚══════════════════════════════════════════════════════════════╝');
  console.error('');
  process.exit(1);
}
