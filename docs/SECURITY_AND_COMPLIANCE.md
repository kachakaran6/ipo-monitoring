# Security, Privacy & Legal Compliance

## 1. Zero-Plaintext PAN Policy

Permanent Account Numbers (PANs) are subject to stringent data privacy guidelines. The following non-negotiable security controls are enforced:

### Cryptographic Safeguards
1. **Symmetric Encryption (AES-256-GCM)**:
   - Every stored PAN is encrypted using a unique, cryptographically random 12-byte initialization vector (IV).
   - An authentication tag (16 bytes) is generated and validated upon decryption to detect tampering.
   - Master encryption keys (`PAN_ENCRYPTION_KEY`) must be 32 bytes (64 hex characters) and injected strictly via environment variables.

2. **Blind Indexing (HMAC-SHA256)**:
   - For database index lookups, the system computes `HMAC-SHA256(PAN_HMAC_SECRET, normalized_pan)`.
   - The original PAN cannot be derived from this hash.
   - Raw unsalted SHA-256 is strictly prohibited to prevent rainbow table attacks.

3. **Masking & UI Isolation**:
   - Plaintext PAN is never sent in API responses or Telegram messages.
   - Masked representation: `XXXXX1234F` (5 leading `X`s followed by the last 4 characters).

4. **Structured Logger Redaction**:
   - The Pino logging engine intercepts and masks any substring matching `[A-Z]{5}[0-9]{4}[A-Z]`.
   - Plaintext PANs are excluded from URL routes, query strings, and Redis cache keys.

---

## 2. External Provider Compliance & Anti-Scraping Rules

1. **Official / Licensed Interfaces First**:
   - The platform prioritizes authorized partner APIs and official public endpoints.
2. **Strict Rate Limiting**:
   - Every external endpoint is shielded by a Bottleneck rate limiter with sensible defaults (e.g. 10–30 req/min) to prevent degrading registrar servers.
3. **No CAPTCHA / Bot Bypass**:
   - The system does not attempt automated CAPTCHA solving, session forgery, or anti-bot evading techniques.
   - When encountering a CAPTCHA, the provider emits `ProviderCaptchaRequiredError`, marks the result as `MANUAL_VERIFICATION_REQUIRED`, and directs the user to the registrar's official portal.
4. **Honest Status Reporting**:
   - If a provider request fails due to network downtime, timeout, or rate limiting, the platform marks the result as `CHECK_FAILED` or `ERROR` — **never** fabricating `NOT_ALLOTTED`.

---

## 3. Data Retention & Right to be Forgotten

1. **Configurable Retention Windows**:
   - `RAW_PROVIDER_DATA_RETENTION_DAYS=30`: Raw provider JSON payloads in `allotment_checks` are purged after 30 days.
   - `AUDIT_RETENTION_DAYS=365`: Audit trail logs are maintained for 1 year.
   - `RESULT_RETENTION_DAYS=3650`: Verified historical allotments retained for user portfolio analytics.
2. **PAN Deletion**:
   - Deleting a PAN profile removes the AES ciphertext, HMAC lookup hash, and active subscription monitors immediately.
