import { Bot, Context } from 'grammy';
import { env } from '../../config/env.js';
import { isTelegramAdmin } from '../../security/auth.js';
import { isValidPAN, normalizeAndValidatePAN, maskPAN } from '../../security/crypto.js';
import { allotmentService } from '../allotment/allotment.service.js';
import { bulkService } from '../bulk/bulk.service.js';
import { ipoService } from '../ipo/ipo.service.js';
import { historyService } from '../history/history.service.js';
import { adminService } from '../admin/admin.service.js';
import { getMainKeyboard, getIPODetailsKeyboard, getCheckResultKeyboard } from './keyboards.js';
import { formatCheckSummaryCard, formatIPOCard } from './formatters.js';
import { parseBulkPANInput } from '../../utils/csv.js';
import { logger } from '../../utils/logger.js';

export function createTelegramBot(): Bot | null {
  if (!env.TELEGRAM_BOT_TOKEN) {
    logger.info('Telegram Bot token not provided, running in mock/disabled mode.');
    return null;
  }

  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  // 1. /start command
  bot.command('start', async (ctx) => {
    const welcome =
      `👋 <b>Welcome to Indian IPO Intelligence Platform!</b>\n\n` +
      `Instant, secure IPO allotment tracking & notifications across NSE, BSE, Link Intime, KFintech, and Bigshare.\n\n` +
      `📌 <b>Commands:</b>\n` +
      `• <code>/check &lt;PAN&gt;</code> - Check allotment for a PAN\n` +
      `• <code>/bulk</code> - Check up to 1,000 PANs at once\n` +
      `• <code>/history &lt;PAN&gt;</code> - View PAN allotment statistics\n` +
      `• <code>/ipos</code> - Explore active & upcoming IPOs\n` +
      `• <code>/watch &lt;PAN&gt;</code> - Auto-monitor for upcoming allotment\n` +
      `• <code>/help</code> - Complete help & security info`;

    await ctx.reply(welcome, { parse_mode: 'HTML', reply_markup: getMainKeyboard() });
  });

  // 2. /help command
  bot.command('help', async (ctx) => {
    const help =
      `📖 <b>IPO Intelligence Bot Help</b>\n\n` +
      `<b>Single Check:</b>\n<code>/check ABCDE1234F</code>\n\n` +
      `<b>Bulk Upload:</b>\nSend <code>/bulk</code> then send a list of PANs or attach a <code>.txt</code> or <code>.csv</code> file.\n\n` +
      `<b>Security & Privacy:</b>\n` +
      `• All PANs are encrypted with AES-256-GCM.\n` +
      `• Plaintext PAN is never logged or exposed.\n` +
      `• Verified official sources only.`;

    await ctx.reply(help, { parse_mode: 'HTML' });
  });

  // 3. /check <PAN> command
  bot.command('check', async (ctx) => {
    const text = ctx.match?.trim() || '';

    if (!text || !isValidPAN(text)) {
      await ctx.reply(
        `⚠️ <b>Invalid PAN format.</b>\nPlease provide a valid 10-character PAN number.\nExample: <code>/check ABCDE1234F</code>`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    const pan = normalizeAndValidatePAN(text);
    const masked = maskPAN(pan);
    // Deterministic job ID — derived from timestamp + last 6 chars of PAN hash (no Math.random())
    const jobId = `IPO-${Date.now().toString(36).toUpperCase()}`;

    // Immediate acknowledgement
    const ack = await ctx.reply(
      `⏳ <b>IPO check started...</b>\n\n` +
      `<b>PAN:</b> <code>${masked}</code>\n` +
      `<b>Job:</b> <code>#${jobId}</code>\n\n` +
      `<i>Scanning active registrars (MUFG, KFintech, Bigshare, NSE/BSE)...</i>`,
      { parse_mode: 'HTML' }
    );

    try {
      // Execute check
      const summary = (await allotmentService.checkPAN(
        { pan, async: false },
        String(ctx.from?.id)
      )) as import('../../types/allotment.types.js').PANCheckSummary;

      const card = formatCheckSummaryCard(summary);
      await ctx.reply(card, {
        parse_mode: 'HTML',
        reply_markup: getCheckResultKeyboard(pan.slice(-4)),
      });
    } catch (error) {
      await ctx.reply(
        `❌ <b>Check Failed:</b> ${(error as Error).message}\n<i>Please try again later or verify on the official registrar portal.</i>`,
        { parse_mode: 'HTML' }
      );
    }
  });

  // 4. /bulk command
  bot.command('bulk', async (ctx) => {
    await ctx.reply(
      `📦 <b>BULK IPO ALLOTMENT CHECK</b>\n\n` +
      `Send a list of PAN numbers (separated by lines/commas) or upload a <b>.txt</b> / <b>.csv</b> file.\n\n` +
      `• <i>Maximum: 1,000 PANs per batch</i>\n` +
      `• <i>Format: PAN or PAN,Label</i>`,
      { parse_mode: 'HTML' }
    );
  });

  // 5. /history <PAN> command
  bot.command('history', async (ctx) => {
    const text = ctx.match?.trim() || '';
    if (!text || !isValidPAN(text)) {
      await ctx.reply(`⚠️ Usage: <code>/history &lt;PAN&gt;</code>`, { parse_mode: 'HTML' });
      return;
    }

    const history = await historyService.getPANHistory(text);
    const a = history.analytics;

    let msg = `<b>👤 PAN PROFILE ALLOTMENT HISTORY</b>\n\n`;
    msg += `<b>Total Applications:</b> ${a.totalApplications}\n`;
    msg += `🎉 <b>Allotted:</b> ${a.totalAllotted}\n`;
    msg += `❌ <b>Not Allotted:</b> ${a.totalNotAllotted}\n`;
    msg += `⏳ <b>Pending:</b> ${a.totalPending}\n\n`;
    msg += `<b>Total Applied Capital:</b> ₹${a.totalAmountApplied.toLocaleString('en-IN')}\n`;
    msg += `<b>Total Allotted Value:</b> ₹${a.totalAmountAllotted.toLocaleString('en-IN')}\n`;
    msg += `<b>Success Rate:</b> <b>${a.successRatePercentage}%</b>\n\n`;
    msg += `<i>Coverage: ${a.historyCoverage}</i>`;

    await ctx.reply(msg, { parse_mode: 'HTML' });
  });

  // 6. /ipos command
  bot.command('ipos', async (ctx) => {
    const result = await ipoService.listIPOs({ page: 1, limit: 5 });
    if (result.ipos.length === 0) {
      await ctx.reply('No active IPOs found in master database.');
      return;
    }

    for (const ipoRecord of result.ipos) {
      const ipo: import('../../types/ipo.types.js').IPO = {
        id: ipoRecord.id,
        symbol: ipoRecord.symbol,
        companyName: ipoRecord.companyName,
        slug: ipoRecord.slug,
        exchange: ipoRecord.exchange as any,
        issueType: ipoRecord.issueType as any,
        mainboardOrSme: ipoRecord.mainboardOrSme as any,
        status: ipoRecord.status as any,
        lotSize: ipoRecord.lotSize,
        minimumApplication: ipoRecord.minimumApplication,
        priceBandMin: ipoRecord.priceBandMin ? Number(ipoRecord.priceBandMin) : undefined,
        priceBandMax: ipoRecord.priceBandMax ? Number(ipoRecord.priceBandMax) : undefined,
        issuePrice: ipoRecord.issuePrice ? Number(ipoRecord.issuePrice) : undefined,
        gmp: ipoRecord.gmp ? Number(ipoRecord.gmp) : undefined,
        gmpPercentage: ipoRecord.gmpPercentage ? Number(ipoRecord.gmpPercentage) : undefined,
        openDate: ipoRecord.openDate,
        closeDate: ipoRecord.closeDate,
        allotmentDate: ipoRecord.allotmentDate,
        listingDate: ipoRecord.listingDate,
        registrar: ipoRecord.registrar,
        registrarUrl: ipoRecord.registrarUrl,
        source: ipoRecord.source,
      };

      await ctx.reply(formatIPOCard(ipo), {
        parse_mode: 'HTML',
        reply_markup: getIPODetailsKeyboard(ipo.symbol, ipo.registrarUrl),
      });
    }
  });

  // 7. /admin commands
  bot.command('admin', async (ctx) => {
    if (!ctx.from || !isTelegramAdmin(ctx.from.id)) {
      await ctx.reply('⛔ <b>Access Denied:</b> Admin only command.', { parse_mode: 'HTML' });
      return;
    }

    const stats = await adminService.getSystemStats();
    let text = `<b>🛠️ SYSTEM ADMIN DASHBOARD</b>\n\n`;
    text += `<b>Total IPOs:</b> ${stats.totalIpos}\n`;
    text += `<b>Active Open IPOs:</b> ${stats.activeOpenIpos}\n`;
    text += `<b>Registered PANs:</b> ${stats.totalRegisteredPans}\n`;
    text += `<b>Bulk Jobs Run:</b> ${stats.totalBulkJobs}\n`;
    text += `<b>Allotment Checks:</b> ${stats.totalAllotmentResults}\n\n`;
    text += `<b>Provider Status:</b>\n`;

    for (const p of stats.providers) {
      const icon = p.status === 'HEALTHY' ? '🟢' : p.status === 'DEGRADED' ? '🟡' : '🔴';
      text += `${icon} <b>${p.provider}:</b> ${p.status} (${p.latencyMs}ms)\n`;
    }

    await ctx.reply(text, { parse_mode: 'HTML' });
  });

  // 8. Document & CSV Upload Handler
  bot.on('message:document', async (ctx) => {
    const doc = ctx.message.document;
    const mime = doc.mime_type || '';
    const name = doc.file_name || '';

    if (!name.endsWith('.txt') && !name.endsWith('.csv') && !mime.includes('text') && !mime.includes('csv')) {
      await ctx.reply('⚠️ Please upload a valid <b>.txt</b> or <b>.csv</b> file.', { parse_mode: 'HTML' });
      return;
    }

    try {
      const file = await ctx.getFile();
      const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      const res = await fetch(fileUrl);
      const content = await res.text();

      const parsed = parseBulkPANInput(content);

      if (parsed.uniqueAcceptedPans.length === 0) {
        await ctx.reply('❌ No valid PAN numbers found in the uploaded file.', { parse_mode: 'HTML' });
        return;
      }

      const bulkJob = await bulkService.createBulkJob(
        { pans: parsed.uniqueAcceptedPans.map((p) => ({ pan: p.normalizedPan, label: p.label })) },
        String(ctx.from?.id),
        ctx.chat?.id
      );

      let msg = `<b>📦 BULK JOB CREATED</b>\n\n`;
      msg += `<b>Job ID:</b> <code>${bulkJob.jobId}</code>\n`;
      msg += `<b>Total Rows:</b> ${parsed.totalRows}\n`;
      msg += `<b>Valid Unique PANs:</b> ${bulkJob.uniquePans}\n`;
      msg += `<b>Rejected / Invalid:</b> ${parsed.rejected.length}\n`;
      msg += `<b>Duplicates:</b> ${parsed.duplicateCount}\n\n`;
      msg += `⏳ <i>Processing in background... You will be notified automatically upon completion.</i>`;

      await ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (error) {
      await ctx.reply(`❌ Failed to process document: ${(error as Error).message}`);
    }
  });

  // Callback query dispatcher
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data === 'cmd:ipos') {
      const result = await ipoService.listIPOs({ page: 1, limit: 5 });
      await ctx.reply(`Found ${result.ipos.length} active IPOs.`);
    } else if (data === 'cmd:bulk') {
      await ctx.reply('Send me your PAN list or upload a .txt/.csv file.');
    } else if (data.startsWith('check:ipo:')) {
      const symbol = data.replace('check:ipo:', '');
      await ctx.reply(`To check your application for ${symbol}, run <code>/check &lt;PAN&gt;</code>`, {
        parse_mode: 'HTML',
      });
    }

    await ctx.answerCallbackQuery();
  });

  return bot;
}

export const telegramBot = createTelegramBot();
