# KFintech Allotment Provider

**Last Verified**: 2026-08-31  
**Provider Status**: `MANUAL_ONLY`  
**Source Authority**: AUTHORITATIVE (RTA)

---

## Overview

KFin Technologies (formerly Karvy) is one of India's two primary Registrar and Transfer Agents (RTAs) for IPO allotment. It handles allotment for a large proportion of NSE/BSE mainboard IPOs.

---

## Access Method

| Field | Value |
|-------|-------|
| Portal URL | `https://ris.kfintech.com/ipostatus/` |
| Method | HTTP POST (web form) |
| Public REST API | ❌ None |
| Authentication | None (form-based) |
| CAPTCHA | ✅ reCAPTCHA v2 enforced |
| Automation Allowed | ❌ No |

---

## Request Format

Form fields submitted via POST:
- `PanNo` — applicant PAN
- `Scrip` — IPO identifier (dropdown value, not a fixed ID)
- `g-recaptcha-response` — CAPTCHA token (required)

The `Scrip` field values are dynamically loaded from the page and change for each IPO. There is no stable mapping between IPO name/symbol and the Scrip dropdown value without first scraping the form.

---

## Response Format

HTML page containing a result table with columns:
- Application Number
- Category
- Applied Quantity
- Allotted Quantity
- Status

No JSON API response.

---

## CAPTCHA Behaviour

The form uses **Google reCAPTCHA v2** ("I'm not a robot" checkbox). The server validates the `g-recaptcha-response` token server-side. Any request without a valid CAPTCHA token returns an error page.

**This means automated PAN lookup is technically impossible** without CAPTCHA solving, which violates both the provider's Terms of Service and requirement §20 of this system.

---

## Rate Limits

Unknown — no documented rate limits. Web form does not publish a rate limit policy. Aggressive polling would trigger IP-based blocking.

---

## Known Failure Modes

- CAPTCHA blocking (primary barrier to automation)
- IP-based rate limiting if polled aggressively
- Session/cookie expiry for scrapers
- Dynamic Scrip IDs change when new IPO is added to the form

---

## Engine Behaviour

The `KFintechProvider` adapter will:
1. Attempt an HTTP HEAD request to `ris.kfintech.com/ipostatus/` to verify reachability
2. Detect CAPTCHA requirement (present on the form page)
3. Return `CAPTCHA_REQUIRED` with `registrarUrl = 'https://ris.kfintech.com/ipostatus/'`
4. Never return a fabricated `PENDING`, `ALLOTTED`, or `NOT_ALLOTTED`

When/if KFintech releases a public API:
- Implement POST to documented endpoint
- Parse JSON response
- Map `allotmentStatus` field to `AllotmentStatus`
- Return `null` for any field not explicitly provided

---

## Official Links

- Allotment Portal: https://ris.kfintech.com/ipostatus/
- KFin Technologies website: https://www.kfintech.com/
