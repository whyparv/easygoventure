# Authorization Root-Cause Report (Auth Phase 2)

> Symptom: after signup/login, `GET /leads`, `/proposals`, `/followups`, `POST /ai/chat`
> all returned **403**, while `GET /auth/me` returned **200/401**. Authentication worked;
> **authorization granted nothing.**

**Investigated with real requests against a real backend — not assumed.**
**Fix verified live: 13/13 (all former-403 endpoints now 200; signup owner === seeded owner).**

---

## Root cause

**The database was never seeded, so no roles or permissions existed — and self-service signup
created a permissionless owner.**

Traced end-to-end:

1. `POST /auth/register` assigns the owner role with `roleIds: ownerRole ? [ownerRole._id] : []`.
2. On a fresh DB the `ORGANIZATION_OWNER` role **doesn't exist** → `ownerRole` is `null` → the new
   user is created with **`roleIds: []`**.
3. Every request re-resolves permissions from the DB: `JwtStrategy.validate → getAuthenticatedUserById
   → resolveAuthority(roleIds)`. With no roles → **`permissions: []`**.
4. `PermissionsGuard` requires e.g. `lead.read`; the user has none → **403**.
   `/auth/me` needs no permission → **200** (which is exactly why *it* worked and the rest didn't).

### Evidence (reproduced live on an unseeded DB)

```
DB roles=0 permissions=0
POST /auth/register → user { roles: [], perms: 0, isSuperAdmin: false }
GET  /leads    → 403      GET /auth/me   → 200
POST /ai/chat  → 403
```

This matched the reported browser symptoms exactly.

> The intermittent `GET /auth/me → 401` in the browser is a **separate, transient** case: a
> stale/expired access token in `localStorage` (e.g. after a backend restart that rotated JWT
> secrets). With a fresh login it returns **200**. It is not an authorization bug.

---

## The fix

### 1. Self-healing RBAC bootstrap (primary fix)
New `RbacBootstrapService` (`onApplicationBootstrap`) idempotently upserts the **permission catalog
(76)** and **system-role templates (21)** on every boot — *before the server accepts requests*. So
**any** database (a fresh one, or the user's un-seeded one) is immediately usable and every signup
owner receives the full permission set. No manual `npm run seed:catalog` required. Only shared
system data (`organizationId: null`) is touched; org data is never modified. Disable with
`RBAC_AUTOSEED=false`.

Boot log on a fresh DB: `RBAC ready: 76 permissions, 21 system roles ensured.` → `roles=21 perms=76`.

### 2. Signup flow correction (Part 5)
Signup **no longer auto-logs-in**. It now:

```
Signup → Account created → redirect /login (success banner + email prefilled) → Login → Dashboard
```

`SignupPage` navigates to `/login` with `{ registered: true, email }`; `LoginPage` shows a green
"Workspace created — sign in" banner and pre-fills the email.

### 3. Earlier hardening (still in place)
`verifyPassword` null-guard (no 500 on a hash-less account), unique `jti` per token (no same-second
409), and DB-unreachable → `503 DATABASE_UNAVAILABLE`.

---

## Permission / role diff (Part 4 & 8)

| Principal | Role | Permissions |
|-----------|------|-------------|
| Seeded owner (`owner@dmc.local`) | `ORGANIZATION_OWNER` | 76 |
| **Signup owner** (`/auth/register`) | `ORGANIZATION_OWNER` | **76** |
| **Diff** | — | **∅ (identical)** |

Signup owner and seeded owner are **byte-for-byte identical** in role and permission set.
AI verified across roles: **owner, admin, sales** all have `ai.use` and `POST /ai/chat → 201`; sales
is correctly **403** on `/operations` (no `operations.read`).

---

## Signup & login flow (after)

```
SIGNUP                                   LOGIN
  POST /auth/register                      POST /auth/login
   ├ create Organization (unique slug)      ├ verify password (scrypt)
   ├ find ORGANIZATION_OWNER role  ← now      ├ issue access+refresh (+jti)
   │  guaranteed by boot bootstrap            └ create Session
   ├ create owner user (roleIds:[owner])
   └ (no auto-login) → 201                  Every request:
        ↓                                     JwtAuthGuard → JwtStrategy.validate
   redirect /login (prefilled)                  → getAuthenticatedUserById
        ↓                                        → resolveAuthority(roleIds) = 76 perms
   login → Dashboard                          PermissionsGuard: has lead.read → 200
```

---

## Before / after

| Endpoint (as signup owner) | Before | After |
|----------------------------|--------|-------|
| `GET /auth/me` | 200 (empty perms) | 200 (76 perms) |
| `GET /leads` | **403** | **200** |
| `GET /proposals` | **403** | **200** |
| `GET /followups` | **403** | **200** |
| `GET /inquiries` | **403** | **200** |
| `GET /operations/dashboard` | **403** | **200** |
| `POST /ai/chat` | **403** | **201** |
| `POST /ai/parse-inquiry` | **403** | **201** |
| Signup behaviour | auto-login → dashboard | redirect → /login |

---

## Verification results (live API, 13/13)

```
PASS  SIGNUP owner gets ORGANIZATION_OWNER + full perms (roles=[ORGANIZATION_OWNER] perms=76)
PASS  LOGIN after signup works
PASS  GET /auth/me → 200 with permissions (76)
PASS  GET /leads → 200 (was 403)
PASS  GET /proposals → 200 (was 403)
PASS  GET /followups → 200 (was 403)
PASS  GET /inquiries → 200 (was 403)
PASS  GET /operations/dashboard → 200 (was 403)
PASS  POST /ai/chat → 201 (was 403)
PASS  POST /ai/parse-inquiry → 201 (was 403)
PASS  AI: admin can /ai/chat (ORGANIZATION_ADMIN, ai.use=true, 201)
PASS  AI: sales can /ai/chat (SALES_EXECUTIVE, ai.use=true, 201)
PASS  DIFF: signup owner perms === seeded owner perms (diff = ∅)
```

*(The full flow was exercised end-to-end at the API layer — exactly what the browser does. A visual
browser pass was not possible in this environment; see "Browser validation" below.)*

---

## Files changed

**Backend**
- `modules/auth/rbac/rbac-bootstrap.service.ts` — **new**; auto-seeds permissions + system roles on boot.
- `modules/auth/auth.module.ts` — register `Permission` model + `RbacBootstrapService`.

**Frontend**
- `modules/auth/SignupPage.tsx` — redirect to `/login` (no auto-login) with `{registered,email}`.
- `modules/auth/LoginPage.tsx` — "workspace created" banner + email prefill from signup.

(Plus the prior hardening: `password.util.ts`, `auth.service.ts` jti, `all-exceptions.filter.ts`.)

---

## Browser validation (Part 9) — honest status

A real browser could not be driven in this environment (no display), so **visual** rendering was not
exercised here. The complete `signup → login → /auth/me → leads → proposals → followups → AI` chain
was validated at the API layer with real JWTs (13/13), which is precisely the sequence the browser
performs. The frontend also builds clean (`tsc`/`eslint`/`vite build`).

**For the user to see it work in their browser, two one-time steps are required (see below).**

---

## What the user must do (their existing DB has an orphaned account)

The bootstrap seeds **roles** on the next backend start, but it does **not** retroactively grant a
role to the owner account that was already created with `roleIds: []`. So:

1. **Restart the backend** (rebuild first): `cd backend && npm run build && <start>` → logs `RBAC ready…`.
2. **Repair the existing account** (grant it a role) — either re-run signup with a new email, or:
   ```bash
   ADMIN_EMAIL=sachinkumm3570@gmail.com ADMIN_PASSWORD='Sachin@Dmc2026!' \
   ADMIN_ROLE=SUPER_ADMIN ADMIN_ORG_SLUG=default-dmc npm run create:admin
   ```
3. **Clear the stale browser token**: hard-refresh / sign out, or clear `localStorage` (`dmc-crm-auth`), then sign in fresh. This resolves the `GET /auth/me → 401`.

New signups from now on are immediately usable with no manual step.

---

## Final verdict

# AUTHORIZATION ISSUE RESOLVED

Root cause was an **un-seeded database → permissionless signup owner → 403 everywhere**. Fixed by a
**boot-time RBAC auto-seed** so every database is immediately usable and every signup owner gets the
full `ORGANIZATION_OWNER` permission set (identical to the seeded owner), plus the requested
**signup → /login** flow. Verified live at 13/13. The only remaining action is the user restarting
their backend and repairing/renewing their already-created account per the steps above.
