/**
 * MUFG Intime (formerly Link Intime) Allotment Provider
 *
 * Target: https://linkintime.co.in/MUFG/web/PanSearch.aspx
 * Current state: CAPTCHA_REQUIRED (image CAPTCHA enforced on ASP.NET form)
 *
 * NEVER returns: PENDING, NOT_ALLOTTED, ALLOTTED without a real authenticated response.
 *
 * When MUFG Intime releases a public REST API:
 *  1. Add MUFG_API_URL to env
 *  2. Override checkByPAN() in this class
 *  3. Parse response and map to AllotmentStatus
 */

import { CaptchaGatedRTAProvider } from './CaptchaGatedRTAProvider.js';

export class MUFGIntimeProvider extends CaptchaGatedRTAProvider {
  public readonly name = 'MUFG_INTIME';

  public readonly supportedRegistrars = [
    'MUFG_INTIME',
    'MUFG',
    'LINKINTIME',
    'LINK_INTIME',
    'Link Intime India Private Limited'.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
    'MUFG Intime India Private Limited'.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
  ];

  protected readonly portalUrl = 'https://linkintime.co.in/MUFG/web/PanSearch.aspx';
  protected readonly healthCheckUrl = 'https://linkintime.co.in/';
}
