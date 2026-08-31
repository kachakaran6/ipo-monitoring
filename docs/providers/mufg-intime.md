# MUFG Intime (Link Intime) Allotment Provider

**Last Verified**: 2026-08-31  
**Provider Status**: `MANUAL_ONLY`  
**Source Authority**: AUTHORITATIVE (RTA)

---

## Overview

MUFG Intime India Private Limited (formerly Link Intime India Private Limited) is one of India's two primary RTAs. Following the acquisition by MUFG (Mitsubishi UFJ Financial Group), the portal has been rebranded but the web infrastructure is largely the same.

---

## Access Method

| Field | Value |
|-------|-------|
| Portal URL | `https://linkintime.co.in/MUFG/web/PanSearch.aspx` |
| Method | HTTP POST (ASP.NET web form) |
| Public REST API | ❌ None |
| Authentication | None (form-based) |
| CAPTCHA | ✅ Image CAPTCHA enforced |
| Automation Allowed | ❌ No |

---

## Request Format

ASP.NET WebForms POST with:
- `__VIEWSTATE` — ASP.NET viewstate token (must be extracted from the GET response)
- `__EVENTVALIDATION` — ASP.NET event validation token
- `txtPanNo` — applicant PAN
- `ddlCompany` — IPO company dropdown value (dynamic)
- CAPTCHA image value field

The ASP.NET ViewState and EventValidation tokens change on every request, making automation significantly harder and requiring a full GET before every POST.

---

## Response Format

HTML page with result table or an inline error message if PAN not found.

---

## CAPTCHA Behaviour

Uses a proprietary image CAPTCHA embedded in the ASP.NET page. The CAPTCHA image URL is dynamically generated. Any POST without the correct CAPTCHA value results in a CAPTCHA error page.

---

## Rate Limits

No documented rate limits. Portal uses ASP.NET session tracking.

---

## Known Failure Modes

- CAPTCHA blocking (primary barrier)
- ASP.NET ViewState expiry between GET and POST
- Session timeout
- Company dropdown values change when new IPOs are added

---

## Engine Behaviour

The `MUFGIntimeProvider` adapter will:
1. Attempt HEAD request to `linkintime.co.in/MUFG/web/PanSearch.aspx` to verify reachability
2. Detect CAPTCHA (present on the ASP.NET form page)
3. Return `CAPTCHA_REQUIRED` with official portal URL
4. Never fabricate any status or quantity

---

## Official Links

- Allotment Portal: https://linkintime.co.in/MUFG/web/PanSearch.aspx
- MUFG Intime website: https://www.linkintime.co.in/
