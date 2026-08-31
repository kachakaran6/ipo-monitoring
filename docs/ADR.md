# Architecture Decision Records (ADR)

## ADR 001: Technology Stack Selection

### Context
We need to build a production-grade, high-throughput, resilient Indian IPO Intelligence and PAN Allotment Monitoring Platform. The system must support asynchronous polling, queue-backed bulk processing, scheduled synchronization, Telegram bot interactions with inline keyboards, Pushover notifications, and zero-leakage PAN security.

### Decision
- **Runtime**: Node.js 22+ with TypeScript in strict mode.
- **Web Framework**: Fastify 5.x for high-throughput HTTP endpoints, low overhead, and first-class schema validation.
- **Database**: PostgreSQL 16+ managed via Drizzle ORM for type-safe schema definitions and explicit SQL migrations.
- **Cache & Message Broker**: Redis 7+ with BullMQ for reliable background job processing, exponential backoff, rate limiting, and deduplication.
- **Telegram Bot Framework**: GrammY for clean TypeScript support, native webhook & polling modes, session management, and inline keyboards.
- **Process Model**: Decoupled multi-process model separating HTTP API / Webhook handling (`app`) from BullMQ job execution and scheduled tasks (`worker`).

### Status
Accepted

---

## ADR 002: PAN Cryptography & Security Model

### Context
Permanent Account Number (PAN) is sensitive personal and financial information in India. Storing or logging plaintext PANs violates data protection principles and introduces major liability.

### Decision
1. **Encryption at Rest**: All stored PANs must be encrypted using AES-256-GCM with a 96-bit (12-byte) initialization vector (IV) and a 128-bit authentication tag.
2. **Search Indexing**: Direct lookups will be performed using an HMAC-SHA256 hash computed with a dedicated `PAN_HMAC_SECRET`. Plaintext PAN will never be hashed with unsalted SHA256.
3. **Display Masking**: Everywhere outside controlled decryption contexts, PANs will be masked as `XXXXX1234F` (only the last 4 characters visible).
4. **Log Redaction**: Global Pino logging serializers will actively redact PAN-shaped strings (`^[A-Z]{5}[0-9]{4}[A-Z]$`). Plaintext PANs are prohibited from URL query parameters, cache keys, and error messages.

### Status
Accepted

---

## ADR 003: Provider Abstraction & Graceful Degradation

### Context
Indian IPO registrars (e.g., MUFG Intime, KFintech, Bigshare) and stock exchanges (NSE, BSE) do not all provide standardized public APIs and frequently employ anti-bot protections, CAPTCHA, or rate limits.

### Decision
1. **Abstraction Interface**: All data sources and allotment registrars must implement unified interfaces (`IPODataProvider` and `AllotmentProvider`).
2. **Rate Limiting**: Each external source has an isolated Bottleneck limiter preventing excessive traffic and avoiding bans.
3. **Graceful Degradation**: If an external provider returns CAPTCHA, 429, or downtime, the system MUST return explicit statuses (`CAPTCHA_REQUIRED`, `RATE_LIMITED`, `CHECK_FAILED`, `MANUAL_VERIFICATION_REQUIRED`) along with the official registrar link. It must **NEVER** fabricate or assume `NOT_ALLOTTED`.
4. **Circuit & Health Tracking**: Consecutive failures update provider health states in Redis / PostgreSQL to prevent calling degrading endpoints.

### Status
Accepted

---

## ADR 004: Deduplication & State Change Notification Policy

### Context
Allotment status polling can run every few minutes for multiple days after an IPO closes. Users must not be spammed with repeated notifications for the same status.

### Decision
1. **State Fingerprinting**: Each allotment result generates a deterministic SHA-256 fingerprint:
   `sha256(panHash + ipoId + status + allottedQuantity + issuePrice)`.
2. **Notification Event Gate**: Before sending an alert (via Telegram or Pushover), the system queries `notification_events` for existing fingerprint matches.
3. **State Transitions**: Notifications are only dispatched on meaningful state transitions (e.g., `PENDING -> ALLOTTED`, `PENDING -> NOT_ALLOTTED`). Redundant `PENDING -> PENDING` checks are silently recorded without triggering user notifications.

### Status
Accepted
