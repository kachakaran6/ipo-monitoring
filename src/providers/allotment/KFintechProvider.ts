/**
 * KFintech Allotment Provider
 *
 * Target: https://ris.kfintech.com/ipostatus/
 * Current state: CAPTCHA_REQUIRED (reCAPTCHA v2 enforced on all form submissions)
 *
 * This provider performs a real HTTP probe to verify KFintech is reachable,
 * then returns CAPTCHA_REQUIRED with the official portal URL.
 *
 * NEVER returns: PENDING, NOT_ALLOTTED, ALLOTTED without a real authenticated response.
 *
 * When KFin Technologies releases a public REST API:
 *  1. Add KFINTECH_API_URL to env
 *  2. Override checkByPAN() with a real POST to that endpoint
 *  3. Parse response and map to AllotmentStatus
 *  4. Remove the CAPTCHA_REQUIRED return path
 */

import { CaptchaGatedRTAProvider } from './CaptchaGatedRTAProvider.js';

export class KFintechProvider extends CaptchaGatedRTAProvider {
  public readonly name = 'KFINTECH';

  /**
   * Canonical registrar names that map to KFintech.
   * Source: NSE/BSE IPO prospectus data.
   */
  public readonly supportedRegistrars = [
    'KFINTECH',
    'KFIN_TECH',
    'KFIN_TECHNOLOGIES',
    'KARVY', // Historical — pre-2020 filings
    'KFin Technologies Limited'.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
  ];

  /**
   * Primary allotment portal URL — official, verified.
   * Users are directed here when automated check is unavailable.
   */
  protected readonly portalUrl = 'https://ris.kfintech.com/ipostatus/';
  protected readonly healthCheckUrl = 'https://ris.kfintech.com/ipostatus/';
}
