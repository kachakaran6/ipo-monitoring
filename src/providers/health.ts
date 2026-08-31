import { db } from '../db/index.js';
import { providerHealth } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import type { ProviderHealth, ProviderHealthStatus } from '../types/provider.types.js';
import { logger } from '../utils/logger.js';

export class ProviderHealthTracker {
  private static inMemoryHealth: Map<string, ProviderHealth> = new Map();

  public static async recordSuccess(providerName: string, latencyMs: number): Promise<void> {
    const key = providerName.toUpperCase();
    const now = new Date();

    const current = this.inMemoryHealth.get(key) || {
      provider: key,
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      latencyMs,
      lastSuccessAt: now,
      status: 'HEALTHY' as ProviderHealthStatus,
      updatedAt: now,
    };

    current.successCount++;
    current.consecutiveFailures = 0;
    current.latencyMs = Math.round((current.latencyMs * 0.7) + (latencyMs * 0.3)); // EWMA
    current.lastSuccessAt = now;
    current.status = 'HEALTHY';
    current.updatedAt = now;

    this.inMemoryHealth.set(key, current);

    // Async sync to DB
    this.persistToDb(current).catch((err) =>
      logger.debug({ error: err.message }, 'Failed to persist provider health to DB')
    );
  }

  public static async recordFailure(providerName: string, latencyMs: number): Promise<void> {
    const key = providerName.toUpperCase();
    const now = new Date();

    const current = this.inMemoryHealth.get(key) || {
      provider: key,
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      latencyMs,
      status: 'HEALTHY' as ProviderHealthStatus,
      updatedAt: now,
    };

    current.failureCount++;
    current.consecutiveFailures++;
    current.latencyMs = latencyMs;
    current.lastFailureAt = now;
    current.updatedAt = now;

    if (current.consecutiveFailures >= 5) {
      current.status = 'UNAVAILABLE';
    } else if (current.consecutiveFailures >= 2) {
      current.status = 'DEGRADED';
    }

    this.inMemoryHealth.set(key, current);

    this.persistToDb(current).catch((err) =>
      logger.debug({ error: err.message }, 'Failed to persist provider health to DB')
    );
  }

  public static async getHealth(providerName: string): Promise<ProviderHealth | null> {
    const key = providerName.toUpperCase();
    if (this.inMemoryHealth.has(key)) {
      return this.inMemoryHealth.get(key)!;
    }

    try {
      const [record] = await db
        .select()
        .from(providerHealth)
        .where(eq(providerHealth.provider, key));

      if (record) {
        const health: ProviderHealth = {
          provider: record.provider,
          successCount: record.successCount,
          failureCount: record.failureCount,
          consecutiveFailures: record.consecutiveFailures,
          latencyMs: record.latencyMs,
          lastSuccessAt: record.lastSuccessAt,
          lastFailureAt: record.lastFailureAt,
          status: record.status as ProviderHealthStatus,
          updatedAt: record.updatedAt,
        };
        this.inMemoryHealth.set(key, health);
        return health;
      }
    } catch {
      // Fallback
    }

    return null;
  }

  public static async getAllHealth(): Promise<ProviderHealth[]> {
    try {
      const records = await db.select().from(providerHealth);
      if (records.length > 0) {
        return records.map((r) => ({
          provider: r.provider,
          successCount: r.successCount,
          failureCount: r.failureCount,
          consecutiveFailures: r.consecutiveFailures,
          latencyMs: r.latencyMs,
          lastSuccessAt: r.lastSuccessAt,
          lastFailureAt: r.lastFailureAt,
          status: r.status as ProviderHealthStatus,
          updatedAt: r.updatedAt,
        }));
      }
    } catch {
      // Fallback to in-memory
    }
    return Array.from(this.inMemoryHealth.values());
  }

  private static async persistToDb(health: ProviderHealth): Promise<void> {
    try {
      await db
        .insert(providerHealth)
        .values({
          provider: health.provider,
          successCount: health.successCount,
          failureCount: health.failureCount,
          consecutiveFailures: health.consecutiveFailures,
          latencyMs: health.latencyMs,
          lastSuccessAt: health.lastSuccessAt,
          lastFailureAt: health.lastFailureAt,
          status: health.status,
          updatedAt: health.updatedAt,
        })
        .onConflictDoUpdate({
          target: providerHealth.provider,
          set: {
            successCount: health.successCount,
            failureCount: health.failureCount,
            consecutiveFailures: health.consecutiveFailures,
            latencyMs: health.latencyMs,
            lastSuccessAt: health.lastSuccessAt,
            lastFailureAt: health.lastFailureAt,
            status: health.status,
            updatedAt: health.updatedAt,
          },
        });
    } catch {
      // Non-blocking
    }
  }
}
