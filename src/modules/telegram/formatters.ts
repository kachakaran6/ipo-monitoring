import type { PANCheckSummary, AllotmentResult } from '../../types/allotment.types.js';
import type { IPO } from '../../types/ipo.types.js';
import { formatToIST, formatTimeIST } from '../../utils/datetime.js';

export function formatCheckSummaryCard(summary: PANCheckSummary): string {
  let text = `<b>📊 IPO CHECK RESULT</b>\n\n`;
  text += `<b>PAN:</b> <code>${summary.maskedPan}</code>\n`;
  text += `<b>Total IPOs found:</b> ${summary.totalIposFound}\n`;
  text += `<b>Applications found:</b> ${summary.applicationsFound}\n\n`;
  text += `🎉 <b>ALLOTTED:</b> ${summary.allottedCount}\n`;
  text += `❌ <b>NOT ALLOTTED:</b> ${summary.notAllottedCount}\n`;
  text += `⏳ <b>PENDING:</b> ${summary.pendingCount}\n\n`;
  text += `────────────────────\n\n`;

  if (summary.results.length === 0) {
    text += `<i>No active IPO applications found for this PAN.</i>`;
    return text;
  }

  summary.results.forEach((r, idx) => {
    let statusEmoji = '⏳';
    if (r.status === 'ALLOTTED') statusEmoji = '🎉';
    else if (r.status === 'NOT_ALLOTTED') statusEmoji = '❌';
    else if (r.status === 'NOT_FOUND') statusEmoji = '⚪';
    else if (r.status === 'CAPTCHA_REQUIRED' || r.status === 'MANUAL_VERIFICATION_REQUIRED') statusEmoji = '⚠️';

    text += `<b>${idx + 1}. ${r.companyName || r.symbol || 'IPO'}</b>\n`;
    text += `<b>Status:</b> ${statusEmoji} <b>${r.status}</b>\n`;

    if (r.status === 'ALLOTTED') {
      text += `<b>Applied:</b> ${r.appliedQuantity} shares\n`;
      text += `<b>Allotted:</b> ${r.allottedQuantity} shares\n`;
      if (r.issuePrice) text += `<b>Price:</b> ₹${r.issuePrice}\n`;
      if (r.amountAllotted) text += `<b>Amount:</b> ₹${r.amountAllotted.toLocaleString('en-IN')}\n`;
    } else if (r.status === 'NOT_ALLOTTED') {
      text += `<b>Applied:</b> ${r.appliedQuantity} shares\n`;
      text += `<b>Allotted:</b> 0 shares\n`;
    }

    text += `<b>Source:</b> ${r.source}\n`;
    text += `<b>Checked:</b> ${formatTimeIST(r.checkedAt)}\n\n`;
  });

  return text;
}

export function formatIPOCard(ipo: IPO): string {
  let text = `<b>🏢 ${ipo.companyName} (${ipo.symbol})</b>\n\n`;
  text += `<b>Type:</b> ${ipo.mainboardOrSme} (${ipo.issueType})\n`;
  text += `<b>Status:</b> <b>${ipo.status}</b>\n`;
  text += `<b>Price Band:</b> ₹${ipo.priceBandMin || ipo.issuePrice} - ₹${ipo.priceBandMax || ipo.issuePrice}\n`;
  text += `<b>Lot Size:</b> ${ipo.lotSize} shares\n`;

  if (ipo.issueSize) text += `<b>Issue Size:</b> ₹${ipo.issueSize} Cr\n`;
  if (ipo.gmp && ipo.gmp > 0) {
    text += `<b>GMP:</b> ₹${ipo.gmp} (+${ipo.gmpPercentage}%)\n`;
  }

  text += `\n<b>Timeline:</b>\n`;
  text += `📅 <b>Open:</b> ${formatToIST(ipo.openDate)}\n`;
  text += `📅 <b>Close:</b> ${formatToIST(ipo.closeDate)}\n`;
  text += `📅 <b>Allotment:</b> ${formatToIST(ipo.allotmentDate)}\n`;
  text += `📅 <b>Listing:</b> ${formatToIST(ipo.listingDate)}\n\n`;
  text += `<b>Registrar:</b> ${ipo.registrar || 'N/A'}`;

  return text;
}
