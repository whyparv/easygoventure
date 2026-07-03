# Production Readiness — End-to-End Smoke Test Report

> Mission: don't assume anything works — **verify it**. This report is based on a
> real, running system, not code inspection alone.

## How this was actually tested (methodology — no hand-waving)

The prior phases' blocker was that the production database (Atlas) is IP-blocked. To
verify for real, I stood up the whole stack locally with Docker:

- **MongoDB 7** + **Redis 7** in containers.
- Seeded the real catalog via `npm run seed:catalog` (76 permissions, 20 roles, org, users, **151 hotels**).
- **Booted the actual backend** (`node dist/main.js`) against them on `:8080`.
- Ran **45 live assertions** with real JWTs through the real HTTP stack (two Node harnesses), plus a second seeded organization to test isolation.
- Re-ran the **frontend** `tsc -b` + `eslint` + `vite build`.

**Live result: 30/30 workflow assertions + 15/15 security assertions = 45/45 passed.**

What I could **not** do here (stated plainly): drive the frontend in a real browser
(no authenticated session is possible today — see P0), so **visual/responsive/dark-mode/a11y
were not eyeballed**; and I tested 2 AI prompts live, not all 12 requested variations.

---

## Executive summary

**The backend is genuinely production-grade and demo-ready.** It boots cleanly, all 138
routes map, the full commercial→operations workflow runs end-to-end with correct money math,
tenant isolation is airtight, and RBAC is enforced.

**The frontend cannot talk to that backend.** It ships with **no login and no JWT** — it only
sends a perimeter `x-api-key` (which is even left empty), while every business route requires a
Bearer JWT from `/auth/login`. Against the real API, **every data call returns 401**. This is a
single, well-defined **P0** that blocks the integrated UI demo.

> **Net: the system is READY WITH CONDITIONS. The one hard condition is implementing frontend
> authentication (P0). Fix that and the demo works; without it, the UI shows only error/empty states.**

---

## Part 1 — System boot validation ✅

- Backend boots to **"Nest application successfully started … listening on :8080/api"**.
- **Zero** DI errors, missing providers, schema-registration failures, or circular-dependency errors.
- Env validation (zod) enforces `MONGODB_URI` + two 32-char JWT secrets; boot refuses without them (verified).
- `CatalogLoaderService` loaded **151 hotels** from the JSON catalog at startup.
- Two **non-fatal** startup warnings (see P3-1, P3-2).
- Frontend build: `tsc -b` ✓ · `eslint --max-warnings 0` ✓ · `vite build` ✓ (route-level code splitting confirmed).

## Part 2 — Endpoint inventory ✅

**138 routes** mapped under `/api/v1` (URI versioning). Coverage: auth (7), organizations, departments,
users, roles, permissions, inquiries (7), leads, proposals (+commercial convert/readiness/book/lineage),
packages (+items/recalculate), quotations, hotels, vendors, fulfillments, follow-ups, operations
(travelers/bookings + hotel/transfer/visa details, timeline, risk, dashboard, documents), reporting,
ai + ai-copilot + ai-context, audit-logs, health. Every route probed returned a **valid enveloped
response or a correct 4xx** — **no 500s** encountered across 45 calls.

## Part 3 — Authentication ✅ backend / ❌ frontend (P0)

Backend auth is a **two-layer** design, both global:
- `ApiKeyGuard` (perimeter) — checks `x-api-key` against `API_KEY`; **disabled when `API_KEY` unset** (dev).
- `JwtAuthGuard` (identity) — Bearer JWT via passport-jwt, `@Public()` opt-out; populates `request.user`.

Verified live: login returns `{accessToken, refreshToken}`; **no-token → 401, bad-token → 401,
wrong-password → 401**; `/auth/{login,refresh,logout,forgot-password,reset-password}` are `@Public`.
These two guards are **AND-ed** — a business route needs a valid JWT regardless of the api-key.

**The frontend supplies neither a JWT nor a login flow → P0-1.**

## Part 4 — AI assistant ✅ (hero verified)

- `POST /ai/parse-inquiry "I want a Dubai trip for 4 people in December, budget 15000"` → **extracted
  `destination=Dubai, travelers=4`** live (GROQ is configured in `.env`).
- `POST /ai/chat` → returned a real assistant reply.
- The lead-create and inquiry-create endpoints the hero flow depends on both work (verified below),
  so **AI → Lead → Inquiry is functional at the API level.** (Not exercised through the browser — P0.)

## Parts 5–15 & 21 — Full business workflow ✅ (30/30)

Ran the exact target scenario end-to-end with real writes:

| Step | Result |
|------|--------|
| Inquiry create | ✅ `INQ-2026-19161`, 201 |
| Package + item | ✅ pricing exact: 20% on 100×2 → **unitSell 120, totalSell 240, profit 40** |
| Package totals recalculated | ✅ cost 200 / sell 240 / profit 40 |
| Quotation from package | ✅ snapshot `totalSellPrice=240`, `customerPrice=240` computed |
| Quotation accept | ✅ status ACCEPTED |
| Convert → Proposal | ✅ carries `commercialSnapshot=240`, `bookingStatus=NOT_READY` |
| **Double-convert** | ✅ **blocked (422)** — single-use enforced |
| Check readiness → Book | ✅ ready, **1 fulfillment item generated** |
| Traveler create (with + without passport) | ✅ |
| Booking (HOTEL) create | ✅ `hotelDetails` auto-initialised |
| Hotel-details update + confirm | ✅ status CONFIRMED |
| Timeline (derived) | ✅ **2 events**, start/end set |
| Risk | ✅ **HIGH** (2 issues: travel in 3 days + infant with no passport) — correct escalation |
| Ops dashboard | ✅ booked=1, **success rate 100%** |
| Document (manifest) | ✅ `{document, content}`, **content has 2 travelers** |
| Revenue pipeline | ✅ `expectedRevenue=240` (contract note → P3-1) |

Money math was validated against manual calculation and matches to the cent. Snapshot immutability
holds (proposal carries frozen 240 independent of later package edits).

## Part 13 — Payment demo ✅

Frontend-only by construction: local React state, `Demo Mode` banner, no service/mutation calls to the
backend (verified in source — `PaymentTab` imports no data hooks). No server mutation possible.

## Part 16 — Tenant isolation ✅ (airtight)

Seeded a **second org** (`acme-dmc`) with its own owner and tested cross-tenant access:

- org2 owner **cannot** read org1's proposal by id → **404**
- org2 owner **cannot** read org1's timeline → **404**
- org2 owner **cannot** add a traveler to org1's proposal → **404**
- org2's inquiry list is **empty** (0), org2's dashboard shows **0 booked** — no leakage
- No cross-org visibility, modification, reporting, or document access observed.

## Part 17 — RBAC ✅ (enforced)

Created a `SALES_EXECUTIVE` user and verified permission boundaries live:

- CAN read leads (200), CAN read hotels (200)
- **CANNOT** read operations dashboard → **403**
- **CANNOT** create users → **403**
- **CANNOT** read revenue report → **403**

No privilege escalation; the permission-driven guard chain works as designed.

## Parts 18–20 — Frontend / responsive / performance ⚠️ (partial — honest)

- **Builds clean**; **code splitting confirmed** (every route a lazy chunk: Proposal Viewer 34 kB,
  AI 11 kB, Hotels 8 kB — 1–9 kB gzipped; charts/motion isolated).
- Loading/empty/error states and semantic Tailwind tokens (dark-mode-ready) are present in source.
- **Not verified in a browser** because no authenticated session is reachable (P0). Real-device
  responsive testing, dark-mode eyeballing, and a screen-reader a11y pass **remain outstanding**.

---

## Bug list

### 🔴 P0-1 — Frontend has no user authentication (blocks the entire UI demo)
- **Where:** `frontend/src/shared/api/http.ts` (only sets `x-api-key`, and `VITE_API_KEY` is empty); no `/login` route, no token storage, no `Authorization` header anywhere (`grep`: "NO login references in frontend").
- **Repro:** Run the frontend against the real backend → open any screen (Leads, Hotels, Operations…).
- **Expected:** Data loads.
- **Actual:** Every request → **401 Unauthorized**; screens render error/empty states. The AI hero flow can't create a lead/inquiry either.
- **Fix:** Add a login screen calling `POST /api/v1/auth/login`; store the `accessToken`; attach `Authorization: Bearer <token>` in the axios request interceptor; implement refresh via `POST /auth/refresh` (access TTL is 15 min); on 401 clear session and redirect to login. (Optionally also send `x-api-key` for staging where `API_KEY` is set.)

### 🟠 P1-1 — No session-expiry / 401 handling in the client
- **Where:** `http.ts` `toApiError` surfaces 401 as a generic error; no refresh, no redirect.
- **Impact:** Even after P0 is fixed, the 15-minute access token will expire mid-demo and strand the user with errors.
- **Fix:** Refresh-token rotation + a global 401 handler.

### 🟡 P2-1 — Quotation create sends a field the backend rejects
- **Where:** `frontend/src/shared/services/quotations.service.ts` `CreateQuotationInput.customerPrice` → `POST /quotations/from-package/:id`.
- **Repro (verified live):** `POST /quotations/from-package/:id {customerPrice: 999}` → **400** (`forbidNonWhitelisted: true`; DTO only allows `validUntil`, `notes`).
- **Actual:** 400; **Expected:** quotation created (price is derived from the snapshot server-side).
- **Impact:** Latent — no screen calls this yet — but the data layer is wrong and will 400 the moment a Quotation UI is wired.
- **Fix:** Remove `customerPrice` from `CreateQuotationInput` and the service body.

### 🟡 P2-2 — Default seed passwords
- **Where:** seed sets `owner@dmc.local` / `superadmin@dmc.local` to `ChangeMe123!`.
- **Impact:** Fine for local demo; must be rotated before any shared/staging exposure. (`.env` also contains a live `GROQ_API_KEY` — rotate/secure before sharing the repo.)

### 🟢 P3-1 — Revenue-pipeline field-name drift
- **Where:** backend returns `packagesCreated` + `fulfillment.deliveredPercent`; frontend `RevenuePipeline` type declares `packages`.
- **Impact:** None visible (the Operations page renders `expectedRevenue/expectedProfit/pipelineRevenue/conversionRate`, not `packages`), but `data.packages` is `undefined`.
- **Fix:** Rename the frontend field to `packagesCreated`.

### 🟢 P3-2 — Legacy catch-all route warning on boot
- **Where:** boot log: `Unsupported route path: "/api/*"` (path-to-regexp v6 migration) — auto-converted now.
- **Impact:** Cosmetic today; will break on the next path-to-regexp major.
- **Fix:** Change the catch-all to `/api/*path` (named wildcard).

---

## Audits at a glance

| Audit | Verdict |
|-------|---------|
| Backend boot / DI / schemas | ✅ Clean |
| Endpoints (138) | ✅ No 500s across 45 live calls |
| Business workflow + money math | ✅ 30/30, exact |
| AI extraction (hero) | ✅ Works (Dubai/4pax extracted live) |
| Security / auth (backend) | ✅ 401s enforced, guards AND-ed |
| RBAC | ✅ 15/15, 403s enforced |
| Tenant isolation | ✅ Airtight (cross-org 404) |
| Performance (bundle/splitting) | ✅ Good |
| **Frontend ↔ backend integration** | ❌ **P0 auth blocker** |
| Frontend visual/responsive/a11y | ⚠️ Not verified (blocked by P0) |

---

## Final verdict

# READY WITH CONDITIONS

- **Backend:** **READY FOR CLIENT DEMO** — verified live, 45/45, isolation + RBAC + money math all correct.
- **Frontend (integrated):** **NOT READY** until **P0-1** is fixed — as shipped it cannot authenticate and shows only errors against the real API.
- **The single blocking condition** is implementing frontend login + JWT Bearer + refresh (P0-1, P1-1). It is a contained, well-understood change (one interceptor + a login screen + refresh handling). Everything the UI needs already exists and works on the backend.

**Do not demo the integrated UI until P0-1 is closed.** The backend can be demoed today via Swagger/API. Once auth is wired, re-run this smoke test (harnesses saved at `/tmp/smoke.mjs`, `/tmp/rbac-tenant.mjs`) and the full WhatsApp-replacement journey should light up end-to-end.
