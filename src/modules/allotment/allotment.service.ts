import { db } from '../../db/index.js';
import { ipoMaster, allotmentResults, panProfiles } from '../../db/schema.js';
import { eq, or, inArray, desc } from 'drizzle-orm';
import { encryptPAN, hashPAN, maskPAN } from '../../security/crypto.js';
import { allotmentEngine } from '../../providers/allotment/AllotmentEngine.js';
import { allotmentCheckQueue } from '../../queues/index.js';
import type { SingleCheckInput } from './allotment.schema.js';
import type { PANCheckSummary, AllotmentResult } from '../../types/allotment.types.js';
import type { IPO } from '../../types/ipo.types.js';

export class AllotmentService {
  public async checkPAN(input: SingleCheckInput, userId?: string): Promise<PANCheckSummary | { jobId: string }> {
    const { pan, ipoId, async: isAsync } = input;
    const panHash = hashPAN(pan);
    const encryptedPan = encryptPAN(pan);
    const masked = maskPAN(pan);

    // Fetch target IPO(s)
    let targetIpos: Array<typeof ipoMaster.$inferSelect> = [];
    if (ipoId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ipoId);
      const [specificIpo] = await db
        .select()
        .from(ipoMaster)
        .where(
          isUuid
            ? eq(ipoMaster.id, ipoId)
            : or(eq(ipoMaster.symbol, ipoId.toUpperCase()), eq(ipoMaster.slug, ipoId.toLowerCase()))
        )
        .limit(1);

      if (specificIpo) targetIpos = [specificIpo];
    } else {
      // Find all relevant open / closed / pending / recently allotted IPOs
      targetIpos = await db
        .select()
        .from(ipoMaster)
        .where(inArray(ipoMaster.status, ['OPEN', 'CLOSED', 'ALLOTMENT_PENDING', 'ALLOTTED']))
        .orderBy(desc(ipoMaster.closeDate));
    }

    if (isAsync) {
      // Queue jobs and return first job ID
      const jobs = await Promise.all(
        targetIpos.map((ipo) =>
          allotmentCheckQueue.add('check:single', {
            panHash,
            encryptedPan,
            ipoId: ipo.id,
            userId,
          })
        )
      );

      return { jobId: jobs[0]?.id || `IPO-${Date.now().toString(36).toUpperCase()}` };
    }

    // Synchronous execution across target IPOs
    const results: AllotmentResult[] = [];
    let allottedCount = 0;
    let notAllottedCount = 0;
    let pendingCount = 0;

    for (const ipoRecord of targetIpos) {
      const ipo: IPO = {
        id: ipoRecord.id,
        symbol: ipoRecord.symbol,
        companyName: ipoRecord.companyName,
        slug: ipoRecord.slug,
        exchange: ipoRecord.exchange as IPO['exchange'],
        issueType: ipoRecord.issueType as IPO['issueType'],
        mainboardOrSme: ipoRecord.mainboardOrSme as IPO['mainboardOrSme'],
        status: ipoRecord.status as IPO['status'],
        lotSize: ipoRecord.lotSize,
        minimumApplication: ipoRecord.minimumApplication,
        issuePrice: ipoRecord.issuePrice ? Number(ipoRecord.issuePrice) : undefined,
        registrar: ipoRecord.registrar,
        registrarUrl: ipoRecord.registrarUrl,
        source: ipoRecord.source,
      };

      const result = await allotmentEngine.checkAllotment(pan, ipo);
      results.push(result);

      if (result.status === 'ALLOTTED') allottedCount++;
      else if (result.status === 'NOT_ALLOTTED') notAllottedCount++;
      else if (result.status === 'PENDING') pendingCount++;

      // Save / update result in DB
      try {
        await db.insert(allotmentResults).values({
          panHash,
          ipoId: ipo.id,
          applicationNumber: result.applicationNumber,
          status: result.status,
          appliedQuantity: result.appliedQuantity || 0,
          allottedQuantity: result.allottedQuantity || 0,
          issuePrice: result.issuePrice ? String(result.issuePrice) : '0',
          amountApplied: result.amountApplied ? String(result.amountApplied) : '0',
          amountAllotted: result.amountAllotted ? String(result.amountAllotted) : '0',
          refundAmount: result.refundAmount ? String(result.refundAmount) : '0',
          dematCreditStatus: result.dematCreditStatus,
          source: result.source,
          confidence: result.confidence,
          rawReference: result.rawReference,
          fingerprint: result.fingerprint,
          checkedAt: result.checkedAt,
        });
      } catch {
        // Suppress duplicate insert constraint error in quick polling
      }
    }

    return {
      maskedPan: masked,
      totalIposFound: targetIpos.length,
      applicationsFound: results.filter((r) => r.status !== 'NOT_FOUND').length,
      allottedCount,
      notAllottedCount,
      pendingCount,
      results,
    };
  }

  public async getResultById(id: string) {
    const [result] = await db
      .select({
        id: allotmentResults.id,
        panLast4: panProfiles.panLast4,
        companyName: ipoMaster.companyName,
        symbol: ipoMaster.symbol,
        status: allotmentResults.status,
        appliedQuantity: allotmentResults.appliedQuantity,
        allottedQuantity: allotmentResults.allottedQuantity,
        issuePrice: allotmentResults.issuePrice,
        amountAllotted: allotmentResults.amountAllotted,
        source: allotmentResults.source,
        confidence: allotmentResults.confidence,
        checkedAt: allotmentResults.checkedAt,
      })
      .from(allotmentResults)
      .leftJoin(ipoMaster, eq(allotmentResults.ipoId, ipoMaster.id))
      .leftJoin(panProfiles, eq(allotmentResults.panProfileId, panProfiles.id))
      .where(eq(allotmentResults.id, id));

    return result;
  }
}

export const allotmentService = new AllotmentService();
