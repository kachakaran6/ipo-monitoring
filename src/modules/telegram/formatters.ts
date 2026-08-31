import type { PANCheckSummary, AllotmentResult } from '../../types/allotment.types.js';
import type { IPO } from '../../types/ipo.types.js';
import { formatToIST, formatTimeIST } from '../../utils/datetime.js';

/**
 * Format a null-safe field for display.
 * Shows '—' for null/undefined — NEVER a fabricated zero or placeholder.
 */
function fmt(value: number | string | null | undefined, prefix = '', suffix = ''): string {
  if (value === null || value === undefined) return '—';
  return `${prefix}${value}${suffix}`;
}

/**
 * Status emoji mapping — only for real allotment statuses.
 */
function statusEmoji(status: AllotmentResult['status']): string {
  switch (status) {
    case 'ALLOTTED': return '🎉';
    case 'NOT_ALLOTTED': return '❌';
    case 'PENDING': return '⏳';
    case 'NOT_FOUND': return '⚪';
    case 'CAPTCHA_REQUIRED': return '🔒';
    case 'UNSUPPORTED': return '🚫';
    case 'CHECK_FAILED': return '⚠️';
    case 'RATE_LIMITED': return '🕐';
    case 'AUTH_REQUIRED': return '🔑';
    default: return '❓';
  }
}

/**
 * User-readable label for each allotment status.
 */
function statusLabel(status: AllotmentResult['status']): string {
  switch (status) {
    case 'ALLOTTED': return 'ALLOTTED';
    case 'NOT_ALLOTTED': return 'NOT ALLOTTED';
    case 'PENDING': return 'PENDING (awaiting result)';
    case 'NOT_FOUND': return 'NOT FOUND';
    case 'CAPTCHA_REQUIRED': return 'Manual check required';
    case 'UNSUPPORTED': return 'Not supported';
    case 'CHECK_FAILED': return 'Check failed';
    case 'RATE_LIMITED': return 'Rate limited (retry later)';
    case 'AUTH_REQUIRED': return 'Authentication required';
    default: return status;
  }
}

/**
 * Format the PAN check summary card for the Telegram bot.
 *
 * Rules:
 *  - Show '—' for any field that is null/missing — never invent a value
 *  - For CAPTCHA_REQUIRED: show official portal URL so user can check manually
 *  - Do NOT show the internal fingerprint to users (§24)
 *  - Show source + timestamp for every result (§64)
 *  - Show coverage summary (§26–27)
 */
export function formatCheckSummaryCard(summary: PANCheckSummary): string {
  let text = `<b>🔎 IPO ALLOTMENT CHECK</b>\n\n`;
  text += `<b>PAN:</b> <code>${summary.maskedPan}</code>\n\n`;

  // ── Coverage summary ─────────────────────────────────────────────────────
  text += `<b>IPOs checked:</b> ${summary.totalIposFound}\n`;

  if (summary.captchaRequiredCount > 0) {
    text += `🔒 <b>Manual check required:</b> ${summary.captchaRequiredCount} (CAPTCHA)\n`;
  }
  if (summary.checkFailedCount > 0) {
    text += `⚠️ <b>Provider failures:</b> ${summary.checkFailedCount}\n`;
  }
  if (summary.unsupportedCount > 0) {
    text += `🚫 <b>Unsupported:</b> ${summary.unsupportedCount}\n`;
  }

  // ── If no real IPO data available ────────────────────────────────────────
  if (summary.totalIposFound === 0) {
    text += `\n<i>No verified IPO records are currently available.</i>\n`;
    text += `<i>Run the IPO sync to fetch data from NSE/BSE.</i>`;
    return text;
  }

  // ── Filter results to show (exclude pure-unsupported) ────────────────────
  const showableResults = summary.results.filter((r) => r.status !== 'UNSUPPORTED');

  if (showableResults.length === 0) {
    text += `\n<i>No IPO applications were found from the currently supported authoritative sources.</i>\n\n`;
    text += `<b>Coverage breakdown:</b>\n`;
    text += `  • Checked: ${summary.coverage.successfullyChecked}\n`;
    text += `  • CAPTCHA required: ${summary.coverage.captchaRequired}\n`;
    text += `  • Unsupported: ${summary.coverage.unsupportedProviders}\n`;
    text += `  • Failures: ${summary.coverage.providerFailures}`;
    return text;
  }

  text += `\n────────────────────\n\n`;

  let idx = 0;
  for (const r of showableResults) {
    idx++;
    const emoji = statusEmoji(r.status);
    const label = statusLabel(r.status);

    text += `<b>${idx}. ${r.companyName || r.symbol || 'IPO'}</b>\n`;
    text += `<b>IPO:</b> ${r.symbol || '—'}\n`;

    // Registrar — from IPO master (authoritative)
    if (r.source && r.source !== 'NONE') {
      text += `<b>Registrar:</b> ${r.source}\n`;
    }

    text += `\n<b>Status:</b> ${emoji} <b>${label}</b>\n`;

    // Only show quantity/price fields if the source actually returned them
    if (r.status === 'ALLOTTED' || r.status === 'NOT_ALLOTTED' || r.status === 'PENDING') {
      if (r.appliedQuantity != null) {
        text += `<b>Applied:</b> ${r.appliedQuantity} shares\n`;
      } else {
        text += `<b>Applied:</b> —\n`;
      }
      if (r.allottedQuantity != null) {
        text += `<b>Allotted:</b> ${r.allottedQuantity} shares\n`;
      } else if (r.status === 'NOT_ALLOTTED') {
        text += `<b>Allotted:</b> 0 shares\n`; // Source confirmed zero
      } else {
        text += `<b>Allotted:</b> —\n`;
      }
      if (r.issuePrice != null) {
        text += `<b>Issue Price:</b> ₹${r.issuePrice}\n`;
      } else {
        text += `<b>Issue Price:</b> —\n`;
      }
    }

    if (r.status === 'CAPTCHA_REQUIRED') {
      text += `\n<i>⚠️ Automatic verification unavailable.</i>\n`;
      text += `<i>The registrar requires manual CAPTCHA verification.</i>\n`;
      if (r.registrarUrl) {
        text += `<b>Check manually:</b> <a href="${r.registrarUrl}">${r.source} Portal</a>\n`;
      }
    }

    if (r.status === 'CHECK_FAILED' && r.errorMessage) {
      text += `<i>Error: ${r.errorMessage}</i>\n`;
    }

    // Source and timestamp — always shown (§64)
    text += `\n<b>Source:</b> ${r.source}\n`;
    text += `<b>Checked:</b> ${formatTimeIST(r.checkedAt)}\n`;

    text += `\n────────────────────\n\n`;
  }

  // ── Coverage summary footer for partial checks ────────────────────────────
  if (summary.captchaRequiredCount > 0 || summary.checkFailedCount > 0) {
    text += `⚠️ <i>Some IPOs could not be automatically checked.</i>\n`;
    text += `<i>Results shown are from successfully verified sources only.</i>`;
  }

  return text;
}

/**
 * Format a single IPO card for display.
 * Uses '—' for any missing field — never fabricates values.
 */
export function formatIPOCard(ipo: IPO): string {
  let text = `<b>🏢 ${ipo.companyName} (${ipo.symbol})</b>\n\n`;
  text += `<b>Type:</b> ${ipo.mainboardOrSme} (${ipo.issueType})\n`;
  text += `<b>Exchange:</b> ${ipo.exchange}\n`;
  text += `<b>Status:</b> <b>${ipo.status}</b>\n`;

  // Price band
  if (ipo.priceBandMin != null && ipo.priceBandMax != null) {
    text += `<b>Price Band:</b> ₹${ipo.priceBandMin} – ₹${ipo.priceBandMax}\n`;
  } else if (ipo.issuePrice != null) {
    text += `<b>Issue Price:</b> ₹${ipo.issuePrice}\n`;
  } else {
    text += `<b>Price:</b> —\n`;
  }

  text += `<b>Lot Size:</b> ${ipo.lotSize} shares\n`;

  if (ipo.issueSize != null) {
    text += `<b>Issue Size:</b> ₹${ipo.issueSize} Cr\n`;
  }

  text += `\n<b>Timeline:</b>\n`;
  text += `📅 <b>Open:</b> ${formatToIST(ipo.openDate)}\n`;
  text += `📅 <b>Close:</b> ${formatToIST(ipo.closeDate)}\n`;
  text += `📅 <b>Allotment:</b> ${formatToIST(ipo.allotmentDate)}\n`;
  text += `📅 <b>Listing:</b> ${formatToIST(ipo.listingDate)}\n\n`;
  text += `<b>Registrar:</b> ${ipo.registrar || '—'}\n`;

  // Source provenance — shows where this data came from (§64)
  if (ipo.source) {
    text += `<b>Source:</b> ${ipo.source}`;
    if (ipo.sourceUpdatedAt) {
      text += ` (updated ${formatTimeIST(ipo.sourceUpdatedAt)})`;
    }
    text += '\n';
  }

  return text;
}
