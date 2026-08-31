import { db } from '../../db/index.js';
import { ipoMaster, ipoSubscriptionSnapshots } from '../../db/schema.js';
import { eq, and, desc, count } from 'drizzle-orm';
import type { ListIposQuery } from './ipo.schema.js';
import { IPOUnavailableError } from '../../errors/index.js';

export class IPOService {
  /**
   * List IPOs from the database. Returns honest empty state if no IPOs exist.
   * NEVER falls back to in-memory fabricated data.
   */
  public async listIPOs(query: ListIposQuery) {
    const { status, type, page, limit } = query;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) conditions.push(eq(ipoMaster.status, status));
    if (type) conditions.push(eq(ipoMaster.mainboardOrSme, type));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [ipos, totalCount] = await Promise.all([
      db
        .select()
        .from(ipoMaster)
        .where(whereClause)
        .orderBy(desc(ipoMaster.openDate), desc(ipoMaster.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(ipoMaster)
        .where(whereClause),
    ]);

    const total = Number(totalCount[0]?.total || 0);

    return {
      ipos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public async getIPOById(idOrSlug: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    const [ipo] = await db
      .select()
      .from(ipoMaster)
      .where(isUuid ? eq(ipoMaster.id, idOrSlug) : eq(ipoMaster.slug, idOrSlug))
      .limit(1);

    if (!ipo) {
      throw new IPOUnavailableError(idOrSlug);
    }

    return ipo;
  }

  public async getSubscriptionHistory(ipoId: string) {
    const ipo = await this.getIPOById(ipoId);

    const snapshots = await db
      .select()
      .from(ipoSubscriptionSnapshots)
      .where(eq(ipoSubscriptionSnapshots.ipoId, ipo.id))
      .orderBy(desc(ipoSubscriptionSnapshots.snapshotAt))
      .limit(50);

    return {
      ipo,
      snapshots,
    };
  }
}

export const ipoService = new IPOService();
