# Bigshare Services Allotment Provider

**Last Verified**: 2026-08-31  
**Provider Status**: `MANUAL_ONLY`  
**Source Authority**: AUTHORITATIVE (RTA)

---

## Overview

Bigshare Services Private Limited is an RTA primarily handling SME IPO allotments on BSE SME and NSE Emerge platforms, as well as some mainboard IPOs.

---

## Access Method

| Field | Value |
|-------|-------|
| Portal URL | `https://www.bigshareonline.com/ipo_Allotment.html` |
| Method | HTTP POST (web form) |
| Public REST API | ❌ None |
| Authentication | None (form-based) |
| CAPTCHA | ✅ CAPTCHA enforced |
| Automation Allowed | ❌ No |

---

## Request Format

HTML form POST with:
- `PAN_NO` — applicant PAN
- IPO select dropdown (dynamic values)
- CAPTCHA field

---

## Response Format

HTML page with allotment table or no-records message.

---

## Engine Behaviour

The `BigshareProvider` adapter will:
1. Attempt HEAD request to `bigshareonline.com` to verify reachability
2. Detect CAPTCHA presence
3. Return `CAPTCHA_REQUIRED` with official portal URL
4. Never fabricate status or quantity

---

## Official Links

- Allotment Portal: https://www.bigshareonline.com/ipo_Allotment.html
- Bigshare website: https://www.bigshareonline.com/
