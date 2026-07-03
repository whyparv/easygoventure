# Phase 3 — Operations Engine Report

> Transforms the platform from a **commercial** system into an **end-to-end DMC
> operations platform**. Once a proposal is booked, the system now manages
> real-world travel execution: **who is travelling, what is booked, what is
> confirmed, what is pending, what is at risk, and what is complete.**

**Build status:** `nest build` ✓ · `eslint --max-warnings 0` ✓ · `tsc --noEmit` ✓ (0 errors)
**Load check:** compiled `app.module` + `operations.module` import cleanly (DI/decorator wiring valid).

---

## Lifecycle extension

```
Sales:  Lead → Inquiry → Package → Quotation → Accepted → Proposal → Booking Readiness → Fulfillment
                                                                                              │
Operations (Phase 3):                                                                         ▼
   Travelers ── Supplier Bookings (Hotel · Transfer · Visa · Activity · Flight)
        │              │
        │              ├─ Hotel ops (check-in/out, room-nights)
        │              ├─ Transfer ops (pickup/drop, driver, vehicle)
        │              └─ Visa ops (documents → submitted → processing → approved/rejected)
        ▼              ▼
   Travel Timeline (derived) ── Operations Dashboard ── Operational Risk ── Documents ── AI Ops Context
                                                                                              │
                                                                          Trip Delivery → Completion
```

Everything lives in a new **`modules/operations`** module. Sales/commercial behavior is
untouched — Phase 3 is purely additive and reads the frozen proposal snapshot from Phase 2.1.

---

## Task 1 — Traveler domain

`Traveler` (`travelers`): `organizationId`, `proposalId`, `firstName`, `lastName`, `gender`,
`dateOfBirth`, `nationality`, `passportNumber`, `passportExpiry`, `email`, `phone`, `notes`,
`status` (`ACTIVE` / `CANCELLED`). Indexes on `organizationId`, `proposalId`, `passportNumber`
(+ compound `{organizationId, proposalId}`). A proposal may carry **many** travelers; each stays
linked to the proposal (and thus its frozen commercial snapshot) via `proposalId`. **Soft-delete
only** — cancelled/removed travelers are retained for manifest & audit history.

## Task 2 — Booking domain

`Booking` (`operations_bookings`) = one **supplier confirmation**: `organizationId`, `proposalId`,
`fulfillmentItemId` (optional link to the Phase 2.1 fulfillment line), `vendorId`, `bookingType`
(`HOTEL`/`ACTIVITY`/`TRANSFER`/`VISA`/`FLIGHT`), `bookingReference`, `supplierReference`,
`confirmationDate`, `travelDate`, `notes`, `status` (`PENDING`/`REQUESTED`/`CONFIRMED`/`FAILED`/
`CANCELLED`). Indexes on `organizationId`, `proposalId`, `vendorId`, `status`, `travelDate`
(+ compound `{organizationId, bookingType, status}`).

## Tasks 3–5 — Hotel / Transfer / Visa operations

Type-specific operational data is **embedded** on the booking matching `bookingType` (one booking =
one supplier line; the sub-document carries the specifics). This keeps every operational record
tenant-safe by construction — it lives inside the tenant-scoped parent booking.

- **`HotelBookingDetails`** — `hotelName`, `checkInDate`, `checkOutDate`, `roomCount`, `roomType`,
  `confirmationNumber`, `specialRequests`, `status` (`PENDING`/`CONFIRMED`/`CHECKED_IN`/
  `CHECKED_OUT`). **Derived metrics `nights` & `roomNights`** are computed (never stored) via
  `hotelDetailMetrics()` and surfaced in the timeline & documents.
- **`TransferBookingDetails`** — `pickupLocation`, `dropLocation`, `pickupTime`, `driverName`,
  `driverPhone`, `vehicleType`, `vehicleNumber`, `status` (`PENDING`/`CONFIRMED`/`COMPLETED`).
- **`VisaProcessing`** — `passportReceivedAt`, `applicationSubmittedAt`, `processingStartedAt`,
  `approvedAt`, `rejectedAt`, `documents[]`, `notes`, `status` (`PENDING_DOCUMENTS`/`SUBMITTED`/
  `PROCESSING`/`APPROVED`/`REJECTED`). Status transitions auto-stamp the matching milestone
  timestamp and emit `visa.submitted` / `visa.approved` audit events.

## Task 6 — Travel timeline engine

`TravelTimelineService.forProposal()` derives a **chronological itinerary** from all of a proposal's
bookings + visa milestones (hotel check-in/out with room-nights, transfer pickups, activities,
flights, and each visa milestone), sorted by date with undated events sinking to the end; returns
`{ start, end, travelerCount, events[] }`. **Always derived, never manually maintained.** Exposed at
**`GET /proposals/:id/timeline`**.

## Task 7 — Operations dashboard

`OperationsDashboardService.getDashboard()` returns tenant-scoped metrics: **upcoming departures**
(bookings travelling in the next 7 days), **trips in progress** / **booked** / **completed** (by
proposal `bookingStatus`), **pending hotel confirmations / transfers / activities / visas**,
**travelers in transit** (active travelers on in-progress proposals), and **booking success rate**
(confirmed ÷ non-cancelled). Super-admins get a platform roll-up; everyone else is org-scoped.
Exposed at **`GET /operations/dashboard`**.

## Task 8 — Document generation

`DocumentGenerationService` assembles **Travel Voucher, Final Itinerary, Traveler Manifest, Booking
Summary, Operational Brief** from the **proposal snapshot + traveler data + booking data**.
**No PDF is stored in MongoDB** — we persist a `GeneratedDocument` **metadata** record only
(provenance: who/when/type/title, a **SHA-256 content checksum**, and an optional external
`storageRef`) and return the assembled content for downstream rendering. `POST
/proposals/:id/documents/:type`, `GET /proposals/:id/documents`.

## Task 9 — AI operations context

`OperationsContextService.forProposal()` (`GET /ai-context/operations/:id`, requires `ai.use` +
`operations.read`) is a **read-only** assembly of the operational picture: traveler summary, booking
status, timeline, operational risk, pending actions and upcoming departures, returned as
`{ type: 'operations', summary, data }`. **No autonomous booking, no confirmation, no traveler
modification** — human approval remains mandatory; existing AI behavior is unchanged.

## Task 10 — Operational risk engine

`OperationalRiskService.assess()` detects: **missing traveler passports**, **unconfirmed hotels**,
**unconfirmed transfers**, **pending visas near departure**, **missing booking references** (on
confirmed bookings), and **travel within 72 hours without operational readiness**. Severity
escalates as the earliest departure approaches (visas weighted with the longest lead time); returns
an overall **`LOW` / `MEDIUM` / `HIGH`** per proposal with the driving issues. `GET
/proposals/:id/risk`.

## Task 11 — Audit coverage

All via the global tenant-scoped `AuditService`: `traveler.created`, `traveler.updated`,
`booking.created`, `booking.confirmed`, `booking.failed`, `booking.updated`, `visa.submitted`,
`visa.approved`, `timeline.generated`, `document.generated`, `risk.assessed`, `dashboard.generated`.

## Task 12 — Tenant safety

- **Every new repository** — `TravelersRepository`, `BookingsRepository`,
  `GeneratedDocumentsRepository` — **extends `TenantScopedRepository`** (Phase 1.6): only scoped
  reads/updates/soft-deletes are exposed, and every bespoke finder embeds the tenant fragment.
- Services derive scope from the shared `tenantFilter(user)` / `requireOrganizationId(user)`
  helpers — **no unscoped queries, no raw model access**. Cross-record reads (proposal validation,
  traveler-in-transit counts) go through scoped repository methods only.
- Every write stamps `organizationId` from the actor; embedded operational details inherit tenant
  safety from their scoped parent booking. Super-admins get a platform view; non-super principals
  without an org are rejected.

---

## Success criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Travelers managed | ✅ `Traveler` domain + CRUD, soft-delete |
| 2 | Supplier bookings tracked | ✅ `Booking` with 5 types + lifecycle |
| 3 | Hotel operations tracked | ✅ `HotelBookingDetails` (+ nights/room-nights) |
| 4 | Transfer operations tracked | ✅ `TransferBookingDetails` |
| 5 | Visa processing tracked | ✅ `VisaProcessing` (milestones) |
| 6 | Travel timeline generated | ✅ derived `GET /proposals/:id/timeline` |
| 7 | Operational dashboards | ✅ tenant-scoped `GET /operations/dashboard` |
| 8 | Travel documents generated | ✅ 5 types, metadata-only persistence |
| 9 | AI operations context | ✅ read-only `GET /ai-context/operations/:id` |
| 10 | Risk engine | ✅ `LOW/MEDIUM/HIGH` per proposal |
| 11 | Audit coverage | ✅ all 12 actions audited |
| 12 | Build / lint / TypeScript | ✅ `nest build`, `eslint --max-warnings 0`, `tsc --noEmit` |

---

## API surface (new)

```
POST   /proposals/:proposalId/travelers        GET /proposals/:proposalId/travelers
GET    /travelers/:id     PATCH /travelers/:id     DELETE /travelers/:id
POST   /proposals/:proposalId/bookings         GET /proposals/:proposalId/bookings
GET    /bookings/:id      PATCH /bookings/:id
POST   /bookings/:id/confirm | /fail | /cancel
PATCH  /bookings/:id/hotel-details | /transfer-details | /visa-processing
GET    /proposals/:id/timeline                 GET /proposals/:id/risk
GET    /operations/dashboard
POST   /proposals/:id/documents/:type          GET /proposals/:id/documents
GET    /ai-context/operations/:id
```

## Files

**New — `modules/operations/`:** `schemas/traveler.schema.ts`, `schemas/booking.schema.ts`,
`schemas/hotel-booking-details.schema.ts`, `schemas/transfer-booking-details.schema.ts`,
`schemas/visa-processing.schema.ts`, `schemas/generated-document.schema.ts`;
`travelers.repository.ts`, `bookings.repository.ts`, `generated-documents.repository.ts`;
`travelers.service.ts`, `bookings.service.ts`, `travel-timeline.service.ts`,
`operations-dashboard.service.ts`, `document-generation.service.ts`, `operational-risk.service.ts`,
`operations-context.service.ts`; `travelers.controller.ts`, `bookings.controller.ts`,
`operations.controller.ts`; `dto/traveler.dto.ts`, `dto/booking.dto.ts`, `dto/booking-details.dto.ts`;
`operations.module.ts`.

**Changed:** `auth/rbac/permissions.ts` (+10 permissions), `auth/rbac/system-roles.ts` (OPS_CORE
read surface + OPS_EXECUTION bundle granted to operations/visa/hotel/transfer roles; sales-manager
read visibility), `proposals/proposals.repository.ts` (scoped `countScoped`/`findIdsScoped`),
`proposals/proposals.module.ts` (export `ProposalsRepository`), `ai-context/*` (operations context
endpoint), `app.module.ts` (wire `OperationsModule`).

## Operational note

The 10 new permissions and refreshed role permission-sets require **`npm run seed:catalog`** to sync
into the database (still blocked by the earlier Atlas IP-access issue — add this environment's IP to
Atlas Network Access, then re-run; idempotent). The new operational **collections**
(`travelers`, `operations_bookings`, `generated_documents`) are created on first write and need no
migration. No pricing/commercial or existing-AI behavior changed.
