import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { InvalidPANError } from '../errors/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * Validates and normalizes PAN to uppercase trimmed string.
 * Throws InvalidPANError if invalid.
 */
export function normalizeAndValidatePAN(pan: string): string {
  if (!pan || typeof pan !== 'string') {
    throw new InvalidPANError('PAN must be a non-empty string');
  }

  const normalized = pan.trim().toUpperCase();
  if (!PAN_REGEX.test(normalized)) {
    throw new InvalidPANError(`Invalid PAN format: '${maskPAN(normalized)}'`);
  }

  return normalized;
}

/**
 * Checks if a string is a valid PAN without throwing.
 */
export function isValidPAN(pan: string): boolean {
  if (!pan || typeof pan !== 'string') return false;
  return PAN_REGEX.test(pan.trim().toUpperCase());
}

/**
 * Masks a PAN number to hide sensitive identification info.
 * Example: 'ABCDE1234F' -> 'XXXXX1234F'
 */
export function maskPAN(pan: string): string {
  if (!pan || typeof pan !== 'string') return 'UNKNOWN_PAN';
  const clean = pan.trim().toUpperCase();
  if (clean.length === 10) {
    return `XXXXX${clean.slice(-5)}`;
  }
  if (clean.length <= 4) return 'XXXX';
  return 'X'.repeat(clean.length - 4) + clean.slice(-4);
}

/**
 * Extracts the 5-character suffix (e.g. '1234F') of a PAN for display/reference.
 */
export function getPANLast4(pan: string): string {
  const clean = pan.trim().toUpperCase();
  return clean.slice(-5);
}

/**
 * Computes deterministic HMAC-SHA256 hash for database index lookups.
 * Does not expose plaintext or allow rainbow table attacks.
 */
export function hashPAN(pan: string, customSecret?: string): string {
  const normalized = normalizeAndValidatePAN(pan);
  const secret = customSecret || env.PAN_HMAC_SECRET;
  return crypto.createHmac('sha256', secret).update(normalized).digest('hex');
}

/**
 * Encrypts normalized PAN using AES-256-GCM.
 * Output format: base64(iv + authTag + ciphertext)
 */
export function encryptPAN(pan: string, customKeyHex?: string): string {
  const normalized = normalizeAndValidatePAN(pan);
  const keyHex = customKeyHex || env.PAN_ENCRYPTION_KEY;
  const key = Buffer.from(keyHex, 'hex');

  if (key.length !== 32) {
    throw new Error('PAN encryption key must be 32 bytes (64 hex characters)');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine: IV (12) + AuthTag (16) + Encrypted
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypts AES-256-GCM encrypted PAN.
 * Recovers normalized plaintext PAN for external provider query only.
 */
export function decryptPAN(encryptedBase64: string, customKeyHex?: string): string {
  if (!encryptedBase64) {
    throw new Error('Encrypted payload cannot be empty');
  }

  const keyHex = customKeyHex || env.PAN_ENCRYPTION_KEY;
  const key = Buffer.from(keyHex, 'hex');

  const combined = Buffer.from(encryptedBase64, 'base64');
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted PAN payload length');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
