import { env } from '../config/env.js';

/**
 * Checks if a Telegram user ID is authorized as an administrator.
 */
export function isTelegramAdmin(telegramUserId: number | string): boolean {
  const numericId = Number(telegramUserId);
  if (isNaN(numericId)) return false;
  return env.ADMIN_TELEGRAM_IDS.includes(numericId);
}

/**
 * Validates API secret token from header or query for protected endpoints.
 */
export function validateApiKey(apiKey?: string): boolean {
  if (!apiKey) return false;
  return apiKey === env.API_KEY_SECRET;
}
