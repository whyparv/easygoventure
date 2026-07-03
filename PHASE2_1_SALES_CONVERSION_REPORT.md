# Phase 2.1 — Sales Conversion Engine Report

> Closes the loop: commercial acceptance becomes operational execution.
> **Quotation → Accepted → Proposal (frozen commercial snapshot) → Booking → Fulfillment.**
> The accepted commercial terms are contractual — no pricing recalculation after acceptance.

**Build status:** `nest build` ✓ · `eslint --max-warnings 0` ✓ · `tsc --noEmit` ✓ (0 errors)

---

## Flow

```
Lead ─► Inquiry ─► Package ─► Quotation ──ACCEPTED (acceptedBy, acceptedAt)──┐
                                                                             │  convertAcceptedQuotation()
                                                                             ▼  (copies frozen snapshot, NOT live package)
                                              Proposal (status: ACCEPTED, commercialSnapshot, lineage)
                                                 │ check-readiness ─► READY_FOR_BOOKING
                                                 │ book ─► BOOKED  ──generates──► FulfillmentItem[] (per snapshot item)
                                                 ▼ item status PENDING→CONFIRMED→DELIVERED
                                              bookingStatus derived: FULFILLING ─► COMPLETED
```

---

## Task 1 — Quotation acceptance lock

- Added `acceptedBy` (+ existing `acceptedAt`) and `convertedProposalId` to the quotation.
  `accept()` now records the accepting user.
- **Immutability is architectural, not policed:** a quotation embeds a frozen `PackageSnapshot`
  (Phase 2) and **no code path ever writes to `quotation.snapshot`** (verified). Therefore later
  package edits, vendor-rate changes, hotel/service edits, or expiry cannot alter an accepted
  quotation's commercial terms. ACCEPTED is a terminal sales state (no outgoing transition), and
  conversion is single-use (`convertedProposalId` guard).

## Task 2 — `QuotationConversionService.convertAcceptedQuotation()`

- Only an **ACCEPTED** quotation may convert; a quotation converts **exactly once**
  (`ALREADY_CONVERTED` guard via `convertedProposalId`).
- The proposal is built **from the quotation's frozen snapshot, not the live package** — so the
  proposal preserves the accepted commercial terms even if the package/vendors/rates change later.
- Sets the quotation's `convertedProposalId`; audits `quotation.converted` + `proposal.created`.

## Task 3 & 4 — Proposal snapshot + full lineage

The Proposal domain was enhanced **additively** (legacy lead-based proposals are unchanged;
`leadId` is now optional). New fields:

- **Snapshot:** `commercialSnapshot` (embedded `PackageSnapshot` → `PackageItemSnapshot[]` →
  `VendorRateSnapshot`), `acceptedPrice`, `acceptedDate`. The proposal survives quotation expiry,
  vendor changes and package archival — it carries its own frozen commercial terms.
- **Lineage:** `leadId`, `inquiryId`, `packageId`, `quotationId`, `quotationNumber`,
  `quotationVersion` — the full sales chain is reconstructable; `GET /proposals/:id/lineage`
  returns `{ lead, inquiry, package, quotation, proposal }`. The snapshot schema was moved to
  `common/commercial/commercial-snapshot.schema.ts` and is shared by Quotation and Proposal.

## Task 5 — Booking readiness

- `BookingReadinessService.validate(proposal)` (pure) checks: snapshot present, non-empty items,
  valid traveler count, valid travel dates, accepted price present; reports `{ ready, issues[],
  checks }`. Vendor/hotel references are validated from the **frozen snapshot** (as at acceptance).
- `POST /proposals/:id/check-readiness` advances `NOT_READY → READY_FOR_BOOKING` when ready
  (audits `proposal.ready`). Operational lifecycle uses a dedicated `bookingStatus`
  (`NOT_READY / READY_FOR_BOOKING / BOOKED / FULFILLING / COMPLETED`) — separate from the sales
  `status`, so nothing in the legacy proposal flow changes.

## Task 6 — Fulfillment integration

- New tenant-scoped `FulfillmentItem` (collection `fulfillment_items`), one per snapshot item,
  carrying the frozen type/description/quantity + vendor reference; status
  `PENDING / CONFIRMED / DELIVERED / CANCELLED`.
- `POST /proposals/:id/book` (requires `READY_FOR_BOOKING`) generates the fulfillment items and
  sets `BOOKED` (idempotent — re-booking rejected once items exist).
- `PATCH /proposals/:id/fulfillment-items/:itemId` updates an item and **derives** the proposal's
  `bookingStatus`: any CONFIRMED/DELIVERED → `FULFILLING`; all active items DELIVERED →
  `COMPLETED`. Progress is derived, never entered.

## Task 7 — Revenue pipeline reporting

`RevenuePipelineService` (`GET /revenue-pipeline`, permission `report.read`) returns a
**tenant-scoped** roll-up: inquiries, packages created, proposals, quotations
`{ total, sent, accepted, rejected }`, **conversion rate** (accepted/sent), **expected revenue** &
**expected profit** (summed from ACCEPTED quotation snapshots), open **pipeline revenue** (SENT),
fulfillment progress (item status counts + delivered %), and proposals by booking status.
Super-admins get a platform-wide roll-up; everyone else is scoped to their organization. All 12
aggregation queries include the tenant scope.

## Task 8 — AI sales context (read-only)

`SalesContextProvider` (`GET /ai-context/proposal/:id`, permission `ai.use` + `proposal.read`)
assembles quotation acceptance context, proposal readiness (read-only evaluation — no status
change), fulfillment progress and commercial lineage into `{ type, summary, data }` for future AI
workflows. **No autonomous conversion, no autonomous acceptance, no writes** — human approval
remains mandatory; existing AI behavior is unchanged.

## Task 9 — Audit coverage

`quotation.accepted`, `quotation.converted`, `proposal.created`, `proposal.ready`,
`proposal.booked`, `proposal.completed`, `fulfillment.created`, `fulfillment.item.updated`, and
`report.revenue_pipeline` are all recorded via the global `AuditService` (tenant-scoped,
fire-and-forget).

## Task 10 — Tenant safety

- New `FulfillmentItemsRepository` extends `TenantScopedRepository` (query-level scoping).
- The reporting repository is read-only aggregation; **every one of its 12 queries embeds the
  tenant scope** (`live(scope)`), and the service derives that scope via the shared `tenantFilter`.
- All proposal reads/writes in the commercial flow use the tenant scope (`findById(id, scope)`,
  `update(id, data, scope)`). No unscoped queries, no raw model access outside repositories.

---

## Success criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Accepted quotation becomes immutable | ✅ frozen snapshot, never written after creation |
| 2 | Accepted quotation converts to proposal | ✅ `convertAcceptedQuotation` (ACCEPTED-only, single-use) |
| 3 | Proposal stores commercial snapshot | ✅ `commercialSnapshot` + accepted price/date |
| 4 | Full lineage exists | ✅ lead/inquiry/package/quotation/proposal + `/lineage` |
| 5 | Fulfillment derives from proposal | ✅ FulfillmentItems generated on book; progress derived |
| 6 | Revenue metrics exist | ✅ `/revenue-pipeline` (tenant-scoped) |
| 7 | AI sales context exists | ✅ `/ai-context/proposal/:id` (read-only) |
| 8 | Audit coverage exists | ✅ all transitions audited |
| 9 | Tenant isolation preserved | ✅ new repo on base; all queries scoped |
| 10 | Build / lint / TypeScript pass | ✅ `nest build`, `eslint --max-warnings 0`, `tsc --noEmit` |

---

## Files & wiring

**New:** `common/commercial/commercial-snapshot.schema.ts`; proposals module —
`schemas/fulfillment-item.schema.ts`, `fulfillment-items.repository.ts`,
`quotation-conversion.service.ts`, `booking-readiness.service.ts`,
`commercial-proposals.service.ts`, `commercial-proposals.controller.ts`,
`dto/commercial-proposal.dto.ts`; `reporting/*` (service, repo, controller, module);
`ai-context/sales-context.service.ts`.

**Enhanced:** `quotations/schemas/quotation.schema.ts` (+`acceptedBy`, `convertedProposalId`,
shared snapshot), `quotations.service.ts` (`accept` captures acceptor, `markConverted`),
`proposals/schemas/proposal.schema.ts` (optional `leadId`, lineage, snapshot, `bookingStatus`),
`proposals.module.ts`, `app.module.ts`, RBAC (`report.read` + quotation-conversion authority on
sales/manager roles).

## Operational note

New permissions (`report.read`) and refreshed role permission-sets require **`npm run seed:catalog`**
to sync into the database. New API surface: `POST /proposals/convert/:quotationId`,
`POST /proposals/:id/check-readiness|book`, `GET/PATCH /proposals/:id/fulfillment-items[/:itemId]`,
`GET /proposals/:id/lineage`, `GET /revenue-pipeline`, `GET /ai-context/proposal/:id`. This
completes business-objective step 9 (convert approved quotations into proposals) from Phase 2.
