import { db } from '../../db/index.js';
import { ipoMaster, panProfiles, bulkJobs, allotmentResults } from '../../db/schema.js';
import { count, eq } from 'drizzle-orm';
import { ProviderHealthTracker } from '../../providers/health.js';
import { ipoSyncQueue } from '../../queues/index.js';

export class AdminService {
  public async getSystemStats() {
    const [
      [totalIpos],
      [activeIpos],
      [totalPans],
      [totalBulkJobs],
      [totalAllotmentsChecked],
      providerHealths,
    ] = await Promise.all([
      db.select({ count: count() }).from(ipoMaster),
      db.select({ count: count() }).from(ipoMaster).where(eq(ipoMaster.status, 'OPEN')),
      db.select({ count: count() }).from(panProfiles),
      db.select({ count: count() }).from(bulkJobs),
      db.select({ count: count() }).from(allotmentResults),
      ProviderHealthTracker.getAllHealth(),
    ]);

    return {
      totalIpos: Number(totalIpos?.count || 0),
      activeOpenIpos: Number(activeIpos?.count || 0),
      totalRegisteredPans: Number(totalPans?.count || 0),
      totalBulkJobs: Number(totalBulkJobs?.count || 0),
      totalAllotmentResults: Number(totalAllotmentsChecked?.count || 0),
      providers: providerHealths,
    };
  }

  public async triggerIPOSync() {
    const job = await ipoSyncQueue.add('sync:manual', { force: true });
    return { jobId: job.id, message: 'IPO master synchronization triggered' };
  }

  public async executeDirectIPOSync() {
    const { ipoProviderRegistry } = await import('../../providers/ipo/IPOProviderRegistry.js');
    const { ipoService } = await import('../ipo/ipo.service.js');

    const [openIpos, upcomingIpos, closedIpos] = await Promise.all([
      ipoProviderRegistry.getOpenIPOs(),
      ipoProviderRegistry.getUpcomingIPOs(),
      ipoProviderRegistry.getClosedIPOs(),
    ]);

    const all = [...openIpos, ...upcomingIpos, ...closedIpos];
    const results = [];
    for (const ipo of all) {
      const res = await ipoService.upsertIPO({
        symbol: ipo.symbol,
        companyName: ipo.companyName,
        exchange: ipo.exchange,
        issueType: ipo.issueType,
        mainboardOrSme: ipo.mainboardOrSme,
        status: ipo.status,
        openDate: ipo.openDate || undefined,
        closeDate: ipo.closeDate || undefined,
        listingDate: ipo.listingDate || undefined,
        priceBandMin: ipo.priceBandMin || undefined,
        priceBandMax: ipo.priceBandMax || undefined,
        issuePrice: ipo.issuePrice || undefined,
        lotSize: ipo.lotSize,
        minimumApplication: ipo.minimumApplication,
        issueSize: ipo.issueSize || undefined,
        registrar: ipo.registrar || undefined,
        registrarUrl: ipo.registrarUrl || undefined,
        source: ipo.source,
        sourceId: ipo.sourceId || undefined,
        sourceUrl: ipo.sourceUrl || undefined,
      });
      results.push(res);
    }

    return {
      syncedCount: results.length,
      openCount: openIpos.length,
      upcomingCount: upcomingIpos.length,
      closedCount: closedIpos.length,
      ipos: results,
    };
  }
}

export const adminService = new AdminService();
