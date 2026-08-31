# NSE — IPO Metadata Provider

**Last Verified**: 2026-08-31  
**Provider Status for Metadata**: `ACTIVE`  
**Provider Status for Allotment**: `UNSUPPORTED`  
**Source Authority**: AUTHORITATIVE (Exchange)

---

## Overview

NSE (National Stock Exchange of India) provides IPO listing metadata via semi-public API endpoints. NSE does NOT provide PAN-based allotment lookup — allotment queries must go to the IPO's designated RTA (KFintech or MUFG Intime for most NSE-listed IPOs).

---

## IPO Metadata Access

| Field | Value |
|-------|-------|
| Endpoint (current allotment) | `https://www.nseindia.com/api/ipo-current-allotment` |
| Endpoint (upcoming) | `https://www.nseindia.com/api/allotmentAndListingDate` |
| Method | HTTP GET |
| Authentication | Session cookie (`nsit`) obtained from homepage |
| CAPTCHA | None |
| Rate Limit | ~30 requests/minute before soft blocking |
| Automation Allowed | Limited (session-based, not officially documented API) |

### Required Headers

NSE API calls require:
```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...
Accept: application/json, text/plain, */*
Referer: https://www.nseindia.com/
Cookie: nsit=<session_cookie>
```

The `nsit` cookie is obtained by making an initial GET to `https://www.nseindia.com/` and reading the `Set-Cookie` header. This cookie has a limited lifetime and must be refreshed periodically.

---

## Metadata Response Fields

The allotment API returns an array of IPO objects with fields including:
- `companyName` — full company name
- `symbol` — NSE trading symbol
- `openDate`, `closeDate` — subscription dates
- `allotmentDate`, `listingDate` — post-subscription dates
- `issuePrice` — final issue price
- `priceBandMin`, `priceBandMax` — price band
- `lotSize` — minimum lot size
- `registrar` — registrar name (used to route allotment queries)

---

## PAN Allotment

NSE does NOT provide PAN-based allotment status lookup. This is handled exclusively by the registered RTA.

**Allotment provider status: `UNSUPPORTED`**

---

## Known Failure Modes

- `nsit` cookie expiry (session-based, expires after ~60 minutes of inactivity)
- IP-based soft rate limiting at >30 req/min
- API response structure may change without notice (not an officially documented API)
- `503` responses during market hours due to load

---

## Data Quality

NSE metadata is considered **AUTHORITATIVE** for:
- Symbol
- Exchange
- Dates (open, close, allotment, listing)
- Issue price
- Registrar name

GMP (Grey Market Premium) is NOT from NSE — it is market data and should be sourced separately with appropriate provenance.

---

## Official Links

- NSE IPO Page: https://www.nseindia.com/market-data/ipo
- NSE API (unofficial): https://www.nseindia.com/api/ipo-current-allotment
