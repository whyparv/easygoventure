# Tenant-Escape Audit

> Complete audit of every Mongoose query touching a tenant-owned collection, to
> confirm each path is **tenant-scoped**, **intentionally super-admin scoped**, or
> **global reference data**. Performed by enumerating the entire query surface and
> reading every repository + its callers.

**Headline verdict:** **No P0 data leaks.** Every reachable request path that reads or
writes a tenant-owned collection is org-scoped (at the repository or the service),
intentionally cross-org for `SUPER_ADMIN`, or global reference data by design.
**1 × P1** (latent audit-log cross-tenant read) — **fixed during this audit**.
**Several × P2** defense-in-depth hardening opportunities — listed with recommended patches.

---

## 1. Methodology

Searched the whole `backend/src` tree for every query operator:

```
.find(  .findOne(  .findById(  .findByIdAndUpdate(  .findOneAndUpdate(
.updateMany(  .updateOne(  .aggregate(  .countDocuments(  .deleteMany(
.deleteOne(  .bulkWrite(  .distinct(  .exists(  .create(  .save(
```

Collections in scope (tenant-owned): `leads`, `lead_activities`, `proposals`,
`followups`, `fulfillments`, `inquiries`, `vendors`, `vendor_rates`, `services`,
`users`, `organizations`, `roles`, `audit_logs`, `ai_sessions`, `ai_messages`,
`ai_actions`, `ai_approvals`, `auth_sessions`, `password_resets`, `departments`.
Global reference (no tenant, by design): `permissions`, `service_categories`,
`hotel_catalog`.

For every hit, the query was traced to its caller(s) to determine whether the
organization filter is present at the query, injected by the service, or enforced
by an org-scoped `findByIdOrThrow` immediately preceding a by-id write.

**Whole-tree result:** no `.aggregate()` calls exist; no hard deletes
(`deleteMany`/`deleteOne`) touch tenant data (only soft-delete); `@Public()` is
present **only** on `/health` and the 4 unauthenticated `/auth` routes (login,
refresh, forgot-password, reset-password) — no tenant-data controller is public.

---

## 2. Findings

### P1 — Potential leak (FIXED)

**`audit_logs` list scoped on org *presence*, not on `isSuperAdmin`.**
`src/modules/audit/audit.service.ts` `findAll` previously took `organizationId: string | null`
and did `if (organizationId) filter.organizationId = …`. A **non-super principal with a
null `organizationId`** would fall through to an **unscoped** query and receive **every
tenant's audit logs**. This is unreachable in normal operation (user creation enforces an
organization), so it never leaked in practice — but the isolation depended on that external
invariant instead of being explicit, which is a latent cross-tenant risk.

- **Fix applied:** `findAll(query, actor)` now builds its filter from the shared
  `tenantFilter(actor)` helper — `SUPER_ADMIN` → cross-org; every other principal →
  hard-scoped to `organizationId`; a non-super principal with no org is **rejected**
  (`ORGANIZATION_REQUIRED`) rather than leaking. `audit.controller.ts` passes the full
  `user`. (`src/modules/audit/audit.service.ts`, `src/modules/audit/audit.controller.ts`.)
- Build + lint verified green after the fix.

### P2 — Defense-in-depth (recommended, not leaking today)

| # | Location | Issue | Why it's only P2 | Recommended fix |
|---|----------|-------|------------------|-----------------|
| P2-1 | `service-catalog/services.repository.ts:42,48`, `vendors/vendors.repository.ts:38,44`, `vendors/vendor-rates.repository.ts:40,46`, `inquiries/inquiries.repository.ts:37,42`, `departments/departments.repository.ts:32,37`, `organizations/organizations.repository.ts:43,48`, `users/users.repository.ts:56,61`, `roles/roles.repository.ts:30,35` | Repo `update`/`softDelete` use `findByIdAndUpdate(id, …)` — **by id only, no tenant fragment**. | Every caller runs an **org-scoped `findByIdOrThrow` immediately before** the write, so no reachable path mutates cross-tenant. | Scope the write query too (`findOneAndUpdate({ _id, organizationId }, …)`), mirroring the legacy modules (`leads`/`proposals`/`followups`/`fulfillments`), so a future direct caller can't bypass. |
| P2-2 | `service-catalog/services.service.ts:82-86` | `findByIdOrThrow` does `findById(id)` then a post-hoc `service.organizationId.equals(org)` check. | Correct — a foreign service reads as `SERVICE_NOT_FOUND`. | Scope at the query (`findOne({ _id, organizationId })`, like the vendors pattern) so a foreign document is never fetched into memory. |
| P2-3 | `proposals/proposals.repository.ts:25` | `findByToken(token)` is an **unscoped** `findOne({ generatedToken })` with **no callers** (dead code). | Not wired to any endpoint — unreachable. | Remove until needed; when a public "view proposal by token" endpoint is added, treat the token as the capability and return only that proposal (never enumerate). |
| P2-4 | `roles/roles.repository.ts:26` | `findByIds(ids)` is global (no org filter), used by principal resolution over `user.roleIds`. | `users` `assignRoles` validates each role's visibility (`roles.findByIdOrThrow`), so a user can only ever hold system or own-org roles. | Optionally intersect resolved roles with `{ isSystem: true } ∪ { organizationId: user.org }` as belt-and-suspenders. |
| P2-5 | all repos' `paginate(filter, …)` | List enforcement lives in the **service** (each injects the tenant fragment into `filter`); the repo's `paginate` only adds `isDeleted`. | Every service injects the tenant fragment correctly today (verified per-module below). | Introduce a `TenantScopedRepository` base (or a required `organizationId` arg on `paginate`) so a future list method can't omit the scope. |
| P2-6 | `ai/ai-copilot.repository.ts:36,45,66` | `touchSession(id)`, `updateAction(id)`, `listMessages(sessionId)` are by-id/by-session with no org fragment. | Each is called only after an org-scoped `getSessionOrThrow`/`getActionOrThrow` in the service. | Scope these queries by org for consistency. |
| P2-7 | consistency | Super-admin cross-org behavior is uneven: `leads`/`proposals`/`followups`/`fulfillments`/`users`/`organizations`/`audit` grant `SUPER_ADMIN` cross-org; `inquiries`/`services`/`vendors`/`vendor_rates`/`departments` **require** an org and block a null-org super-admin. | Not a leak — the stricter modules are safe. | Decide one policy (recommend: super-admin cross-org read everywhere) and apply the shared `tenantFilter` uniformly. |

---

## 3. Coverage matrix (every tenant-owned collection)

Legend: **Scoped** = org fragment in the query; **Svc-gated** = by-id query preceded by an
org-scoped `findByIdOrThrow`; **Intentional** = cross-org/global by design.

| Collection | Query (file:line) | Verdict |
|------------|-------------------|---------|
| **Lead** | `leads.repository.ts:22` findById(id, tenant) · `:32/33` paginate/count (svc injects tenant `leads.service.ts:48`) · `:45` update `findOneAndUpdate({_id,…tenant})` · `:52` softDelete `{_id,…tenant}` · `leads.service.ts:171` setStatus findById(id,{org}) | **Scoped** ✅ |
| **LeadActivity** | `lead-activities.repository.ts:45` findByLead(id, tenant) · `create` stamps `organizationId` | **Scoped** ✅ |
| **Proposal** | `proposals.repository.ts:21` findById(id, tenant) · `:34/35` paginate/count (svc `:99`) · `:45` update `{_id,…tenant}` · `:62` transitionStatus `{_id,status,…tenant}` | **Scoped** ✅ |
| | `proposals.repository.ts:25` findByToken(token) | **P2-3** (no callers) |
| **FollowUp** | `followups.repository.ts:21` findById(id, tenant) · `:30/31` paginate/count (svc `:52`) · `:41` update `{_id,…tenant}` | **Scoped** ✅ |
| **Fulfillment** | `fulfillments.repository.ts:23` findById(id, tenant) · `:32/33` paginate/count · `:43` update `{_id,…tenant}` · `:53` countUnresolvedByLead({…tenant}) | **Scoped** ✅ |
| **Inquiry** | `inquiries.repository.ts:21` findByIdScoped(id, org) · `:30/31` paginate/count (svc injects org) | **Scoped** ✅ |
| | `inquiries.repository.ts:37,42` update/softDelete by-id | **Svc-gated** (P2-1) |
| **Vendor** | `vendors.repository.ts:21` findById(**filter**) — svc passes `{_id,org}` (`vendors.service.ts:75`) · `:31/32` paginate/count (svc `:52`) | **Scoped** ✅ |
| | `vendors.repository.ts:38,44` update/softDelete by-id | **Svc-gated** (P2-1) |
| **VendorRate** | `vendor-rates.repository.ts:23` findById(`{_id,org}` `vendor-rates.service.ts:82`) · `:33/34` paginate/count (svc `:60`) | **Scoped** ✅ |
| | `vendor-rates.repository.ts:40,46` update/softDelete by-id | **Svc-gated** (P2-1) |
| **Service** | `services.repository.ts:21` findById(id) + svc `organizationId.equals` (`services.service.ts:84`) · `:31/32` paginate/count (svc `:58`) | **Svc-gated** ✅ (P2-2) |
| | `services.repository.ts:42,48` update/softDelete by-id | **Svc-gated** (P2-1) |
| **User** | `users.repository.ts:21` findById(id) + svc `isVisibleTo` (admin) / self (me, JWT) · `:49/50` paginate/count (super=all, else org) | **Scoped/Self** ✅ |
| | `users.repository.ts:27,33` findByEmail\* (login) | **Intentional** (global by email) |
| | `users.repository.ts:56,61` update/softDelete by-id | **Svc-gated** (P2-1) |
| **Organization** (the tenant) | `organizations.repository.ts:23` findById(id) + svc `assertCanAccess` · `:36/37` paginate/count (super=all, else `_id`=own) | **Scoped** ✅ |
| | `organizations.repository.ts:27` findBySlug (super-create/seed uniqueness) | **Intentional** |
| | `organizations.repository.ts:43,48` update/softDelete by-id | **Svc-gated** (P2-1) |
| **Role** | `roles.repository.ts:15` findById(id) + svc `isVisibleTo` (system/own) · `:20` find(`$or:[isSystem, org]`) | **Scoped** ✅ |
| | `roles.repository.ts:26` findByIds(ids) (own `roleIds`, validated at assignment) | **Intentional** (P2-4) |
| | `roles.repository.ts:30,35` update/softDelete by-id (+ `isSystem` block) | **Svc-gated** (P2-1) |
| **AuditLog** | `audit.repository.ts:25/26` find/count(filter) — svc `tenantFilter(actor)` | **Scoped** ✅ (was **P1**, fixed) |
| **AiSession/Message/Action/Approval** | `ai-copilot.repository.ts:24` findSession(`{_id,org}`) · `:54` findAction(`{_id,org}`) · `:29/59` list\* (svc injects `{org,…}`) | **Scoped** ✅ |
| | `ai-copilot.repository.ts:36,45,66` touchSession/listMessages/updateAction | **Svc-gated** (P2-6) |
| **auth_sessions / password_resets** | `auth.repository.ts:18,23,27,32,37,54,59,64` — keyed on `refreshTokenHash` / `tokenHash` / `_id` / `userId` | **Per-user** (not a tenant surface) |
| **Department** | `departments.repository.ts:17` findByIdScoped(id, org) · `:21` find(filter) (svc `:51` `{org}`) · `:28` findByNameInOrg(org, name) | **Scoped** ✅ |
| | `departments.repository.ts:32,37` update/softDelete by-id | **Svc-gated** (P2-1) |

---

## 4. Intentional cross-org / global paths (confirmed safe)

- **Global reference data (no tenant):** `permissions` (`permissions.repository.ts:13,18`),
  `service_categories` (`service-categories.repository.ts:17,21,26`), `hotel_catalog`
  (`hotels.repository.ts:19,28,29`). Read-gated by permissions; shared across tenants by design.
- **Authentication lookups:** `users.findByEmailWithSecrets` / `findByEmail` are intentionally
  global — login must resolve a user by email regardless of tenant. Password verification +
  status/lockout checks gate the result.
- **Principal resolution:** `users.findById(id)` and `roles.findByIds(user.roleIds)` operate on
  the caller's **own** identity (from the verified token), not on arbitrary tenant data.
- **`SUPER_ADMIN`:** the wildcard principal is intentionally cross-organization on the legacy
  modules, users, organizations, and (post-fix) audit logs — the platform-owner role.
- **Seed & migration scripts** (`seed*.ts`, `migrations/backfill-organization-id.ts`) use the
  Mongoose models directly in an operator/ops context — not request-reachable.

---

## 5. Recommended hardening patch set (P2)

In priority order, to make isolation defense-in-depth rather than service-dependent:

1. **Scope repo writes** (P2-1): change `update`/`softDelete` in the 8 new-module repos to
   `findOneAndUpdate({ _id, ...tenant }, …)` and thread the tenant fragment from the service
   (the services already compute it for `findByIdOrThrow`).
2. **Query-scope `services.findByIdOrThrow`** (P2-2): switch to `findOne({ _id, organizationId })`.
3. **Remove `proposals.findByToken`** (P2-3) until a capability-scoped public endpoint needs it.
4. **Extract a `TenantScopedRepository` base** (P2-5) so `paginate`/`findById`/`update`/`softDelete`
   are org-scoped by construction and new modules inherit the guarantee.
5. **Scope AI-copilot internal writes** (P2-6) and **align super-admin policy** (P2-7).

None of these are blocking: with the P1 fixed, there is no reachable cross-tenant read or write today.

---

## 6. Summary

| Severity | Count | Status |
|----------|------:|--------|
| **P0 — Data leak** | 0 | — |
| **P1 — Potential leak** | 1 | ✅ Fixed during audit (audit-log scoping) |
| **P2 — Defense-in-depth** | 7 | Documented with recommended patches |

The platform's multi-tenant isolation holds across all audited paths. The single latent
weakness (audit-log list) has been closed, and the remaining items are consistency /
belt-and-suspenders improvements that prevent future regressions.

*Build + lint verified green after the P1 fix (`tsc --noEmit` 0 errors, `eslint` 0 problems).*
