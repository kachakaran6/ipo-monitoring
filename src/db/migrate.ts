import { sql } from './index.js';
import { logger } from '../utils/logger.js';
import fs from 'node:fs';
import path from 'node:path';

export async function runMigrations(): Promise<void> {
  logger.info('Starting database migrations...');

  try {
    // Create migrations table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS _drizzle_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    const migrationsDir = path.resolve(process.cwd(), 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      logger.warn('No migrations directory found, skipping.');
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const [existing] = await sql`
        SELECT id FROM _drizzle_migrations WHERE name = ${file}
      `;

      if (existing) {
        logger.debug({ file }, 'Migration already applied, skipping');
        continue;
      }

      logger.info({ file }, `Applying migration: ${file}`);
      const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      // Execute in transaction
      await sql.begin(async (tx) => {
        await tx.unsafe(sqlContent);
        await tx`
          INSERT INTO _drizzle_migrations (name) VALUES (${file});
        `;
      });

      logger.info({ file }, `Successfully applied migration: ${file}`);
    }

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Failed to run database migrations');
    throw error;
  }
}

// Allow direct execution: `tsx src/db/migrate.ts`
if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
