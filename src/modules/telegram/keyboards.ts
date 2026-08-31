import { InlineKeyboard } from 'grammy';

export function getMainKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📊 Active IPOs', 'cmd:ipos')
    .text('📦 Bulk Check', 'cmd:bulk')
    .row()
    .text('🎉 Allotted', 'cmd:allotted')
    .text('⏳ Pending', 'cmd:pending')
    .row()
    .text('⚙️ Settings', 'cmd:settings')
    .text('❓ Help', 'cmd:help');
}

export function getIPODetailsKeyboard(symbol: string, registrarUrl?: string | null): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text('🔍 Check Allotment', `check:ipo:${symbol}`)
    .text('📈 Subscription', `sub:ipo:${symbol}`);

  if (registrarUrl) {
    kb.row().url('🔗 Official Registrar', registrarUrl);
  }

  return kb;
}

export function getCheckResultKeyboard(panLast4: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('📜 View History', `hist:pan:${panLast4}`)
    .text('🔔 Watch PAN', `watch:pan:${panLast4}`);
}
