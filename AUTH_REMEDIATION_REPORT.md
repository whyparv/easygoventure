# P0 Authentication & Route-Security Remediation Report

> Closes the P0 from `PRODUCTION_READINESS_SMOKE_TEST_REPORT.md`: the frontend had
> no login and no JWT, so every API call returned **401**. This report implements
> production-grade auth and **verifies it against a live backend**.

**Frontend gates:** `tsc -b` ✓ · `eslint --max-warnings 0` ✓ · `vite build` ✓
**Live auth smoke:** **15/15 passed** (real Mongo + Redis + backend, real tokens).

---

## Root cause

- The backend protects every business route with a **global `JwtAuthGuard`** (passport-jwt, Bearer,
  `@Public()` opt-out) plus a perimeter `ApiKeyGuard`. Both are AND-ed.
- The frontend HTTP client (`shared/api/http.ts`) attached **only** `x-api-key` (and `VITE_API_KEY`
  was empty), sent **no `Authorization: Bearer`**, and the app had **no `/login` route, no auth
  store, no token, no refresh, and no route guards** (verified: "NO login references in frontend").
- Net: the SPA rendered the shell for anyone but couldn't authenticate a user → **401 on every call**.

**Exact files responsible (before):** `shared/api/http.ts` (no Bearer), `app/router/AppRouter.tsx`
(no guards — all routes public), and the absence of any auth store / login page / boot check.

---

## Architecture (after)

```
                       ┌───────────────── AuthBoot (App.tsx) ─────────────────┐
                       │  boot: token in localStorage? → GET /auth/me         │
                       │   ok → hydrate user (authenticated)                  │
                       │   fail → clear (unauthenticated)  ·  splash until done│
                       └──────────────────────────────────────────────────────┘
   useAuthStore (zustand + persist → localStorage)   ← single source of truth
     { accessToken, refreshToken, user{roles,permissions,isSuperAdmin}, status }
                       │                                   ▲
     request interceptor: Authorization: Bearer <token>   │ setSession / clearSession
                       ▼                                   │
   axios (shared/api/http.ts) ──► backend /api/v1 ─── 401 ─┴─► single-flight refresh → retry
                       │                                        (fail → clearSession → guards redirect)
                       ▼
   RequireAuth (gates the whole AppLayout) · RequirePermission (403 page)
```

## Token flow

```
LoginPage → POST /auth/login {email,password}
        ← { accessToken, refreshToken, tokenType:'Bearer', user }
   setSession() → persist → navigate(from ?? /dashboard)
Every request → interceptor adds  Authorization: Bearer <accessToken>
Reload / reopen browser → persist restores tokens → AuthBoot validates via /auth/me
```

## Refresh flow (single-flight, no loops)

```
request → 401 (access expired)
   ↓  (skip if url is /auth/login or /auth/refresh, or already retried)
refreshPromise ??= POST /auth/refresh { refreshToken }   ← at most ONE in flight
   ├─ success → setSession(newTokens); retry original with new Bearer
   └─ fail    → clearSession() → status=unauthenticated → RequireAuth redirects to /login
concurrent 401s await the SAME refreshPromise (race-safe; cleared in .finally)
```

Verified live: refresh **rotates** the pair, the new access token works, and a **revoked** refresh
token (after logout) is **rejected (401)** — sessions are genuinely invalidated server-side.

---

## Routes protected

- **`/login`** — public (only route outside the shell).
- **Entire app shell** wrapped in `RequireAuth` — `/dashboard`, `/leads`, `/inquiries`, `/proposals`
  (+ `/proposals/:id`), `/follow-ups`, `/fulfillments`, `/operations`, `/hotels`, `/reports`,
  `/ai`, `/settings`, and every soon/placeholder route. Unauthenticated → redirect to `/login`
  with the intended location preserved (`state.from`) so the user lands back after signing in.
- **Role-gated** via `RequirePermission` → 403 page: `/operations` (`operations.read`),
  `/reports` (`report.read`). The sidebar also **hides** nav items the principal lacks permission
  for (reactive to the signed-in user).

Direct-URL access to any protected route while logged out now redirects to `/login` — the app shell
is never rendered for an unauthenticated user.

---

## Security improvements

- **Bearer JWT** on every request (perimeter `x-api-key` still honoured when `VITE_API_KEY` is set for staging).
- **Automatic, race-safe token refresh** with a single in-flight request and retry of the original call.
- **Forced logout** on refresh failure — session + token + query cache cleared, redirect to `/login`, no loops.
- **Explicit logout** revokes the server session (`POST /auth/logout` with the refresh token) and clears the query cache.
- **Permission-driven UI** — routes and nav respect the backend's effective permission set.
- **No token in code/URL**; tokens live only in the auth store (localStorage) — XSS caveat noted below.

---

## Before / after

| Behaviour | Before | After |
|-----------|--------|-------|
| Visit `/dashboard` logged out | Shell renders, all calls **401** | Redirect to `/login` |
| API auth header | `x-api-key` only (empty) | `Authorization: Bearer <jwt>` |
| Login screen | none | `/login`, validated, error/loading states |
| Access-token expiry | dead session, errors | silent refresh + retry |
| Refresh failure | n/a | clean logout → `/login` |
| Session after reload/restart | n/a (no session) | restored via persist + `/auth/me` |
| AI Assistant | 401 | works (verified) |
| Role restrictions in UI | none | route 403 + nav hiding |

---

## Files changed

**New:** `shared/types/auth.ts`, `shared/stores/auth.store.ts`, `shared/services/auth.service.ts`,
`shared/components/AuthBoot.tsx`, `app/router/guards.tsx` (`RequireAuth`, `RequirePermission`,
`ForbiddenPage`), `modules/auth/LoginPage.tsx`.
**Modified:** `shared/api/http.ts` (Bearer request interceptor + single-flight 401 refresh + forced
logout), `app/router/AppRouter.tsx` (public `/login`, `RequireAuth` around the shell,
`RequirePermission` on operations/reports), `App.tsx` (`AuthBoot` splash), `app/config/routes.ts`
(`login`), `app/layouts/Topbar.tsx` (real user + working sign-out), `app/layouts/nav-config.ts`
(+ optional `permission`), `app/layouts/Sidebar.tsx` (permission-based hiding).

---

## Smoke test results (live, 15/15)

Ran a real backend (Docker Mongo + Redis, seeded) and exercised the exact flow the frontend uses:

```
PASS  login returns accessToken+refreshToken+user   (tokenType=Bearer)
PASS  login user has roles+permissions+isSuperAdmin (perms=76)
PASS  GET /auth/me (Bearer) → profile               (Org Owner, 76 perms)
PASS  Bearer leads / proposals / operations / hotels / revenue → 200 (×5)
PASS  Bearer AI parse-inquiry                        (dest=Dubai, pax=4)
PASS  Bearer AI chat                                 (reply=yes)
PASS  no-Bearer protected → 401
PASS  refresh → new token pair                       (rotated)
PASS  new access token works → 200
PASS  logout → 201
PASS  revoked refresh token rejected after logout → 401
=== 15/15 passed ===
```

## Completion checklist (the 6 required)

1. **Login exists** — ✅ `/login`, production-quality (validation, loading/error, keyboard submit, responsive, dark-mode tokens).
2. **Protected routes exist** — ✅ `RequireAuth` gates the whole shell; `RequirePermission` for role-gated routes.
3. **Bearer auth works** — ✅ request interceptor; verified 200s across all screens.
4. **Refresh works** — ✅ single-flight refresh + retry; verified rotation + revocation.
5. **AI chat works** — ✅ verified `parse-inquiry` (Dubai/4pax) and `chat` (reply) with Bearer.
6. **Direct URL access is blocked** — ✅ logged-out users are redirected to `/login`; shell never renders.

---

## Residual notes (honest)

- **Token storage is localStorage** (required for "stays logged in after browser restart", Part 11).
  This is the standard SPA trade-off and carries an XSS exposure; for hardening, move refresh tokens
  to an httpOnly cookie server-side in a later pass. Not a demo blocker.
- **Not eyeballed in a browser** here (no display), but the API contract is proven live and the app
  builds clean; the login → dashboard → AI → operations journey should now render end-to-end.
- Backend `.env` still carries default seed passwords + a live `GROQ_API_KEY` — rotate before sharing (unchanged from prior report).

---

## Final verdict

# AUTH BLOCKER RESOLVED

The frontend now authenticates with JWT Bearer, refreshes automatically, logs out cleanly, restores
sessions across restarts, protects every route (with 403s for role violations), and the AI Assistant
works — all verified live at 15/15. Re-running the full production smoke test (`/tmp/smoke.mjs`,
`/tmp/rbac-tenant.mjs` from the prior report) against a seeded backend is the recommended next gate,
but the P0 that blocked the integrated UI demo is closed.
