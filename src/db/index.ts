import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const sql = postgres(env.DATABASE_URL, {
  max: env.DATABASE_POOL_MAX,
  idle_timeout: 20,
  connect_timeout: 2,
  onnotice: () => {}, // Suppress noisy PG notices
});

export const db = drizzle(sql, { schema });

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await Promise.race([
      sql`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000)),
    ]);
    return true;
  } catch (error) {
    if (env.NODE_ENV !== 'test') {
      logger.error({ error: (error as Error).message }, 'Database connection health check failed');
    }
    return false;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  try {
    await sql.end({ timeout: 2 });
  } catch {
    // Non-blocking
  }
}
