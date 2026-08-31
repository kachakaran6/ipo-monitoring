import { describe, it, expect } from 'vitest';
import {
  InvalidPANError,
  ProviderUnavailableError,
  ProviderRateLimitError,
  ProviderCaptchaRequiredError,
  IPOUnavailableError,
  AllotmentNotFoundError,
} from '../../src/errors/index.js';

describe('Domain Error Taxonomy', () => {
  it('should construct typed domain errors with proper status codes and error codes', () => {
    const invalidPan = new InvalidPANError('Bad PAN');
    expect(invalidPan.statusCode).toBe(400);
    expect(invalidPan.errorCode).toBe('INVALID_PAN');

    const providerUnavail = new ProviderUnavailableError('MUFG_INTIME');
    expect(providerUnavail.statusCode).toBe(503);
    expect(providerUnavail.errorCode).toBe('PROVIDER_UNAVAILABLE');

    const rateLimit = new ProviderRateLimitError('NSE', 60);
    expect(rateLimit.statusCode).toBe(429);
    expect(rateLimit.errorCode).toBe('PROVIDER_RATE_LIMIT');
    expect(rateLimit.retryAfterSeconds).toBe(60);

    const captcha = new ProviderCaptchaRequiredError('KFINTECH', 'https://kfintech.com');
    expect(captcha.statusCode).toBe(503);
    expect(captcha.errorCode).toBe('PROVIDER_CAPTCHA_REQUIRED');

    const ipoUnavail = new IPOUnavailableError('ipo-123');
    expect(ipoUnavail.statusCode).toBe(404);
    expect(ipoUnavail.errorCode).toBe('IPO_UNAVAILABLE');

    const notFound = new AllotmentNotFoundError();
    expect(notFound.statusCode).toBe(404);
    expect(notFound.errorCode).toBe('ALLOTMENT_NOT_FOUND');
  });
});
