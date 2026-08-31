import { db } from '../../db/index.js';
import { ipoMaster, ipoSubscriptionSnapshots } from '../../db/schema.js';
import { eq, and, desc, count } from 'drizzle-orm';
import type { ListIposQuery } from './ipo.schema.js';
import { IPOUnavailableError } from '../../errors/index.js';

export class IPOService {
  private inMemoryIpos = [
    {
      id: '7b8d1b22-83b6-4b2a-a9f1-a1e4c9f13110',
      symbol: 'TECHCORP',
      companyName: 'TechCorp Innovations Limited',
      slug: 'techcorp-innovations',
      isin: 'INE123A01019',
      exchange: 'NSE',
      issueType: 'BOOK_BUILT',
      mainboardOrSme: 'MAINBOARD',
      status: 'ALLOTMENT_PENDING',
      openDate: new Date('2026-08-25T04:30:00Z'),
      closeDate: new Date('2026-08-28T11:30:00Z'),
      allotmentDate: new Date('2026-08-31T11:30:00Z'),
      refundDate: new Date('2026-09-01T11:30:00Z'),
      dematCreditDate: new Date('2026-09-02T11:30:00Z'),
      listingDate: new Date('2026-09-03T04:30:00Z'),
      faceValue: '10.00',
      priceBandMin: '320.00',
      priceBandMax: '340.00',
      issuePrice: '340.00',
      lotSize: 44,
      minimumApplication: 44,
      issueSize: '1250.50',
      registrar: 'MUFG_INTIME',
      registrarUrl: 'https://linkintime.co.in',
      subscriptionQib: '85.40',
      subscriptionNii: '42.10',
      subscriptionRetail: '18.75',
      subscriptionEmployee: '2.50',
      subscriptionTotal: '48.90',
      gmp: '65.00',
      gmpPercentage: '19.12',
      source: 'SYSTEM',
      sourceUpdatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  public async listIPOs(query: ListIposQuery) {
    const { status, type, page, limit } = query;
    const offset = (page - 1) * limit;

    try {
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

      if (ipos.length > 0) {
        return {
          ipos,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        };
      }
    } catch {
      // Fallback to in-memory catalog
    }

    const filtered = this.inMemoryIpos.filter((i) => {
      if (status && i.status !== status) return false;
      if (type && i.mainboardOrSme !== type) return false;
      return true;
    });

    return {
      ipos: filtered.slice(offset, offset + limit),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit) || 1,
    };
  }

  public async getIPOById(idOrSlug: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    try {
      const [ipo] = await db
        .select()
        .from(ipoMaster)
        .where(isUuid ? eq(ipoMaster.id, idOrSlug) : eq(ipoMaster.slug, idOrSlug))
        .limit(1);

      if (ipo) return ipo;
    } catch {
      // Fallback
    }

    const memoryMatch = this.inMemoryIpos.find(
      (i) => i.id === idOrSlug || i.slug === idOrSlug || i.symbol === idOrSlug
    );

    if (!memoryMatch) {
      throw new IPOUnavailableError(idOrSlug);
    }

    return memoryMatch;
  }

  public async getSubscriptionHistory(ipoId: string) {
    const ipo = await this.getIPOById(ipoId);

    try {
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
    } catch {
      return {
        ipo,
        snapshots: [],
      };
    }
  }
}

export const ipoService = new IPOService();
