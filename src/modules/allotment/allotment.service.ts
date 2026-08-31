import { db } from '../../db/index.js';
import { ipoMaster, allotmentResults, panProfiles } from '../../db/schema.js';
import { eq, or, inArray, desc } from 'drizzle-orm';
import { encryptPAN, hashPAN, maskPAN } from '../../security/crypto.js';
import { allotmentEngine } from '../../providers/allotment/AllotmentEngine.js';
import { allotmentCheckQueue } from '../../queues/index.js';
import type { SingleCheckInput } from './allotment.schema.js';
import type { PANCheckSummary, AllotmentResult, CheckCoverage } from '../../types/allotment.types.js';
import type { IPO } from '../../types/ipo.types.js';
import { logger } from '../../utils/logger.js';

export class AllotmentService {
  public async checkPAN(input: SingleCheckInput, userId?: string): Promise<PANCheckSummary | { jobId: string }> {
    const { pan, ipoId, async: isAsync } = input;
    const panHash = hashPAN(pan);
    const encryptedPan = encryptPAN(pan);
    const masked = maskPAN(pan);

    // ── Fetch target IPO(s) ──────────────────────────────────────────────────
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
      // Only check IPOs in states where allotment verification is meaningful
      targetIpos = await db
        .select()
        .from(ipoMaster)
        .where(inArray(ipoMaster.status, ['CLOSED', 'ALLOTMENT_PENDING', 'ALLOTTED', 'LISTED']))
        .orderBy(desc(ipoMaster.closeDate));
    }

    // ── Async path ────────────────────────────────────────────────────────────
    if (isAsync) {
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

      // Use a deterministic job ID (no Math.random())
      const jobId = jobs[0]?.id || `IPO-${Date.now().toString(36).toUpperCase()}-${panHash.slice(0, 6)}`;
      return { jobId };
    }

    // ── Synchronous path ──────────────────────────────────────────────────────
    if (targetIpos.length === 0) {
      const emptyCoverage: CheckCoverage = {
        discoveredIPOs: 0,
        eligibleIPOs: 0,
        successfullyChecked: 0,
        applicationsFound: 0,
        captchaRequired: 0,
        providerFailures: 0,
        unsupportedProviders: 0,
      };

      return {
        maskedPan: masked,
        totalIposFound: 0,
        eligibleIpos: 0,
        applicationsFound: 0,
        allottedCount: 0,
        notAllottedCount: 0,
        pendingCount: 0,
        captchaRequiredCount: 0,
        checkFailedCount: 0,
        unsupportedCount: 0,
        coverage: emptyCoverage,
        results: [],
        lastSyncAt: null,
      };
    }

    const ipos: IPO[] = targetIpos.map((ipoRecord) => ({
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
      issuePrice: ipoRecord.issuePrice ? Number(ipoRecord.issuePrice) : null,
      registrar: ipoRecord.registrar,
      registrarUrl: ipoRecord.registrarUrl,
      source: ipoRecord.source,
      sourceId: ipoRecord.sourceId,
      sourceUrl: ipoRecord.sourceUrl,
    }));

    const { results, coverage } = await allotmentEngine.checkPANAcrossIPOs(pan, ipos);

    let allottedCount = 0;
    let notAllottedCount = 0;
    let pendingCount = 0;
    let captchaRequiredCount = 0;
    let checkFailedCount = 0;
    let unsupportedCount = 0;

    for (const result of results) {
      if (result.status === 'ALLOTTED') allottedCount++;
      else if (result.status === 'NOT_ALLOTTED') notAllottedCount++;
      else if (result.status === 'PENDING') pendingCount++;
      else if (result.status === 'CAPTCHA_REQUIRED') captchaRequiredCount++;
      else if (result.status === 'CHECK_FAILED' || result.status === 'RATE_LIMITED') checkFailedCount++;
      else if (result.status === 'UNSUPPORTED') unsupportedCount++;

      // ── Persist result ───────────────────────────────────────────────────
      // IMPORTANT: Only persist non-UNSUPPORTED results (UNSUPPORTED means
      // the provider doesn't support this IPO — not a meaningful check result).
      if (result.status !== 'UNSUPPORTED') {
        try {
          await db.insert(allotmentResults).values({
            panHash,
            ipoId: result.ipoId,
            applicationNumber: result.applicationNumber,
            status: result.status,
            // CRITICAL: use null for missing quantities — never default to 0
            appliedQuantity: result.appliedQuantity ?? null,
            allottedQuantity: result.allottedQuantity ?? null,
            issuePrice: result.issuePrice != null ? String(result.issuePrice) : null,
            amountApplied: result.amountApplied != null ? String(result.amountApplied) : null,
            amountAllotted: result.amountAllotted != null ? String(result.amountAllotted) : null,
            refundAmount: result.refundAmount != null ? String(result.refundAmount) : null,
            dematCreditStatus: result.dematCreditStatus,
            source: result.source,
            sourceType: result.provenance?.sourceType ?? null,
            confidence: result.confidence,
            qualityScore: result.qualityScore ?? 'FAILED',
            rawReference: result.rawReference,
            fingerprint: result.fingerprint,
            checkedAt: result.checkedAt,
          });
        } catch {
          // Suppress duplicate insert constraint — quick polling may re-check
        }
      }
    }

    logger.info(
      {
        pan: masked,
        discovered: coverage.discoveredIPOs,
        eligible: coverage.eligibleIPOs,
        checked: coverage.successfullyChecked,
        captcha: coverage.captchaRequired,
        failed: coverage.providerFailures,
      },
      'PAN check complete'
    );

    return {
      maskedPan: masked,
      totalIposFound: targetIpos.length,
      eligibleIpos: coverage.eligibleIPOs,
      applicationsFound: coverage.applicationsFound,
      allottedCount,
      notAllottedCount,
      pendingCount,
      captchaRequiredCount,
      checkFailedCount,
      unsupportedCount,
      coverage,
      results,
      lastSyncAt: null, // TODO: read from sync metadata table
    };
  }

  public async getResultById(id: string): Promise<AllotmentResult | undefined> {
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
        qualityScore: allotmentResults.qualityScore,
        checkedAt: allotmentResults.checkedAt,
      })
      .from(allotmentResults)
      .leftJoin(ipoMaster, eq(allotmentResults.ipoId, ipoMaster.id))
      .leftJoin(panProfiles, eq(allotmentResults.panProfileId, panProfiles.id))
      .where(eq(allotmentResults.id, id));

    return result as unknown as AllotmentResult | undefined;
  }
}

export const allotmentService = new AllotmentService();
