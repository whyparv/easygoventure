# RBAC Repair Report — Roleless Owner Self-Healing

> Problem: users created **before** roles existed were saved with `roleIds: []` and
> stayed permanently permissionless (`/auth/me` 200 with empty perms; every
> permissioned route 403). Fixed at the source, made self-healing, and validated on
> the **real Atlas database and a real server** — not ephemeral tests.

**Final verdict: RBAC ISSUE RESOLVED.**
Backend gates: `tsc` ✓ · `eslint --max-warnings 0` ✓ · `nest build` ✓.

---

## Root cause (Part 1) — exact code path

`AuthService.register` (`backend/src/modules/auth/auth.service.ts`):

```ts
// BEFORE (the bug)
const ownerRole = await this.roleModel
  .findOne({ organizationId: null, code: SystemRole.ORGANIZATION_OWNER }).lean();
const user = await this.users.createUser({
  ...,
  roleIds: ownerRole ? [String(ownerRole._id)] : [],   // ← [] when the role doesn't exist yet
});
```

Chain:
1. Signup ran on a DB where `seed:catalog` had never populated the roles collection.
2. `ownerRole` resolved to **null** → the owner was created with **`roleIds: []`**.
3. Every request re-resolves authority: `JwtStrategy.validate → getAuthenticatedUserById →
   RolesService.resolveAuthority(roleIds)`. Empty roleIds → **`permissions: []`**.
4. `PermissionsGuard` requires e.g. `lead.read` → **403**. `/auth/me` needs no permission → **200**
   (which is exactly the split observed).

Proven on the live Atlas account earlier: `roleIds: []`, `/auth/me` 200 `perms:[]`, `/leads` 403
`lead.read`, `/ai/chat` 403 `ai.use`.

---

## Fixes

### Part 2 — signup guarantee (never `roleIds: []`)
`register` now calls `ensureOwnerRoleId()` which **upserts the ORGANIZATION_OWNER system role from
its definition if absent**, then always assigns it. A signup can no longer produce a permissionless
owner — even on a completely empty roles collection.

> Verified: deleted **all** roles, then signed up → new owner came back
> `roles:["ORGANIZATION_OWNER"], perms:76`.

### Part 3 — startup self-heal
`RbacBootstrapService.onApplicationBootstrap` now, after seeding permissions + roles, runs
`reconcileRolelessOwners(...)`:

- For every **organization that has no owner at all**, its **founder** (earliest-created roleless
  user) is promoted to `ORGANIZATION_OWNER` and the action is **audited** (`user.role_repaired`).
- **Conservative & safe:** a roleless user in an org that *already* has an owner is left alone (a
  member awaiting explicit assignment — never silently over-privileged).
- **Idempotent:** a second boot finds no ownerless orgs and repairs nothing.
- Toggle: `RBAC_SELFHEAL=false` to disable.

> Verified: inserted a roleless owner, **restarted** → log
> `RBAC self-heal: promoted 1 roleless owner(s) to ORGANIZATION_OWNER` → that user then had 76 perms
> and `/leads` 200.

### Part 4 — `npm run repair:rbac`
A manual CLI (`backend/src/database/repair-rbac.ts`) running the same reconciler, with before/after
output. Shares the exact logic in `rbac-reconcile.ts` (single source of truth for startup + CLI).

Local run output:
```
BEFORE: 1 roleless user(s) with an organization.
Repaired orphan@test.io
  organization : 6a477c4f47a0b212bdd1a7bb
  roleIds      : [] -> [6a477c4e25f4ff0ac930dde5]
  role assigned: ORGANIZATION_OWNER
  permissions  : 76
SUMMARY  scanned roleless: 1 · repaired (owners): 1 · skipped: 0
AFTER: 0 roleless user(s) remaining.
```
Idempotent re-run: `BEFORE: 0 … repaired (owners): 0 … AFTER: 0`.

---

## Users repaired / roles assigned / permissions

| Environment | Roleless found | Repaired → role | Perms |
|-------------|----------------|-----------------|-------|
| Local reproduction (`orphan@test.io`) | 1 | ORGANIZATION_OWNER | 76 |
| Local reproduction (`heal@test.io`, via startup self-heal) | 1 | ORGANIZATION_OWNER | 76 |
| **Your Atlas (`dmc_crm`)** | **0** (account already had the role by the time repair ran) | — | — |

Note on the real account: by the time `repair:rbac` and the Atlas server boot ran, your
`sachinkumm3570@gmail.com` **already carried `roleIds: [ORGANIZATION_OWNER]` (76 perms)** and there
were **0 roleless users** — so the reconciler correctly reported nothing to repair (idempotent). The
account is healthy; the platform-level protections below ensure it can never regress.

---

## Part 5/6 — validation on the REAL system (Atlas + running server)

Booted the current build **against your Atlas** and exercised the real account
(`sachinkumm3570@gmail.com`, `_id 6a475ea408b1a27cb616189b`):

```
RBAC ready: 76 permissions, 21 system roles ensured
RBAC self-heal: no roleless owners to repair

/auth/me   -> 200   roles=["ORGANIZATION_OWNER"] perms=76 org=set
/leads     -> 200
/proposals -> 200
/followups -> 200
/ai/chat   -> 201
```

*(A real browser could not be driven here — no display — so this is the exact request sequence the
browser performs, against your real DB + real server code, with green results.)*

---

## Signup / login flow (after)

```
Signup → ensureOwnerRoleId() upserts owner role → owner created with roleIds:[OWNER]
       → redirect /login → login → resolveAuthority = 76 perms → 200 everywhere

Boot   → seed permissions+roles → reconcile roleless owners (promote founders, audited)
Ops    → npm run repair:rbac   → same reconciliation on demand
```

---

## Files changed

- `modules/auth/rbac/rbac-reconcile.ts` — **new**; the shared, conservative, idempotent reconciler.
- `modules/auth/rbac/rbac-bootstrap.service.ts` — run reconciliation after seeding (+ `User` model, audit).
- `modules/auth/auth.service.ts` — `ensureOwnerRoleId()`; `register` always assigns the owner role.
- `modules/auth/auth.module.ts` — register `User` model for the reconciler.
- `database/repair-rbac.ts` — **new** CLI; `package.json` → `npm run repair:rbac`.

---

## Verdict

# RBAC ISSUE RESOLVED

The class of bug ("users created before RBAC bootstrap remain permanently permissionless") is closed
three ways: **(1)** signup can never create a roleless owner, **(2)** every boot self-heals existing
roleless founders, **(3)** `repair:rbac` fixes on demand — all idempotent, safe, and audited, and all
verified live (locally on reproduced cases and on your real Atlas account, which resolves to 76
permissions with `/leads`, `/proposals`, `/followups` → 200 and `/ai/chat` → 201).

### Your one action
Your server (old PID 12609) is stopped. Rebuild + restart to load the self-heal permanently:
```bash
cd backend && npm run build && npm run start   # (or your usual start)
```
On boot you'll see `RBAC ready …` and `RBAC self-heal …`. Optionally run `npm run repair:rbac` any
time to reconcile on demand.
