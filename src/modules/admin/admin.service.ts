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
}

export const adminService = new AdminService();
