# MASTER PRD + IMPLEMENTATION PROMPT

## Production-Grade Indian IPO Intelligence, PAN Allotment Checker & Notification Platform

You are a senior staff-level backend engineer, system architect, security engineer and DevOps engineer.

Build a **production-ready Indian IPO Intelligence & Allotment Monitoring Platform** using:

* Node.js
* TypeScript
* Fastify
* PostgreSQL
* Redis
* BullMQ
* Telegram Bot API
* Pushover API
* Docker / Docker Compose
* REST API
* Structured logging
* Automated scheduled jobs
* Provider/adaptor architecture
* Strong PAN security
* Automated retry and rate limiting

The system must be designed for real production usage, not as a prototype.

---

# 1. PRIMARY OBJECTIVE

The application should allow an authorized user/admin to provide:

* One PAN
* Multiple PANs
* PAN list through Telegram
* PAN CSV/TXT upload
* PAN selection from saved users
* Optional IPO selection
* Or simply request "check everything"

The system should automatically discover and return as much relevant IPO information as legally and technically available.

The core experience should be:

```text
User sends:

/check ABCDE1234F

                    ↓

System validates PAN

                    ↓

Find relevant IPOs

                    ↓

Determine applicable exchange/RTA/provider

                    ↓

Check allotment/application status

                    ↓

Normalize results

                    ↓

Store/update database

                    ↓

Compare with previous result

                    ↓

Send notification only when useful

                    ↓

Telegram + Pushover
```

---

# 2. IMPORTANT DATA-SOURCE PRINCIPLE

DO NOT assume that one API or website can provide all PAN-based IPO information.

Build a provider abstraction layer.

Potential sources should include:

1. NSE IPO bid/allotment verification where officially available.
2. BSE IPO facilities where officially available.
3. Official registrar/RTA sources.
4. MUFG Intime.
5. KFintech.
6. Bigshare.
7. Other legitimate IPO registrars as they become necessary.
8. Licensed third-party IPO data APIs.
9. Upstox IPO API for general IPO lifecycle information.
10. Other licensed market-data providers where useful.

Use official/licensed APIs wherever possible.

Do NOT bypass CAPTCHA.
Do NOT bypass authentication.
Do NOT defeat anti-bot protection.
Do NOT use stolen credentials.
Do NOT attempt unauthorized access to exchange/RTA systems.

If a provider does not expose a public API, implement a provider adapter that only uses an officially permitted interface or mark that provider as requiring manual/external verification.

The application must gracefully degrade instead of pretending that data exists.

Every result must contain:

* source
* timestamp
* confidence
* provider
* raw status
* normalized status

---

# 3. CORE FEATURES

## A. SINGLE PAN CHECK

Telegram:

/check ABCDE1234F

Return:

```text
IPO CHECK RESULT

PAN: XXXXX1234F

Total IPOs found: 14
Applications found: 7

ALLOTTED: 2
NOT ALLOTTED: 4
PENDING: 1

--------------------------------

1. Example IPO Ltd
Status: ALLOTTED
Applied: 44
Allotted: 44
Price: ₹340
Amount: ₹14,960
Registrar: MUFG Intime
Checked: 20:31 IST

2. Example Technologies
Status: NOT ALLOTTED
Applied: 65
Allotted: 0
Amount: ₹13,650

3. Example SME Ltd
Status: PENDING
Application: XXXXXXXX
```

Never expose the complete PAN unnecessarily.

Mask PAN everywhere except controlled admin views.

---

# 4. BULK PAN CHECK

Support:

```text
/bulk
```

Then accept:

* CSV
* TXT
* multiline PAN input
* Telegram document

Example:

```text
ABCDE1234F
FGHIJ5678K
LMNOP9012Q
...
```

System should:

1. Validate all PANs.
2. Remove duplicates.
3. Normalize uppercase.
4. Create a bulk job.
5. Process asynchronously.
6. Respect provider rate limits.
7. Use concurrency controls.
8. Retry transient failures.
9. Store results.
10. Send completion notification.

Example:

```text
BULK IPO CHECK

Total PANs: 100
Processed: 100
Successful: 96
Partial: 3
Failed: 1

Allotted applications: 21
Not allotted: 61
Pending: 14

Duration: 4m 18s
```

---

# 5. IPO HISTORY

For each PAN maintain an internal history of every verified application/result.

Example:

```text
PAN PROFILE

Total applications: 27
Allotted: 8
Not allotted: 17
Pending: 2

Total applied capital:
₹4,82,000

Total allotted capital:
₹1,36,000

Success rate:
29.63%

Recent IPOs:

2026
├── IPO A → ALLOTTED
├── IPO B → NOT ALLOTTED
├── IPO C → ALLOTTED
└── IPO D → PENDING
```

History should be based only on information actually obtained from supported providers.

Do not manufacture historical data.

---

# 6. IPO MASTER DATABASE

Maintain a canonical IPO database.

Fields:

```text
id
symbol
company_name
slug
isin
exchange
issue_type
mainboard_or_sme
status

open_date
close_date
allotment_date
refund_date
demat_credit_date
listing_date

face_value
price_band_min
price_band_max
issue_price
lot_size
minimum_application
issue_size

registrar
registrar_url

subscription_qib
subscription_nii
subscription_retail
subscription_employee
subscription_total

gmp
gmp_percentage

source
source_updated_at
created_at
updated_at
```

Support lifecycle:

```text
UPCOMING
OPEN
CLOSED
ALLOTMENT_PENDING
ALLOTTED
LISTED
COMPLETED
WITHDRAWN
```

Do not hard-code statuses.

---

# 7. IPO DATA ENGINE

Create:

```text
IPODataProvider
```

Interface:

```ts
interface IPODataProvider {
  getUpcomingIPOs(): Promise<IPO[]>;
  getOpenIPOs(): Promise<IPO[]>;
  getClosedIPOs(): Promise<IPO[]>;
  getIPO(id: string): Promise<IPO | null>;
  getSubscriptionData(id: string): Promise<SubscriptionData | null>;
}
```

Implement separate adapters:

```text
UpstoxIPOProvider
IPODataProvider
IPOGuruProvider
IPONotifyProvider
NSEProvider
BSEProvider
```

Providers must be configurable through environment variables.

Do not make the application dependent on one provider.

---

# 8. ALLOTMENT PROVIDER ENGINE

Create:

```ts
AllotmentProvider
```

Interface:

```ts
interface AllotmentProvider {
  supportsIPO(ipo: IPO): boolean;

  checkByPAN(
    pan: string,
    ipo: IPO
  ): Promise<AllotmentResult>;

  checkByApplicationNumber(
    applicationNumber: string,
    ipo: IPO
  ): Promise<AllotmentResult>;
}
```

Implement adapters such as:

```text
NSEAllotmentProvider
BSEAllotmentProvider
MUFGIntimeProvider
KFintechProvider
BigshareProvider
OtherRTAProvider
```

Provider selection:

```text
IPO
 ↓
identify registrar
 ↓
select provider
 ↓
execute query
 ↓
normalize result
```

---

# 9. NORMALIZED ALLOTMENT RESULT

Every provider must convert its response to:

```ts
interface AllotmentResult {
  panHash: string;
  ipoId: string;

  applicationNumber?: string;

  status:
    | "ALLOTTED"
    | "NOT_ALLOTTED"
    | "PENDING"
    | "NOT_FOUND"
    | "ERROR"
    | "UNKNOWN";

  appliedQuantity?: number;
  allottedQuantity?: number;

  issuePrice?: number;
  amountApplied?: number;
  amountAllotted?: number;

  refundAmount?: number;

  dematCreditStatus?: string;

  source: string;
  checkedAt: Date;

  confidence:
    | "HIGH"
    | "MEDIUM"
    | "LOW";

  rawReference?: string;
}
```

---

# 10. RESULT CHANGE DETECTION

This is extremely important.

Never repeatedly notify users with the same result.

Store previous state.

Example:

```text
Previous:
PENDING

New:
ALLOTTED
```

Trigger notification.

But:

```text
Previous:
ALLOTTED

New:
ALLOTTED
```

Do NOT notify again.

Use a deterministic fingerprint:

```text
sha256(
  panHash +
  ipoId +
  status +
  allottedQuantity +
  issuePrice
)
```

---

# 11. AUTOMATIC ALLOTMENT MONITORING

After an IPO closes:

```text
CLOSED
   ↓
wait until allotment window
   ↓
periodic checking
   ↓
PENDING
   ↓
ALLOTTED / NOT_ALLOTTED
   ↓
notify immediately
   ↓
stop polling that IPO/PAN
```

Do not poll indefinitely.

Use configurable policies:

```env
ALLOTMENT_POLL_INTERVAL_MINUTES=5
ALLOTMENT_MAX_ATTEMPTS=100
ALLOTMENT_MAX_AGE_HOURS=72
```

Implement exponential backoff where appropriate.

---

# 12. SMART SCHEDULER

Use BullMQ + Redis.

Queues:

```text
ipo-sync
subscription-sync
allotment-check
bulk-pan-check
notification
history-sync
cleanup
```

Jobs:

```text
sync:ipo-master
sync:ipo-subscription
check:allotment
bulk:pan
notify:telegram
notify:pushover
```

Every job must have:

* retry count
* exponential backoff
* timeout
* idempotency key
* dead-letter handling
* structured logs

---

# 13. TELEGRAM BOT

Commands:

```text
/start
/help

/check <PAN>

/bulk

/history <PAN>

/ipos

/ipo <name>

/status

/pending

/allotted

/notallotted

/watch <PAN>

/unwatch <PAN>

/settings

/admin
```

Example:

```text
/check ABCDE1234F
```

Bot should respond immediately:

```text
⏳ IPO check started.

PAN: XXXXX1234F
Job: #IPO-8F92A

You will receive the result automatically.
```

Then asynchronously send the final result.

---

# 14. TELEGRAM BUTTONS

Use inline keyboards.

Example:

```text
IPO CHECK

[Check All]
[Pending]
[Allotted]
[History]

[Watch PAN]
[Stop Watching]
```

IPO:

```text
Example IPO

[Check Allotment]
[IPO Details]
[Subscription]
[Registrar]
```

---

# 15. PUShover NOTIFICATIONS

Implement a dedicated notification service.

```ts
interface NotificationProvider {
  send(notification: Notification): Promise<void>;
}
```

Implement:

```text
TelegramNotificationProvider
PushoverNotificationProvider
```

Pushover should support:

* title
* message
* priority
* sound
* URL
* timestamp

Priority rules:

```text
ALLOTTED → high
NOT_ALLOTTED → normal
PENDING → low/no notification
SYSTEM_FAILURE → high
```

Do not send every polling event.

Only send meaningful state changes.

---

# 16. NOTIFICATION EXAMPLE

When allotted:

```text
🎉 IPO ALLOTMENT RESULT

Company: Example Technologies Ltd
PAN: XXXXX1234F

Status: ALLOTTED

Applied: 44 shares
Allotted: 44 shares

Issue Price: ₹340
Allotted Value: ₹14,960

Registrar: MUFG Intime

Checked: 31 Aug 2026, 8:42 PM IST

Source: Registrar
Confidence: HIGH
```

When not allotted:

```text
IPO ALLOTMENT RESULT

Company: Example Ltd

Status: NOT ALLOTTED

Applied: 65
Allotted: 0

Refund expected according to issue timeline.

Source: Registrar
```

---

# 17. PAN SECURITY

PAN is sensitive financial identity information.

NEVER:

* log plaintext PAN
* put plaintext PAN in URLs
* put plaintext PAN in Redis keys
* put plaintext PAN in error messages
* expose PAN in Telegram logs
* expose PAN in analytics
* store PAN unnecessarily

Use:

```text
encrypted_pan
pan_hash
pan_last4
```

Example:

```text
encrypted_pan = AES-256-GCM
pan_hash = HMAC-SHA256(server_secret, normalized_pan)
pan_last4 = last 4 characters
```

Use HMAC rather than plain SHA256 for lookup hashes.

Encryption key must come from a secrets manager/environment secret.

Implement:

```text
encryptPAN()
decryptPAN()
hashPAN()
maskPAN()
```

---

# 18. DATABASE

Use PostgreSQL.

Suggested tables:

```text
users

telegram_users

notification_channels

pan_profiles

ipo_master

ipo_events

ipo_subscription_snapshots

ipo_registrars

ipo_applications

allotment_results

allotment_checks

notification_events

bulk_jobs

bulk_job_items

provider_health

audit_logs
```

Important indexes:

```text
pan_hash
ipo_id
status
application_number
telegram_user_id
checked_at
created_at
```

Use UUID primary keys.

Use UTC timestamps internally.

Display IST to users.

---

# 19. PAN PROFILE

```sql
pan_profiles
-----------------------------
id
pan_encrypted
pan_hash
pan_last4
label
owner_user_id
is_active
created_at
updated_at
```

Never make PAN itself the primary key.

---

# 20. IPO APPLICATION

```text
ipo_applications

id
pan_profile_id
ipo_id
application_number
source
bid_quantity
bid_price
amount
application_status
first_seen_at
last_seen_at
```

Unique constraint:

```text
(pan_profile_id, ipo_id, application_number, source)
```

---

# 21. ALLOTMENT HISTORY

Store every meaningful state transition.

Example:

```text
PENDING
PENDING
PENDING
ALLOTTED
```

Do not store meaningless duplicate snapshots unless required for audit.

State transitions:

```text
UNKNOWN → PENDING
PENDING → ALLOTTED
PENDING → NOT_ALLOTTED
UNKNOWN → ALLOTTED
```

---

# 22. PROVIDER HEALTH

Track:

```text
provider
success_count
failure_count
latency_ms
last_success_at
last_failure_at
status
```

If one provider fails:

```text
Provider A
   ↓
FAIL

Provider B
   ↓
TRY FALLBACK
```

Never silently return fake "not allotted".

Distinguish:

```text
NOT_ALLOTTED
```

from:

```text
CHECK_FAILED
```

This distinction is mandatory.

---

# 23. RATE LIMITING

Every external provider must have its own limiter.

Example:

```text
NSE:
  configurable requests/minute

MUFG:
  configurable requests/minute

KFintech:
  configurable requests/minute

Bigshare:
  configurable requests/minute

Upstox:
  according to provider quota
```

Use:

```text
Bottleneck
```

or a Redis-backed limiter.

Never hammer registrar websites.

---

# 24. CAPTCHA / ANTI-BOT

If a provider requires CAPTCHA:

DO NOT attempt to bypass it.

Return:

```text
MANUAL_VERIFICATION_REQUIRED
```

and provide the official provider URL where appropriate.

The architecture must allow a provider to report:

```text
CAPTCHA_REQUIRED
RATE_LIMITED
AUTH_REQUIRED
TEMPORARILY_UNAVAILABLE
```

---

# 25. API ENDPOINTS

Build REST API:

```text
GET    /health
GET    /ready

GET    /api/v1/ipos
GET    /api/v1/ipos/:id
GET    /api/v1/ipos/:id/subscription

POST   /api/v1/pans
GET    /api/v1/pans
DELETE /api/v1/pans/:id

POST   /api/v1/check
POST   /api/v1/check/bulk

GET    /api/v1/results/:id
GET    /api/v1/pans/:id/history

POST   /api/v1/watch
DELETE /api/v1/watch/:id

GET    /api/v1/jobs/:id
GET    /api/v1/providers/health
```

Use:

```text
/api/v1
```

from day one.

---

# 26. REQUEST VALIDATION

Use Zod or TypeBox.

PAN validation:

```regex
^[A-Z]{5}[0-9]{4}[A-Z]$
```

Always:

```text
trim
uppercase
validate
normalize
```

Reject invalid PANs before creating jobs.

---

# 27. FASTIFY ARCHITECTURE

Use:

```text
src/
├── app.ts
├── server.ts
│
├── config/
│   ├── env.ts
│
├── modules/
│   ├── ipo/
│   ├── allotment/
│   ├── pan/
│   ├── notification/
│   ├── telegram/
│   ├── bulk/
│   └── health/
│
├── providers/
│   ├── ipo/
│   ├── allotment/
│   └── notification/
│
├── jobs/
│
├── db/
│
├── security/
│
├── middleware/
│
├── utils/
│
└── types/
```

Use dependency injection.

Keep business logic independent from Telegram.

---

# 28. TELEGRAM SHOULD NOT CONTAIN BUSINESS LOGIC

Bad:

```text
Telegram command
 ↓
scrape website
 ↓
send response
```

Correct:

```text
Telegram
 ↓
Command Handler
 ↓
Application Service
 ↓
Queue
 ↓
Provider Engine
 ↓
Database
 ↓
Notification Service
```

This allows the same functionality to later work through REST, web UI, CLI or another bot.

---

# 29. IDEMPOTENCY

Every check request must have an idempotency key.

Example:

```text
check:{panHash}:{ipoId}:{date}
```

Bulk:

```text
bulk:{jobId}:{panHash}:{ipoId}
```

Repeated requests should not create duplicate jobs unnecessarily.

---

# 30. BULK PROCESSING

Never process 500 PANs synchronously inside a Telegram request.

Correct:

```text
Telegram
 ↓
Create BulkJob
 ↓
Return Job ID
 ↓
BullMQ
 ↓
Workers
 ↓
Rate-limited provider calls
 ↓
Database
 ↓
Aggregate
 ↓
Notification
```

Use configurable worker concurrency:

```env
BULK_WORKER_CONCURRENCY=5
```

---

# 31. CSV SUPPORT

CSV columns should support:

```text
pan
label
telegram_chat_id
pushover_user_key
```

But never include notification secrets in a public upload.

Validate CSV.

Reject malformed rows.

Generate:

```text
accepted.csv
rejected.csv
```

when useful.

---

# 32. HISTORY ANALYTICS

Calculate:

```text
total applications
total allotted
total not allotted
pending
success percentage
total amount applied
total amount allotted
average application size
mainboard applications
SME applications
```

Do not claim "all IPO history" if historical data was not actually imported.

Clearly show:

```text
History coverage:
2026-01-01 → current
Sources:
NSE / RTA / configured providers
```

---

# 33. ADMIN MODE

Create admin-only commands:

```text
/admin
/providers
/jobs
/retry <jobId>
/health
/stats
/sync
/recheck <ipo>
/pause
/resume
```

Admin users must be whitelisted by Telegram user ID.

Never rely on Telegram username for authorization.

---

# 34. SECURITY

Implement:

* Helmet
* CORS
* rate limiting
* request validation
* secure headers
* secret management
* encryption
* HMAC PAN hashing
* audit logging
* Telegram user authorization
* admin authorization
* database least privilege
* Redis authentication
* HTTPS in production
* no secrets in source code

Never commit:

```text
.env
API keys
Telegram bot token
Pushover token
PAN encryption key
database passwords
```

---

# 35. OBSERVABILITY

Use structured JSON logging.

Prefer:

```text
pino
```

Log:

```text
request_id
job_id
provider
operation
latency
status
error_code
```

Never log PAN.

Add metrics:

```text
ipo_checks_total
ipo_checks_success_total
ipo_checks_failed_total
allotments_found_total
notifications_sent_total
provider_errors_total
provider_latency
bulk_jobs_total
```

Expose:

```text
/metrics
```

if Prometheus is enabled.

---

# 36. ERROR TAXONOMY

Create typed errors:

```text
InvalidPANError

ProviderUnavailableError

ProviderRateLimitError

ProviderCaptchaRequiredError

ProviderAuthError

IPOUnavailableError

AllotmentNotFoundError

DataSourceError

NotificationError

JobTimeoutError
```

Map them properly.

Never convert provider failure into:

```text
NOT_ALLOTTED
```

---

# 37. RETRY POLICY

Retry:

```text
network timeout
502
503
504
429
temporary provider failure
```

Do not blindly retry:

```text
invalid PAN
invalid IPO
authentication failure
CAPTCHA
permanent 4xx
```

Use exponential backoff with jitter.

---

# 38. NOTIFICATION DEDUPLICATION

Create:

```text
notification_events
```

Unique fingerprint:

```text
hash(
 user +
 panHash +
 ipoId +
 eventType +
 state
)
```

Before sending:

```text
if already_sent:
    skip
else:
    send
    record
```

---

# 39. NOTIFICATION PREFERENCES

Allow:

```text
Telegram: ON/OFF
Pushover: ON/OFF

Allotment alerts: ON/OFF
IPO opening alerts: ON/OFF
IPO closing alerts: ON/OFF
Listing alerts: ON/OFF
GMP alerts: ON/OFF
Subscription alerts: ON/OFF

High priority only: ON/OFF
```

---

# 40. IPO ALERTS

Support optional alerts for:

```text
IPO announced
IPO opens
IPO closes today
subscription updated
allotment expected
allotment published
listing tomorrow
listing today
```

But avoid notification spam.

Use aggregation.

---

# 41. CACHING

Redis cache:

```text
ipo:list:open
ipo:list:upcoming
ipo:{id}
ipo:{id}:subscription
provider:{name}:health
```

Use TTL.

Never cache sensitive PAN results in plaintext.

---

# 42. DATA FRESHNESS

Every result must show:

```text
Checked:
31 Aug 2026 20:42 IST

Source:
KFintech

Freshness:
12 seconds
```

If stale:

```text
⚠️ Data may be stale.
Last successful check: 17 minutes ago.
```

---

# 43. SOURCE PRIORITY

Create configurable provider priority.

Example:

```yaml
allotment:
  MUFG:
    - official
  KFINTECH:
    - official
  BIGSHARE:
    - official

general_ipo:
  - Upstox
  - licensed_provider
  - secondary_provider
```

Never hard-code provider priority in business logic.

---

# 44. OFFICIAL SOURCE LINKS

When a result cannot be automatically verified, provide the official verification page.

For example:

```text
Automatic verification unavailable.

Verify manually:
[Official Registrar]
```

Do not redirect users to suspicious third-party sites.

---

# 45. API KEY MANAGEMENT

Environment variables:

```env
DATABASE_URL=
REDIS_URL=

TELEGRAM_BOT_TOKEN=

PUSHOVER_APP_TOKEN=
PUSHOVER_USER_KEY=

UPSTOX_CLIENT_ID=
UPSTOX_CLIENT_SECRET=

IPO_GURU_API_KEY=
IPO_NOTIFY_API_KEY=

PAN_ENCRYPTION_KEY=
PAN_HMAC_SECRET=

ADMIN_TELEGRAM_IDS=
```

All optional providers should be disabled if credentials are absent.

---

# 46. CONFIGURATION

Create:

```text
config/default.ts
config/production.ts
config/test.ts
```

Never scatter magic numbers through the code.

---

# 47. DATABASE MIGRATIONS

Use:

```text
Drizzle ORM
```

or:

```text
Prisma
```

Prefer a production-friendly typed ORM with explicit migrations.

Every schema change must have migration files.

Never rely on:

```text
db push
```

for production.

---

# 48. TESTING

Minimum:

```text
Unit tests
Integration tests
Provider adapter tests
Telegram command tests
Notification tests
Database tests
Queue tests
Security tests
Rate-limit tests
Idempotency tests
```

Use:

```text
Vitest
```

or Jest.

Mock external providers.

Never make real NSE/RTA calls during normal automated tests.

---

# 49. PROVIDER CONTRACT TESTS

Every provider must pass the same contract:

```text
valid result
not found
pending
allotted
not allotted
rate limited
captcha
timeout
malformed response
provider unavailable
```

This is mandatory.

---

# 50. DOCKER

Provide:

```text
Dockerfile
docker-compose.yml
docker-compose.production.yml
.dockerignore
```

Services:

```text
app
worker
postgres
redis
```

Optional:

```text
prometheus
grafana
```

Use separate app and worker processes.

---

# 51. PRODUCTION DEPLOYMENT

Application must support:

```text
Node.js 22+
Docker
PostgreSQL 16+
Redis 7+
```

Use:

```text
healthcheck
readiness probe
graceful shutdown
SIGTERM handling
connection cleanup
queue shutdown
```

No data corruption during restart.

---

# 52. GRACEFUL SHUTDOWN

On SIGTERM:

```text
stop accepting requests
stop creating new jobs
finish safe active jobs
close Telegram polling/webhook
close Redis
close PostgreSQL
exit
```

---

# 53. TELEGRAM WEBHOOK

Production should support:

```text
Telegram webhook
```

rather than relying exclusively on long polling.

Development can use polling.

Endpoint:

```text
POST /webhooks/telegram
```

Verify webhook secret/token.

---

# 54. USER EXPERIENCE

The bot should feel extremely simple.

User should NOT need to understand providers.

Example:

```text
User:
/check ABCDE1234F

Bot:

🔎 Checking IPO applications...

PAN: XXXXX1234F
IPO universe: 18
Potential applications: 6

⏳ Checking registrars...

[View Progress]
```

Then:

```text
✅ CHECK COMPLETE

6 applications checked

🎉 Allotted: 2
❌ Not allotted: 3
⏳ Pending: 1

[View Details]
[View History]
```

---

# 55. BULK USER EXPERIENCE

User:

```text
/bulk
```

Bot:

```text
Send a TXT or CSV containing PAN numbers.

Maximum:
1000 PANs per job
```

After upload:

```text
📦 BULK JOB CREATED

PANs: 250
Unique: 237

Estimated provider requests:
...

Job ID:
BULK-72A81

[View Progress]
```

Progress:

```text
████████████░░░░ 78%

Processed: 185 / 237
Allotted: 32
Not allotted: 101
Pending: 52
Errors: 0
```

---

# 56. LARGE SCALE

Design initially for:

```text
1,000 PANs
10,000 PANs
100,000 PAN records
```

without redesigning the architecture.

Use queues and horizontal workers.

Never run all requests in one Node.js event loop task.

---

# 57. MULTI-TENANCY

Structure database so future SaaS support is possible.

Every sensitive resource should have:

```text
tenant_id
```

Even if the first deployment has only one tenant.

---

# 58. AUDIT LOG

Audit:

```text
PAN added
PAN deleted
PAN checked
Bulk job created
Provider queried
Allotment changed
Notification sent
Admin action
Settings changed
```

Do not store sensitive values unnecessarily.

---

# 59. DATA RETENTION

Make retention configurable:

```env
RAW_PROVIDER_DATA_RETENTION_DAYS=30
AUDIT_RETENTION_DAYS=365
RESULT_RETENTION_DAYS=3650
```

Sensitive data should not be retained forever without purpose.

---

# 60. LEGAL / COMPLIANCE GUARDRAILS

The application is a personal/authorized-information retrieval and notification system.

It must:

* only process PANs supplied by an authorized user
* avoid unauthorized access
* avoid CAPTCHA bypass
* avoid rate-limit evasion
* respect provider terms
* use licensed data where required
* provide source attribution where required
* protect PAN information
* provide deletion functionality

Do not market the system as an official NSE/BSE/RTA product.

---

# 61. IMPLEMENTATION ORDER

Build in this exact order.

PHASE 1:

```text
Project setup
TypeScript
Fastify
PostgreSQL
Redis
Docker
configuration
logging
health checks
```

PHASE 2:

```text
IPO master database
IPO provider abstraction
Upstox provider
licensed IPO data provider
IPO synchronization jobs
```

PHASE 3:

```text
PAN encryption
HMAC PAN lookup
PAN profiles
```

PHASE 4:

```text
Allotment provider abstraction
NSE adapter
MUFG adapter
KFintech adapter
Bigshare adapter
```

Only implement adapters when their access method is legitimately available.

PHASE 5:

```text
BullMQ
allotment polling
state machine
deduplication
```

PHASE 6:

```text
Telegram bot
commands
inline keyboards
bulk upload
```

PHASE 7:

```text
Pushover
notification preferences
notification deduplication
```

PHASE 8:

```text
history
analytics
admin
provider health
```

PHASE 9:

```text
tests
security audit
load testing
Docker production setup
observability
```

---

# 62. FINAL PROJECT STRUCTURE

Generate approximately:

```text
ipo-intelligence/
│
├── src/
│   ├── app.ts
│   ├── server.ts
│   │
│   ├── config/
│   ├── db/
│   ├── security/
│   ├── middleware/
│   │
│   ├── modules/
│   │   ├── ipo/
│   │   ├── allotment/
│   │   ├── pan/
│   │   ├── bulk/
│   │   ├── notification/
│   │   ├── telegram/
│   │   └── admin/
│   │
│   ├── providers/
│   │   ├── ipo/
│   │   ├── allotment/
│   │   └── notification/
│   │
│   ├── queues/
│   ├── workers/
│   ├── routes/
│   ├── schemas/
│   ├── types/
│   └── utils/
│
├── tests/
├── migrations/
├── scripts/
│
├── Dockerfile
├── docker-compose.yml
├── docker-compose.production.yml
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

---

# 63. DEVELOPMENT QUALITY BAR

Do not generate toy code.

Every implementation must be:

* typed
* modular
* testable
* observable
* secure
* idempotent
* rate-limited
* retry-safe
* production deployable

Avoid:

```text
any
```

unless genuinely unavoidable.

Avoid:

```text
console.log()
```

Use structured logging.

Avoid giant files.

Avoid circular dependencies.

Avoid business logic inside route handlers.

Avoid hard-coded API credentials.

Avoid provider-specific logic leaking into domain services.

---

# 64. DELIVERABLES

Produce:

1. Complete architecture
2. Database schema
3. Database migrations
4. TypeScript source
5. Provider interfaces
6. IPO providers
7. Allotment provider framework
8. Telegram bot
9. Pushover integration
10. BullMQ workers
11. Redis integration
12. PAN security module
13. REST API
14. Docker setup
15. Environment configuration
16. Unit tests
17. Integration tests
18. Provider contract tests
19. README
20. Deployment guide
21. Security documentation
22. API documentation
23. Troubleshooting guide
24. Example Telegram conversations
25. Monitoring/observability setup

---

# 65. MOST IMPORTANT RULE

Never fabricate an IPO allotment result.

The system must distinguish:

```text
ALLOTTED
NOT_ALLOTTED
PENDING
NOT_FOUND
CHECK_FAILED
PROVIDER_UNAVAILABLE
CAPTCHA_REQUIRED
```

If verification fails, tell the user that verification failed.

Never convert failure into "not allotted".

---

# 66. FINAL ACCEPTANCE TEST

The finished application must successfully demonstrate:

### Test 1

```text
/check validPAN
```

Returns a complete normalized result.

### Test 2

```text
/check invalidPAN
```

Returns validation error.

### Test 3

Bulk upload 100 PANs.

System processes asynchronously without blocking Telegram.

### Test 4

Provider timeout.

System retries.

### Test 5

Provider rate limit.

System backs off.

### Test 6

PAN result changes:

```text
PENDING → ALLOTTED
```

Telegram + Pushover notification is sent once.

### Test 7

Same result checked again.

No duplicate notification.

### Test 8

Provider unavailable.

System reports:

```text
CHECK_FAILED
```

and never:

```text
NOT_ALLOTTED
```

### Test 9

Restart worker during bulk processing.

Jobs resume safely without duplicate processing.

### Test 10

Inspect logs.

No plaintext PAN appears anywhere.

### Test 11

Delete PAN profile.

Encrypted PAN and associated sensitive data are deleted according to retention policy.

### Test 12

Run production Docker deployment.

All services pass health checks.

---

# 67. CODING INSTRUCTION

Start by generating:

1. architecture decision record
2. database ERD
3. module boundaries
4. environment variables
5. API contracts
6. provider interfaces
7. database schema
8. implementation roadmap

Then implement the project incrementally.

Do NOT skip architecture and immediately dump hundreds of lines of code.

Whenever an external provider does not have a legitimate public API, explicitly document that limitation and implement the provider behind an adapter interface so the source can be added/replaced later.

The final system must be capable of operating as a reliable production-grade IPO monitoring backend rather than a fragile scraping script.
