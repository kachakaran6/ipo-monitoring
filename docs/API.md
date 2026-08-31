# REST API Documentation (v1)

Base URL: `/api/v1`

All responses follow standard JSON formatting:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2026-08-31T14:56:00.000Z"
}
```

---

## 1. System & Health

### `GET /health`
Liveness probe.
- **Response**: `200 OK`
```json
{
  "status": "ok",
  "uptime": 124.5,
  "timestamp": "2026-08-31T14:56:00.000Z"
}
```

### `GET /ready`
Readiness probe testing database, Redis, and queues.
- **Response**: `200 OK` or `503 Service Unavailable`
```json
{
  "status": "ready",
  "checks": {
    "database": "up",
    "redis": "up",
    "queues": "up"
  }
}
```

### `GET /metrics`
Prometheus metric scrape endpoint.

---

## 2. IPO Endpoints

### `GET /api/v1/ipos`
Query active, upcoming, and closed IPOs.
- **Query Parameters**:
  - `status` (optional): `OPEN` | `UPCOMING` | `CLOSED` | `ALLOTTED`
  - `type` (optional): `MAINBOARD` | `SME`
  - `page` (default: 1): integer
  - `limit` (default: 20): integer
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "ipos": [
      {
        "id": "7b8d1b22-83b6-4b2a-a9f1-a1e4c9f13110",
        "symbol": "TECHCORP",
        "companyName": "TechCorp Innovations Limited",
        "slug": "techcorp-innovations",
        "exchange": "NSE",
        "issueType": "BOOK_BUILT",
        "mainboardOrSme": "MAINBOARD",
        "status": "CLOSED",
        "openDate": "2026-08-25T04:30:00.000Z",
        "closeDate": "2026-08-28T11:30:00.000Z",
        "allotmentDate": "2026-08-31T11:30:00.000Z",
        "listingDate": "2026-09-03T04:30:00.000Z",
        "priceBandMin": "320.00",
        "priceBandMax": "340.00",
        "issuePrice": "340.00",
        "lotSize": 44,
        "registrar": "MUFG_INTIME",
        "registrarUrl": "https://linkintime.co.in",
        "gmp": "65.00",
        "gmpPercentage": "19.12"
      }
    ],
    "total": 1,
    "page": 1,
    "totalPages": 1
  }
}
```

### `GET /api/v1/ipos/:id`
Fetch complete details of a specific IPO.

### `GET /api/v1/ipos/:id/subscription`
Fetch the latest subscription breakdown (QIB, NII, Retail, Employee, Total).

---

## 3. PAN Management & Watchlist

### `POST /api/v1/pans`
Register a PAN profile for tracking.
- **Request Body**:
```json
{
  "pan": "ABCDE1234F",
  "label": "Primary Account"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "e932b711-2e6f-4099-a9a3-5c742398b11a",
    "maskedPan": "XXXXX1234F",
    "label": "Primary Account",
    "isActive": true,
    "createdAt": "2026-08-31T14:56:00.000Z"
  }
}
```

### `GET /api/v1/pans`
List all registered PAN profiles (masked).

### `DELETE /api/v1/pans/:id`
Remove a registered PAN profile and delete associated encryption keys and pending checks.

### `GET /api/v1/pans/:id/history`
Get historical allotment statistics and previous IPO applications for this PAN profile.

---

## 4. Allotment Verification

### `POST /api/v1/check`
Initiate single PAN allotment check across all active/recent IPOs or a specific IPO.
- **Request Body**:
```json
{
  "pan": "ABCDE1234F",
  "ipoId": "7b8d1b22-83b6-4b2a-a9f1-a1e4c9f13110", // optional
  "async": false // if true, returns job_id immediately
}
```
- **Response `200 OK` (Synchronous)**:
```json
{
  "success": true,
  "data": {
    "maskedPan": "XXXXX1234F",
    "totalIposChecked": 1,
    "allottedCount": 1,
    "notAllottedCount": 0,
    "pendingCount": 0,
    "results": [
      {
        "ipoId": "7b8d1b22-83b6-4b2a-a9f1-a1e4c9f13110",
        "companyName": "TechCorp Innovations Limited",
        "status": "ALLOTTED",
        "appliedQuantity": 44,
        "allottedQuantity": 44,
        "issuePrice": "340.00",
        "amountAllotted": "14960.00",
        "registrar": "MUFG_INTIME",
        "checkedAt": "2026-08-31T14:56:00.000Z",
        "confidence": "HIGH",
        "source": "REGISTRAR"
      }
    ]
  }
}
```

### `POST /api/v1/check/bulk`
Submit a batch of PANs (up to 1,000) for asynchronous background processing.
- **Request Body**:
```json
{
  "pans": [
    { "pan": "ABCDE1234F", "label": "Account 1" },
    { "pan": "FGHIJ5678K", "label": "Account 2" }
  ]
}
```
- **Response `202 Accepted`**:
```json
{
  "success": true,
  "data": {
    "jobId": "BULK-8F92A",
    "totalPans": 2,
    "uniquePans": 2,
    "status": "QUEUED",
    "estimatedCompletionSeconds": 15
  }
}
```

### `GET /api/v1/jobs/:id`
Check the execution status and aggregated metrics of a bulk check job.

---

## 5. Provider Telemetry & Admin

### `GET /api/v1/providers/health`
Return live latency, failure counts, and health status for all external providers (MUFG Intime, KFintech, Bigshare, NSE, BSE, Upstox).
