# Provider Capability Matrix

**Last Verified**: 2026-08-31  
**Scope**: Indian IPO allotment checking — real-data-only engine

> [!IMPORTANT]
> A capability is only marked ✅ when verified from current official documentation or a confirmed working legitimate API integration.
> Capabilities that require CAPTCHA, private API access, or are inferred rather than confirmed are explicitly marked.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Confirmed available |
| ❌ | Confirmed not available |
| ⚠️ CAPTCHA | Available via web form, but CAPTCHA is enforced — automated access not possible |
| 🔐 OAuth | Requires OAuth user token (not server-side key) |
| 🔑 Key | Requires API key from provider |
| ❓ | Not verified |

---

## Capability Matrix

| Provider | IPO Metadata | PAN Lookup | App Lookup | Allotment Status | Applied Qty | Allotted Qty | Issue Price | Registrar | Public API | Authentication | CAPTCHA | Automation Allowed | Source Authority | Provider Status |
|----------|-------------|------------|------------|-----------------|-------------|-------------|-------------|-----------|-----------|----------------|---------|-------------------|-----------------|-----------------|
| **NSE** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ (limited) | Cookie/Session | No | Limited | AUTHORITATIVE (metadata) | `METADATA_ONLY` |
| **BSE** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ (limited) | Cookie/Session | No | Limited | AUTHORITATIVE (metadata) | `METADATA_ONLY` |
| **KFintech** | ❌ | ⚠️ CAPTCHA | ⚠️ CAPTCHA | ⚠️ CAPTCHA | ⚠️ CAPTCHA | ⚠️ CAPTCHA | ❌ | ❌ | ❌ | None | reCAPTCHA v2 | ❌ No | AUTHORITATIVE (allotment) | `MANUAL_ONLY` |
| **MUFG/Link Intime** | ❌ | ⚠️ CAPTCHA | ⚠️ CAPTCHA | ⚠️ CAPTCHA | ⚠️ CAPTCHA | ⚠️ CAPTCHA | ❌ | ❌ | ❌ | None | Image CAPTCHA | ❌ No | AUTHORITATIVE (allotment) | `MANUAL_ONLY` |
| **Bigshare** | ❌ | ⚠️ CAPTCHA | ⚠️ CAPTCHA | ⚠️ CAPTCHA | ⚠️ CAPTCHA | ⚠️ CAPTCHA | ❌ | ❌ | ❌ | None | CAPTCHA | ❌ No | AUTHORITATIVE (allotment) | `MANUAL_ONLY` |
| **Cameo** | ❌ | ⚠️ CAPTCHA | ⚠️ CAPTCHA | ⚠️ CAPTCHA | ❓ | ❓ | ❌ | ❌ | ❌ | None | CAPTCHA | ❌ No | AUTHORITATIVE (allotment) | `MANUAL_ONLY` |
| **Upstox** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | 🔐 OAuth (user) | No | ✅ (with token) | SECONDARY (licensed) | `OAUTH_REQUIRED` |

---

## Notes

### NSE
- Public endpoints available at `nseindia.com/api/` for IPO listings
- Requires `User-Agent` header and `nsit` cookie from homepage (mandatory session)
- Does NOT provide PAN-based allotment lookup
- IPO metadata is authoritative for NSE-listed companies

### BSE
- Public endpoints at `api.bseindia.com` for IPO listings  
- Does NOT provide PAN-based allotment lookup
- IPO metadata is authoritative for BSE-listed companies

### KFintech
- URL: `https://ris.kfintech.com/ipostatus/`
- Web form requires: PAN, Scrip (IPO select dropdown)
- **reCAPTCHA v2** enforced on the form — automated submission is blocked
- No public REST API documented or available
- **Automation status**: FORBIDDEN (CAPTCHA bypass violates ToS and §20 of requirements)

### MUFG Intime (formerly Link Intime)
- URL: `https://linkintime.co.in/MUFG/web/PanSearch.aspx`
- Web form requires: PAN, company select
- **Image CAPTCHA** enforced
- No public REST API
- **Automation status**: FORBIDDEN

### Bigshare
- URL: `https://www.bigshareonline.com/ipo_Allotment.html`
- Web form with PAN and IPO dropdown
- **CAPTCHA** enforced
- No public REST API
- **Automation status**: FORBIDDEN

### Upstox
- V2 IPO API exists (`api.upstox.com/v2/market-quote/ipo`)
- Requires **user-level OAuth2 token** — not a server-side API key
- Without a user token, returns 401
- Does not support PAN allotment lookup

---

## Consequence for the Engine

Because all allotment RTA portals (KFintech, MUFG, Bigshare) enforce CAPTCHA:

1. All allotment provider checks will return `CAPTCHA_REQUIRED`
2. The `registrarUrl` will be included so users can check manually
3. The system will NEVER fabricate a `PENDING`, `NOT_ALLOTTED`, or `ALLOTTED` result
4. When/if any provider releases a public REST API, the adapter can be updated

This is the only correct and legally compliant behaviour.
