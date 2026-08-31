import { db } from '../../db/index.js';
import { allotmentResults, ipoMaster, panProfiles } from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { hashPAN, maskPAN } from '../../security/crypto.js';

export class HistoryService {
  public async getPANHistory(panOrHash: string) {
    const isFullPan = /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(panOrHash.trim());
    const panHash = isFullPan ? hashPAN(panOrHash.trim().toUpperCase()) : panOrHash;

    const records = await db
      .select({
        id: allotmentResults.id,
        ipoId: allotmentResults.ipoId,
        companyName: ipoMaster.companyName,
        symbol: ipoMaster.symbol,
        mainboardOrSme: ipoMaster.mainboardOrSme,
        status: allotmentResults.status,
        appliedQuantity: allotmentResults.appliedQuantity,
        allottedQuantity: allotmentResults.allottedQuantity,
        issuePrice: allotmentResults.issuePrice,
        amountApplied: allotmentResults.amountApplied,
        amountAllotted: allotmentResults.amountAllotted,
        checkedAt: allotmentResults.checkedAt,
        source: allotmentResults.source,
      })
      .from(allotmentResults)
      .leftJoin(ipoMaster, eq(allotmentResults.ipoId, ipoMaster.id))
      .where(eq(allotmentResults.panHash, panHash))
      .orderBy(desc(allotmentResults.checkedAt));

    let totalApplications = records.length;
    let totalAllotted = 0;
    let totalNotAllotted = 0;
    let totalPending = 0;
    let totalAmountApplied = 0;
    let totalAmountAllotted = 0;
    let mainboardCount = 0;
    let smeCount = 0;

    for (const r of records) {
      if (r.status === 'ALLOTTED') {
        totalAllotted++;
      } else if (r.status === 'NOT_ALLOTTED') {
        totalNotAllotted++;
      } else if (r.status === 'PENDING') {
        totalPending++;
      }

      if (r.mainboardOrSme === 'SME') {
        smeCount++;
      } else {
        mainboardCount++;
      }

      totalAmountApplied += Number(r.amountApplied) || 0;
      totalAmountAllotted += Number(r.amountAllotted) || 0;
    }

    const successRate =
      totalApplications > 0 ? ((totalAllotted / totalApplications) * 100).toFixed(2) : '0.00';

    const averageAppSize =
      totalApplications > 0 ? Math.round(totalAmountApplied / totalApplications) : 0;

    return {
      panHash,
      analytics: {
        totalApplications,
        totalAllotted,
        totalNotAllotted,
        totalPending,
        successRatePercentage: Number(successRate),
        totalAmountApplied,
        totalAmountAllotted,
        averageApplicationSize: averageAppSize,
        mainboardApplications: mainboardCount,
        smeApplications: smeCount,
        historyCoverage: '2026-01-01 -> current',
      },
      recentApplications: records.slice(0, 50),
    };
  }
}

export const historyService = new HistoryService();
