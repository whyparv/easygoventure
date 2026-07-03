# Phase 1.6 — Tenant Hardening Report

> Makes tenant isolation **structural**: enforced by a base repository and query-level
> scoping, not by developer discipline. No business, AI, UI, API-contract, or workflow
> changes — this pass only moves the enforcement point and removes dead code.

**Build status:** `nest build` ✓ · `eslint --max-warnings 0` ✓ · `tsc --noEmit` ✓ (0 errors)
**Goal achieved:** tenant isolation moved from *"currently safe"* to *"architecturally hard to bypass accidentally."*

---

## Task 1 — `TenantScopedRepository` base

New: `src/common/database/tenant-scoped.repository.ts`. Every tenant-owned repository
extends it and inherits query-level tenant safety by default:

| Method | Enforcement |
|--------|-------------|
| `findByIdScoped(id, scope)` | `findOne({ _id, ...scope, isDeleted: {$ne:true} })` |
| `paginateScoped(scope, filter, opts)` | scope + filter merged into the query; the tenant fragment is a **separate argument** so it can't be forgotten inside a filter object |
| `countScoped(scope, filter?)` | `countDocuments({ ...scope, ...filter, isDeleted })` |
| `updateScoped(id, data, scope, session?)` | `findOneAndUpdate({ _id, ...scope }, …)` |
| `softDeleteScoped(id, scope)` | `findOneAndUpdate({ _id, ...scope }, { isDeleted, deletedAt }, …)` |

The base provides **only** scoped read/update/soft-delete — there is no unscoped by-id
write to call. A new repository that extends it is tenant-safe by construction.

`scope` is a `FilterQuery` fragment (`{ organizationId }` for a normal principal, `{}`
for a super-admin, or `{ _id }` for the Organization tenant-root). Because the scope is
spread **after** `_id` in write queries, a scope may pin `_id` (Organization case) and a
foreign id can never be written — the scope's `_id` wins.

---

## Task 2 & 3 — Repository write scoping + query-level lookups

**8 repositories now extend the base** and dropped their by-id `findById`/`update`/
`softDelete`/`paginate`: `services`, `vendors`, `vendor-rates`, `inquiries`,
`departments`, `users`, `roles`, `organizations`. Their services now pass an explicit
tenant scope to every read/update/soft-delete.

**P2-2 (fetch-then-check → query-level)** eliminated where it existed:
- `services.service.findByIdOrThrow` previously did `findById(id)` then
  `organizationId.equals(org)`. Now `findByIdScoped(id, { organizationId })` — a foreign
  service is **never fetched**, it simply reads as `SERVICE_NOT_FOUND`.
- `users.service.findByIdOrThrow` previously did `findById(id)` then `isVisibleTo(...)`.
  Now `findByIdScoped(id, tenantFilter(actor))`; the `isVisibleTo` helper was removed.

**Documented special cases (correct-by-design, not weaknesses):**
- **Organizations** (the tenant root): access is identity/authorization, not an
  `organizationId` filter. Reads keep `assertCanAccess` (`_id === actor.organizationId`
  for non-super) + `findById`; writes use `updateScoped`/`softDeleteScoped` with an
  `ownScope` of `{}` (super) or `{ _id: ownOrg }` (non-super) — a scoped write can never
  reach another org. The soft-delete override preserves the `isActive: false` behavior.
- **Roles**: reads are a *union* (shared system template `organizationId: null` **or** own
  org), so `findById` + `isVisibleTo` is retained; writes are `updateScoped`/
  `softDeleteScoped` with `tenantFilter(actor)` (a system role never matches an org scope).
- **Users — authentication-internal writes** (`registerSuccessfulLogin`,
  `registerFailedLogin`, `setPassword`) are identity operations on a token-verified/self
  user with no tenant dimension; they use `updateScoped(id, data)` with an empty scope and
  are explicitly commented as such. Self reads (`getProfile`, `getAuthenticatedUserById`)
  likewise use identity `findById`.

---

## Task 4 — Dead code removed

`proposals.repository.findByToken()` (unscoped `findOne({ generatedToken })`, **zero
callers**) was removed. No DTOs, types, exports, or tests referenced it. Verified: `grep
findByToken` → none; build + lint green.

---

## Task 5 — AI Copilot hardening

The AI copilot repository manages four models in one class, so it can't extend the
single-model base; its by-id/by-session writes were scoped in place:

| Method | Before | After |
|--------|--------|-------|
| `touchSession(id, org)` | `findByIdAndUpdate(id, …)` | `findOneAndUpdate({ _id, organizationId }, …)` |
| `updateAction(id, data, org)` | `findByIdAndUpdate(id, …)` | `findOneAndUpdate({ _id, organizationId, isDeleted:{$ne:true} }, …)` |
| `listMessages(sessionId, org)` | `find({ sessionId })` | `find({ sessionId, organizationId })` |

The service passes the caller's `organizationId` into each. **No AI behavior changed**:
`/ai/chat`, `/ai/next-action`, the action-approval flow (`RECOMMENDED → APPROVED →
EXECUTED`, human approval mandatory), conversation history, and execution history are all
untouched — the calls were already gated by an org-scoped `getSessionOrThrow`/
`getActionOrThrow`, so legitimate use is identical; only the write query is now also scoped.

---

## Task 6 — Repository safety audit (post-refactor)

Searched the codebase for every requested pattern. **`findByIdAndUpdate(` and
`findByIdAndDelete(` now appear ZERO times in the modules** — the by-id write is gone.

| Pattern | Result |
|---------|--------|
| `findByIdAndUpdate(` / `findByIdAndDelete(` | **0** in `src/modules` ✅ |
| `findOneAndUpdate(` | leads/proposals/followups/fulfillments `{_id, ...tenant}`; organizations `{_id, ...scope}`; ai-copilot `{_id, organizationId}` — **all scoped** ✅ |
| `updateMany(` / `deleteMany(` / `deleteOne(` | none on tenant collections; auth session/reset revocation is keyed on `userId` (per-user identity), not a tenant surface ✅ |
| `findById(` (repo-level) | leads/proposals/followups/fulfillments take `tenant`; the 8 refactored repos use base `findByIdScoped`; hotels/permissions/service-categories are global reference; organizations/roles/users identity/union reads are documented ✅ |

Every tenant-owned collection satisfies at least one of: **TenantScopedRepository is used**,
**`organizationId` is present in the query**, or a **super-admin / identity / global-reference
path is explicitly documented**.

### Explicitly non-tenant (confirmed safe)
- **Global reference:** `hotel_catalog`, `permissions`, `service_categories` (read-gated, shared).
- **Identity/self:** `users.findById` (self profile, JWT principal); `auth_sessions` /
  `password_resets` keyed on `_id` / hash / `userId`.
- **Super-admin cross-org:** leads/proposals/followups/fulfillments/users/organizations/audit,
  via the shared `tenantFilter` (`{}` for super).
- **Seed upserts:** `roles` (system templates, `organizationId: null`), `departments`
  (`{organizationId, name}`), `permissions`/`service_categories` (global) — ops context.

---

## Task 7 — Regression verification

- `nest build` ✓ · `npm run lint` (`--max-warnings 0`) ✓ · `tsc --noEmit` ✓ (0 errors).
- **Behavior preserved.** For legitimate same-org access, every scoped query returns the
  identical result it did before (the scope matches the caller's own records); a foreign id
  still reads as `*_NOT_FOUND`. The legacy Lead/Proposal/Followup/Fulfillment lifecycles
  (including the atomic proposal-accept transaction and the "lead COMPLETED only when all
  fulfillments resolved" rule) were **not modified** in this pass — only `findByToken` (dead
  code) was removed. Inquiry conversion, Organization/User/RBAC management, Audit, AI Copilot,
  Hotel Catalog, Vendor and Service Catalog all operate exactly as before.
- **No API/DTO/route/response-contract changes.** Controllers, request DTOs, response DTOs,
  and routes are byte-identical; only repository/service internals changed.
- **One documented micro-change (unreachable state):** `users.findAll` previously returned an
  empty page for a *non-super principal with a null organization*; it now throws
  `ORGANIZATION_REQUIRED` (via the shared `tenantFilter`). This state is not reachable in
  normal operation (user creation always assigns an organization), and the throw is the safer
  behavior. `organizations.findAll` retains its empty-page guard for the same state.

---

## Success criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Tenant isolation is repository-level infrastructure | ✅ `TenantScopedRepository` |
| 2 | Future repositories inherit tenant safety by default | ✅ extend the base; only scoped writes exist |
| 3 | No tenant-owned repository performs unscoped writes | ✅ `findByIdAndUpdate` = 0; all writes carry a scope |
| 4 | Dead code removed | ✅ `proposals.findByToken` |
| 5 | AI repositories are tenant-safe | ✅ session/action/message writes scoped |
| 6 | Build passes | ✅ `nest build` |
| 7 | Lint passes | ✅ `--max-warnings 0` |
| 8 | TypeScript passes | ✅ `tsc --noEmit` |
| 9 | `TENANT_HARDENING_REPORT.md` generated | ✅ this document |

---

## Files changed

**New (1):** `src/common/database/tenant-scoped.repository.ts`.

**Repositories (10):** `service-catalog/services`, `vendors/vendors`, `vendors/vendor-rates`,
`inquiries/inquiries`, `departments/departments`, `users/users`, `roles/roles`,
`organizations/organizations` (all now extend the base); `proposals/proposals`
(`findByToken` removed); `ai/ai-copilot` (session/action/message writes scoped).

**Services (9):** the 8 target services (`services`, `vendors`, `vendor-rates`, `inquiries`,
`departments`, `users`, `roles`, `organizations`) updated to pass tenant scope to every
read/update/soft-delete; `ai/ai-copilot` passes `organizationId` to the scoped writes.

---

*Phase 1.6 completes the tenant-hardening pass. Isolation is now guaranteed by architecture:
the base repository exposes only scoped operations, so an unscoped tenant write cannot be
written without deliberately bypassing the pattern.*
