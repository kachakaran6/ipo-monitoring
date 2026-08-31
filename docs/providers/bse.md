# BSE — IPO Metadata Provider

**Last Verified**: 2026-08-31  
**Provider Status for Metadata**: `ACTIVE`  
**Provider Status for Allotment**: `UNSUPPORTED`  
**Source Authority**: AUTHORITATIVE (Exchange)

---

## Overview

BSE (Bombay Stock Exchange) provides IPO listing metadata. Like NSE, BSE does NOT provide PAN-based allotment lookup. Allotment queries must go to the designated RTA.

---

## IPO Metadata Access

| Field | Value |
|-------|-------|
| Endpoint (IPO info) | `https://api.bseindia.com/BseIndiaAPI/api/IPOInfo/w` |
| Endpoint (new listings) | `https://api.bseindia.com/BseIndiaAPI/api/Equities/w?type=EQ&subcategory=IP` |
| Method | HTTP GET |
| Authentication | None (public API) |
| CAPTCHA | None |
| Rate Limit | ~30 requests/minute |
| Automation Allowed | Limited |

### Required Headers

```
User-Agent: Mozilla/5.0...
Referer: https://www.bseindia.com/
```

---

## Metadata Response Fields

BSE API returns IPO data including:
- `SECURITY_NAME` / `SECURITY_CODE` — company name and BSE script code
- `ISSUE_OPEN_DATE`, `ISSUE_CLOSE_DATE`
- `ALLOTMENT_DATE`, `LISTING_DATE`
- `ISSUE_PRICE` — final issue price
- `FACE_VALUE`
- `ISSUE_SIZE`
- `REGISTRAR_NAME` — registrar (used to route allotment queries)

---

## PAN Allotment

BSE does NOT provide PAN-based allotment lookup. The BSE website redirects allotment queries to the respective RTA portal.

**Allotment provider status: `UNSUPPORTED`**

---

## Known Failure Modes

- Response format changes without notice
- API returns `{}` or empty arrays for IPOs not yet listed
- CORS restrictions when called from browser (not an issue from server-side)
- Rate limiting at high poll frequencies

---

## Data Quality

BSE metadata is considered **AUTHORITATIVE** for:
- Security name and code
- Exchange listing dates
- Issue price
- Registrar name (for BSE-listed IPOs)

---

## Official Links

- BSE IPO Page: https://www.bseindia.com/markets/publicIssues/IPO.aspx
- BSE API: https://api.bseindia.com/
