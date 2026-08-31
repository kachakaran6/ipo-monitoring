import { describe, it, expect } from 'vitest';
import {
  encryptPAN,
  decryptPAN,
  hashPAN,
  maskPAN,
  isValidPAN,
  normalizeAndValidatePAN,
  getPANLast4,
} from '../../src/security/crypto.js';
import { InvalidPANError } from '../../src/errors/index.js';

describe('PAN Cryptography & Security Module', () => {
  const samplePAN = 'ABCDE1234F';

  it('should validate correct PAN format', () => {
    expect(isValidPAN('ABCDE1234F')).toBe(true);
    expect(isValidPAN('abcde1234f')).toBe(true);
    expect(isValidPAN('  ABCDE1234F  ')).toBe(true);
  });

  it('should reject invalid PAN format', () => {
    expect(isValidPAN('ABCDE12345')).toBe(false);
    expect(isValidPAN('12345ABCDE')).toBe(false);
    expect(isValidPAN('ABCD1234F')).toBe(false);
    expect(isValidPAN('')).toBe(false);
  });

  it('should normalize valid PAN and throw on invalid PAN', () => {
    expect(normalizeAndValidatePAN(' abcde1234f ')).toBe('ABCDE1234F');
    expect(() => normalizeAndValidatePAN('INVALID')).toThrow(InvalidPANError);
  });

  it('should mask PAN hiding the first 6 characters', () => {
    expect(maskPAN('ABCDE1234F')).toBe('XXXXX1234F');
    expect(maskPAN('abcde1234f')).toBe('XXXXX1234F');
    expect(getPANLast4('ABCDE1234F')).toBe('1234F');
  });

  it('should encrypt and decrypt PAN accurately using AES-256-GCM', () => {
    const encrypted = encryptPAN(samplePAN);
    expect(encrypted).toBeDefined();
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toBe(samplePAN);
    expect(encrypted).not.toContain(samplePAN);

    const decrypted = decryptPAN(encrypted);
    expect(decrypted).toBe(samplePAN);
  });

  it('should produce unique ciphertexts for identical PANs due to random IVs', () => {
    const enc1 = encryptPAN(samplePAN);
    const enc2 = encryptPAN(samplePAN);

    expect(enc1).not.toBe(enc2);
    expect(decryptPAN(enc1)).toBe(samplePAN);
    expect(decryptPAN(enc2)).toBe(samplePAN);
  });

  it('should generate deterministic HMAC-SHA256 lookup hash', () => {
    const hash1 = hashPAN(samplePAN);
    const hash2 = hashPAN('abcde1234f');

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // 256 bits = 64 hex chars
    expect(hash1).not.toContain(samplePAN);
  });
});
