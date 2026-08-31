/**
 * Bigshare Services Allotment Provider
 *
 * Target: https://www.bigshareonline.com/ipo_Allotment.html
 * Current state: CAPTCHA_REQUIRED (CAPTCHA enforced on web form)
 * Primary use: SME IPOs on BSE SME / NSE Emerge
 *
 * NEVER returns: PENDING, NOT_ALLOTTED, ALLOTTED without a real authenticated response.
 *
 * When Bigshare releases a public REST API:
 *  1. Add BIGSHARE_API_URL to env
 *  2. Override checkByPAN() in this class
 */

import { CaptchaGatedRTAProvider } from './CaptchaGatedRTAProvider.js';

export class BigshareProvider extends CaptchaGatedRTAProvider {
  public readonly name = 'BIGSHARE';

  public readonly supportedRegistrars = [
    'BIGSHARE',
    'BIG_SHARE',
    'BIGSHARE_SERVICES',
    'Bigshare Services Private Limited'.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
  ];

  protected readonly portalUrl = 'https://www.bigshareonline.com/ipo_Allotment.html';
  protected readonly healthCheckUrl = 'https://www.bigshareonline.com/';
}
