# PHASE 1.5 — Tenant Isolation Report

> Retrofits `organizationId` into the five legacy CRM entities so multi-tenant
> isolation is complete **before** WhatsApp, Pricing, Vendor Rates, Quotations, or
> Accounts are built. Business behavior, AI behavior, and UI request contracts are
> unchanged — this pass only adds tenancy, enforcement, audit, and a migration.

**Build status:** `nest build` ✓ · `npm run lint` (`--max-warnings 0`) ✓ · `tsc --noEmit` ✓ (0 errors)
**Entities retrofitted:** `Lead`, `LeadActivity`, `Proposal`, `FollowUp`, `Fulfillment`.

---

## 1. What changed (by layer)

### Schemas — `organizationId` + indexes
Every legacy schema gains a required, indexed tenant owner and tenant-first compound indexes:

```ts
@Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
organizationId!: Types.ObjectId;
```

| Collection | New compound indexes |
|------------|----------------------|
| `leads` | `{organizationId, status}`, `{organizationId, createdAt}` |
| `lead_activities` | `{organizationId, leadId, createdAt}` |
| `proposals` | `{organizationId, status}`, `{organizationId, leadId}` |
| `followups` | `{organizationId, scheduledDate}`, `{organizationId, leadId}` |
| `fulfillments` | `{organizationId, status}`, `{organizationId, leadId}` |

### Repositories — repository-level tenant filters (requirement 4)
Every id-based read/write now accepts a tenant fragment and applies it in the query, so isolation is enforced at the data layer, not just in services:

- `findById(id, tenant)`, `update(id, data, tenant)`, `softDelete(id, tenant)` → `findOne/findOneAndUpdate({ _id, ...tenant, isDeleted: {$ne:true} })`
- `proposals.transitionStatus(..., tenant)` — the atomic accept guard is now tenant-scoped.
- `fulfillments.countUnresolvedByLead(..., tenant)` — the lead-completion rollup is tenant-scoped.
- `paginate(filter, …)` receives the tenant fragment inside `filter` (built by the service).

### Services — tenant scope threaded through
Each service method now takes the `AuthenticatedUser` and derives scope via a single shared helper `common/tenant/tenant-scope.ts`:

```ts
tenantFilter(actor)        // → { organizationId } for org users; {} for super-admin
requireOrganizationId(actor) // → ObjectId for create; throws if the actor has no org
```

- **Create** stamps `organizationId` on the new record (from the actor, or from the parent lead for proposals/followups/fulfillments).
- **Read / update / delete** pass `tenantFilter(actor)` into the repository.
- **Super-admin** (`isSuperAdmin`) operates cross-organization (empty fragment), consistent with the Phase 1 modules; any non-super principal without an organization is rejected (`ORGANIZATION_REQUIRED`) and can never issue an unscoped query.

### Controllers — `@CurrentUser` (requirement 5)
All 4 legacy controllers now inject `@CurrentUser() user` and pass it to the service. **No request DTO changed and no response field was removed** — responses simply gain an additive `organizationId` (documented in the `*ResponseDto`s), which existing clients ignore.

---

## 2. Cross-module propagation (how the workflow stays consistent)

The lead is the hub; siblings write to it. Each internal call now carries the tenant so nothing escapes the organization:

- `LeadsService.appendActivity(leadId, type, desc, organizationId, …)` and `LeadsService.setStatus(leadId, status, organizationId, session?)` take the record's `organizationId` explicitly.
- `proposals.accept()` runs its existing single Mongo transaction, now propagating `proposal.organizationId` to `setStatus`, `appendActivity`, and `FulfillmentsService.createFromAcceptedProposal({ organizationId, … })` — so the auto-created fulfillment and the lead-status flip stay in the proposal's org.
- `followups.create()` / `fulfillments.update()` propagate the lead's / fulfillment's org to the status + timeline writes.
- `InquiriesService.convert()` (Phase 1 aggregate) passes the actor into `leadsService.create()`, so a converted lead inherits the inquiry's tenant.

**Behavior is byte-identical**: the same state machines, the same atomic accept transaction, the same activity descriptions, the same "lead COMPLETED only when all fulfillments resolved" rule. For an org user acting on their own records the tenant fragment always matches, so no path changes outcome.

---

## 3. Requirement 5 — users can never access records outside their organization

Enforced at three layers (defense in depth):

1. **Service scope** — every method builds `tenantFilter(actor)`; a non-super user is always constrained to `{ organizationId: <their org> }`.
2. **Repository filter** — id-based ops embed that fragment in the Mongo query, so a guessed/foreign id simply returns `null` → `*_NOT_FOUND` (no cross-tenant read, update, delete, or status transition).
3. **Creation** — new records are stamped with the actor's (or parent record's) org; a user cannot create a record in another org.

Result: fetching, listing, updating, deleting, sending/accepting/rejecting, or transitioning a record that belongs to another organization is indistinguishable from "not found".

---

## 4. Audit coverage (requirement 6)

The 4 services now inject the global `AuditService` and record every write to `audit_logs` (fire-and-forget — audit never breaks a business write, and audit calls sit outside the accept transaction):

| Entity | Audited actions |
|--------|-----------------|
| Lead | `lead.created`, `lead.updated`, `lead.deleted` |
| Proposal | `proposal.created`, `proposal.sent`, `proposal.accepted`, `proposal.rejected` |
| FollowUp | `followup.created`, `followup.updated` |
| Fulfillment | `fulfillment.created`, `fulfillment.updated` |

Each entry carries the actor, their organization, the entity + id, and a small before/after payload. The per-lead activity timeline (`lead_activities`) is retained unchanged; the audit log is the additional tenant-wide trail.

---

## 5. Migration (requirements 2, 3, 7)

`src/database/migrations/backfill-organization-id.ts` (run: `npm run migrate:tenant`):

1. **Resolves the target org** — `BACKFILL_ORG_ID` env → else the `SEED_ORG_SLUG` org → else the single existing org (errors if ambiguous).
2. **Backfills** `organizationId` on every legacy document that lacks it (`leads`, `lead_activities`, `proposals`, `followups`, `fulfillments`) via `updateMany`. **Idempotent** — only docs with a missing/null `organizationId` are touched, so re-runs are no-ops and report `nothing to backfill`.
3. **Builds the new indexes** — calls `createIndexes()` on each model (safe even where `autoIndex` is disabled in production).

Because `organizationId` is `required`, the migration must run **before** the enforcing app writes to legacy collections that still contain pre-migration data.

**Rollout order for an existing environment:**
```bash
cd backend
npm run seed:catalog     # ensures a default org exists (idempotent)
npm run migrate:tenant   # backfills organizationId + builds tenant indexes
npm run build            # deploy the tenant-enforcing code
```

> Note: this migration was authored and type-checked but **not executed against the remote MongoDB Atlas cluster** — writes to a shared/production database are left for you to run intentionally (locally or against Atlas with a backup).

---

## 6. Guarantees & non-goals

- ✅ All five legacy entities are tenant-owned and tenant-enforced (service + repository).
- ✅ Cross-tenant access is impossible for non-super users; super-admins remain cross-org by design.
- ✅ Audit coverage on every legacy write.
- ✅ Idempotent backfill + index migration.
- ✅ **No business-behavior change** (state machines, transactions, timeline text, completion rules unchanged).
- ✅ **No AI change** (the `ai` module was not touched).
- ✅ **No UI-flow change** (request contracts unchanged; responses gain only an additive `organizationId`).

---

## 7. Files changed

**New (2):** `common/tenant/tenant-scope.ts`, `database/migrations/backfill-organization-id.ts`.

**Modified (20):**
- Schemas: `leads/schemas/lead.schema.ts`, `leads/schemas/lead-activity.schema.ts`, `proposals/schemas/proposal.schema.ts`, `followups/schemas/followup.schema.ts`, `fulfillments/schemas/fulfillment.schema.ts`
- Repositories: `leads/leads.repository.ts`, `leads/lead-activities.repository.ts`, `proposals/proposals.repository.ts`, `followups/followups.repository.ts`, `fulfillments/fulfillments.repository.ts`
- Services: `leads/leads.service.ts`, `proposals/proposals.service.ts`, `followups/followups.service.ts`, `fulfillments/fulfillments.service.ts`
- Controllers: `leads/leads.controller.ts`, `proposals/proposals.controller.ts`, `followups/followups.controller.ts`, `fulfillments/fulfillments.controller.ts`
- Response DTOs: the 4 `*-response.dto.ts` (additive `organizationId`)
- Cross-module: `inquiries/inquiries.service.ts` (pass actor into `leadsService.create`)
- `package.json` (`migrate:tenant` script)

---

## 8. Manual verification steps

1. `npm run migrate:tenant` → prints backfilled counts per collection; second run prints `nothing to backfill` (idempotent).
2. Log in as two users in **different** organizations. User A creates a lead → note its id.
3. As User B: `GET /api/leads/:idOfA` → `404 LEAD_NOT_FOUND`; `PATCH`/`DELETE` likewise; `GET /api/leads` never lists A's lead.
4. As User A: full lead → proposal → send → accept → fulfillment → complete flow works exactly as before, and the created proposal/fulfillment/activities all carry A's `organizationId`.
5. `GET /api/audit-logs?entity=Proposal` (with `audit.read`) shows `proposal.created/sent/accepted` scoped to your org.
6. As a `SUPER_ADMIN`: listing/reading legacy records spans organizations (cross-org), matching Phase 1 semantics.

---

*Phase 1.5 completes multi-tenant isolation. The platform is now safe to build revenue/operational modules (WhatsApp, Pricing, Vendor Rates, Quotations, Accounts) on a fully tenant-scoped base.*
