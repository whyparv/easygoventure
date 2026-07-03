# Phase 2 — Commercial Engine Report

> Transforms the platform from a CRM into a revenue-generating DMC operating system:
> **Inquiry → Package (internal costing) → Items (cost + markup) → Pricing Engine →
> Quotation (customer-facing, immutable snapshot)**. Everything is tenant-safe and
> auditable. No UI redesign; domain/services/API only.

**Build status:** `nest build` ✓ · `eslint --max-warnings 0` ✓ · `tsc --noEmit` ✓ (0 errors)
**Pricing math:** verified by assertions (percentage, fixed, package aggregation).

---

## 1. Domain model

```
Inquiry ──(prices)──► Package ──contains──► PackageItem ──sources cost──► VendorRate
                         │  (internal costing workspace)     │ (rateType, window, pax)
                         │  totals derived by PricingEngine   │
                         ▼                                     ▼
                     Quotation ──freezes──► PackageSnapshot ─► PackageItemSnapshot ─► VendorRateSnapshot
                  (customer-facing, immutable, versioned)     (embedded, never mutated)

AiContext (read-only) ──assembles──► { Inquiry | Package+margin+rates | Quotation snapshot }  →  future AI workflows
```

- **Package** is the internal costing container (not customer-facing). Its four totals are
  **derived** by the PricingEngine — never entered manually.
- **PackageItem** carries `unitCost` + markup config; `unitSellPrice`, `totalCost`,
  `totalSellPrice`, `profit` are computed. A cost can be sourced from a `VendorRate`.
- **Quotation** is the customer-facing document. On generation it **freezes** the package,
  items and vendor rates into an embedded snapshot; it never changes when rates change later.

---

## 2. Collections added / changed

| Collection | Status | Notes |
|------------|--------|-------|
| `vendor_rates` | **enhanced** | + `rateType` (enum), `hotelId`, `minimumPax`, `maximumPax`, `status` (DRAFT/ACTIVE/EXPIRED), `notes`; overlapping-window validation |
| `packages` | **new** | internal costing workspace + derived totals; status DRAFT/COSTED/QUOTED/ARCHIVED |
| `package_items` | **new** | priced lines; self-computed prices; loose `referenceId` + `vendorRateId` link |
| `quotations` | **new** | customer-facing; embeds an immutable `PackageSnapshot` (with `PackageItemSnapshot[]` + `VendorRateSnapshot`) |

All new schemas use `baseSchemaOptions`, soft-delete, and `organizationId`.

---

## 3. Indexes added

- **vendor_rates:** `organizationId`, `vendorId`, `hotelId`, `rateType`, `status`, `validFrom`, `validTo`; compound `{organizationId,vendorId}`, `{organizationId,hotelId}`, `{organizationId,rateType,status}`, `{validFrom,validTo}`.
- **packages:** `organizationId`, `status`, `inquiryId`; compound `{organizationId,status}`, `{organizationId,inquiryId}`.
- **package_items:** `organizationId`, `packageId`, `vendorRateId`; compound `{organizationId,packageId}`.
- **quotations:** `organizationId`, `packageId`, `status`, unique `quotationNumber`; compound `{organizationId,status}`, `{organizationId,packageId}`.

---

## 4. Pricing engine rules (`PricingEngineService`)

All figures derived; nothing manual. Money rounded to 2 dp.

| Rule | Formula |
|------|---------|
| Percentage markup | `unitSellPrice = unitCost + (unitCost × markupValue / 100)` |
| Fixed markup | `unitSellPrice = unitCost + markupValue` |
| Item totals | `totalCost = unitCost × qty`, `totalSellPrice = unitSellPrice × qty`, `profit = totalSellPrice − totalCost` |
| Package totals | `totalCost = Σ item.totalCost`, `totalSellPrice = Σ item.totalSellPrice`, `totalMarkup = expectedProfit = totalSellPrice − totalCost` |

**Verified** (assertion run): `20% on 100 ×2 → sell 120, cost 200, sell 240, profit 40`;
`fixed +50 on 100 ×1 → sell 150, profit 50`; `package → cost 300, sell 390, margin 90`.

- `calculateItem()` and `calculatePackage()` are pure. `recalculatePackage()` re-derives a
  package's totals from its live items and persists them (tenant-scoped). Totals are
  recomputed automatically after every item add/update/remove; a DRAFT package
  auto-advances to **COSTED** once it has cost.

---

## 5. Snapshot strategy (immutability)

- On `generateFromPackage`, the service builds a `PackageSnapshot` embedded in the quotation:
  package fields + totals (recomputed from the frozen items for internal consistency) +
  `PackageItemSnapshot[]`, each optionally carrying a `VendorRateSnapshot` (vendor id/name,
  rate type, currency, net cost, validity).
- `customerPrice` is frozen to the snapshot's `totalSellPrice`.
- The snapshot is **written once and never updated** — no service path mutates
  `quotation.snapshot`. Editing vendors, rates, hotels, services or the source package after
  generation does not touch any historical quotation.
- **Versioning:** each generation creates a new quotation with a fresh unique
  `quotationNumber` and an incremented `version` (count of prior quotations for the package + 1).
  Re-costing a QUOTED package is allowed and produces a new immutable version; old versions
  are untouched.

---

## 6. Audit coverage (`audit_logs`)

Every commercial action is recorded via the global `AuditService` (fire-and-forget, tenant-scoped):

| Action | Emitted on |
|--------|-----------|
| `package.created` / `package.updated` / `package.deleted` | package CRUD |
| `package.item.added` / `package.item.updated` / `package.item.removed` | item changes (each re-costs the package) |
| `vendor_rate.created` / `vendor_rate.updated` / `vendor_rate.deleted` | rate changes |
| `quotation.generated` / `quotation.sent` / `quotation.accepted` / `quotation.rejected` | quotation lifecycle |

Each entry carries the actor, organization, entity + id, and a before/after payload.

---

## 7. Tenant isolation verification

Follows the Phase 1.6 standard — enforcement is structural.

- **All new/enhanced repositories extend `TenantScopedRepository`:** `PackagesRepository`,
  `PackageItemsRepository`, `QuotationsRepository`, `VendorRatesRepository` (+ existing
  `VendorsRepository`). Reads/updates/soft-deletes are org-scoped at the query level.
- Every service resolves a `scope = { organizationId }` (rejecting principals with no org)
  and passes it into `findByIdScoped` / `paginateScoped` / `updateScoped` / `softDeleteScoped`.
- Cross-entity reads are all tenant-scoped: package-item lookups (`findByPackage` includes the
  org scope), vendor-rate resolution for costing/snapshots (`VendorRatesService.findByIdOrThrow`),
  and quotation snapshot building (package + items + rates all fetched via scoped services).
- No unscoped tenant queries were introduced; `findByIdAndUpdate` is not used anywhere in the
  new code.
- All endpoints are permission-gated (`package.*`, `quotation.*`; AI context requires
  `ai.use` **and** the relevant read permission).

---

## 8. Future AI integration points

`CommercialContextService` + `/ai-context/*` endpoints are **infrastructure only** — read-only,
no pricing, no writes, no approvals; existing AI behavior is unchanged.

- `GET /ai-context/inquiry/:id` → inquiry brief.
- `GET /ai-context/package/:id` → package costing + margin % + per-item vendor rates.
- `GET /ai-context/quotation/:id` → the frozen quotation snapshot.

Each returns `{ type, summary, data }`; `summary` can be passed straight to the existing
`/ai/chat` as `context`, and `data` is structured for future tool-calling. Natural next steps
(all human-approved): AI-suggested markups, package assembly from an inquiry, margin
optimisation, and quotation drafting — surfaced as `ai_actions` requiring approval, never
autonomous pricing or acceptance.

---

## 9. Build / Lint / TypeScript status

| Check | Result |
|-------|--------|
| `tsc --noEmit` | ✅ 0 errors |
| `nest build` | ✅ dist built |
| `eslint --max-warnings 0` | ✅ 0 problems |
| Pricing-engine assertions | ✅ percentage, fixed, package totals correct |

---

## Operational note

The new permissions (`package.*`, `quotation.*`) were added to the permission catalog and the
role matrix (sales roles gain package/quotation authority; owners/admins inherit all). **Re-run
`npm run seed:catalog`** to sync the new permission documents and refresh the seeded system
roles in the database. New API surface: `/packages` (+ `/items`, `/recalculate`), `/quotations`
(`/from-package/:id`, `/send|accept|reject`), enhanced `/vendor-rates`, and `/ai-context/*`.

---

## Business objective — coverage

1. Receive an inquiry ✓ (existing) → 2. Build a package ✓ → 3. Attach hotels/activities/
transfers/visas/flights/custom ✓ (`ServiceLineType` items) → 4. Enter supplier costs ✓
(direct or from a `VendorRate`) → 5. Apply markups ✓ (percentage/fixed) → 6. Generate a
customer-facing quotation ✓ → 7. Track expected profit ✓ (derived totals + margin %) →
8. Freeze pricing history ✓ (immutable snapshots) → 9. Convert approved quotations into
proposals — *scaffolded*: an accepted quotation + its package/inquiry provide the linkage;
wiring `quotation → proposal` is the recommended next increment (documented as a future
integration point).
