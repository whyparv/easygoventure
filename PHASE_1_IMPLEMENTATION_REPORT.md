# PHASE 1 — Implementation Report

> **DMC CRM → AI-first DMC Operations Platform.** This report documents the Phase 1
> foundation delivered on the existing NestJS modular monolith. Everything below was
> built on top of the current architecture (controller → service → repository →
> Mongoose), reuses the established `{ success, data, message, timestamp }` envelope,
> soft-delete conventions, `DomainException` machine codes, and the existing AI
> capabilities — **nothing was rewritten**.

**Build status:** `nest build` ✓ · `npm run lint` (`--max-warnings 0`) ✓ · `tsc --noEmit` ✓ (0 errors)
**Scope delivered:** Authentication · RBAC · Organizations · Departments · Users · Service Catalog · Hotel Catalog (cleaned + seeded) · Vendor Management · Inquiry Domain · AI Copilot Infrastructure · Audit Framework.
**Explicitly out of scope (not built):** WhatsApp, Payments, Invoices, Accounts, Vouchers, Booking Engine, pricing/markup engine.

---

## 1. Files Created

### Hotel data pipeline (`backend/src/database/hotel-catalog/`)
A real, auditable pipeline — **Raw `.docx` → Parse → Normalize → Validate → Deduplicate → Clean JSON → Seed** — not a raw dump.

| File | Purpose |
|------|---------|
| `docx-reader.ts` | Dependency-free `.docx` reader (minimal ZIP central-directory parser + `zlib.inflateRaw`). No new runtime dependency. |
| `hotel-catalog.types.ts` | Shared pipeline types (`RawHotelRecord`, `NormalizedHotel`, `CleanHotel`, stats). |
| `hotel-catalog.parser.ts` | `HotelCatalogParser` — walks the doc in order, attributes each table row to its ⭐ star section. |
| `hotel-catalog.normalizer.ts` | `HotelCatalogNormalizer` — name/area cleanup, rating resolution, `city=Dubai`/`country=UAE` defaults. |
| `hotel-catalog.validator.ts` | `HotelCatalogValidator` — requires `name`+`starRating`; collects rejections + warnings. |
| `hotel-catalog.deduplicator.ts` | `HotelCatalogDeduplicator` — exact-dup removal, **rating-conflict flagging**, near-duplicate detection (never blind-merges). |
| `hotel-catalog.pipeline.ts` | Orchestrator + CLI → writes `assets/generated/hotels.cleaned.json` + `HOTEL_DATA_REPORT.md`, prints count + 20-row sample. |
| `hotel-catalog.seeder.ts` | `HotelCatalogSeeder` — idempotent bulk upsert of the **cleaned JSON** keyed on `name + city`. |
| `hotel-catalog.seed-cli.ts` | Standalone `npm run seed:hotels` entrypoint. |

### Foundation / cross-cutting
| File | Purpose |
|------|---------|
| `common/crypto/password.util.ts` | scrypt password hashing (memory-hard KDF, no native dep) + constant-time verify. |
| `common/crypto/token.util.ts` | Secure random tokens + SHA-256 hashing for refresh/reset tokens. |
| `modules/auth/rbac/permissions.ts` | The permission catalog (`PERMISSIONS`, `PERMISSION_CATALOG`, `PermissionScope`). |
| `modules/auth/rbac/system-roles.ts` | System + business role → permission matrix; seed department list. |
| `modules/auth/decorators/require-permissions.decorator.ts` | `@RequirePermissions` / `@RequireAnyPermission`. |
| `modules/auth/guards/permissions.guard.ts` | Permission-driven authorization guard. |

### New modules (schema · repository · service · controller · DTOs · module)
`organizations` · `departments` · `permissions` · `roles` · `users` · `audit` · `service-catalog` (categories + services) · `vendors` (vendors + vendor-rates) · `hotels` (read API over the catalog) · `inquiries` (new first-class aggregate).

### Auth module additions
`auth.service.ts`, `auth.controller.ts`, `auth.repository.ts` (sessions + password-resets), `dto/auth.dto.ts`, `schemas/session.schema.ts`, `schemas/password-reset.schema.ts`; `strategies/jwt.strategy.ts` rewritten to resolve a fresh principal per request.

### AI Copilot infrastructure (`modules/ai/`)
`ai-copilot.controller.ts`, `ai-copilot.service.ts`, `ai-copilot.repository.ts`, 4 schemas (`ai-session`, `ai-message`, `ai-action`, `ai-approval`), 5 copilot DTOs.

### Master seed
`database/seed-catalog.ts` — one idempotent command for the whole catalog + tenant bootstrap.

**Totals:** ~130 new `.ts` files; backend now has **223** source files.

---

## 2. Files Modified

| File | Change |
|------|--------|
| `app.module.ts` | Registered 11 new modules (Audit, Organizations, Departments, Permissions, Roles, Users, ServiceCatalog, Vendors, Hotels, Inquiries) alongside the existing workflow modules. |
| `modules/auth/auth.module.ts` | Wires `UsersModule`, JWT, sessions/reset schemas, `AuthController`, and the **global guard chain** JWT → Permissions → Roles. |
| `modules/auth/auth.types.ts` | `AuthenticatedUser` now carries `organizationId`, `departmentId`, `roles[]`, `permissions[]`, `isSuperAdmin`; `JwtPayload` carries tenant + token type. |
| `modules/auth/guards/roles.guard.ts` | Updated to the new `roles[]` principal (permission-driven auth is primary). |
| `config/env.validation.ts`, `config/configuration.ts` | Added `auth` config namespace (lockout, refresh TTL, reset TTL). |
| `modules/leads|proposals|followups|fulfillments/*.controller.ts` | **Removed blanket `@Public()`**, added `@RequirePermissions(...)` per route. |
| `modules/ai/ai.controller.ts` | Legacy endpoints kept intact but now require `ai.use` (no longer `@Public()`). |
| `modules/ai/ai.module.ts` | Registers the copilot schemas, controller, service, repository. |
| `database/hotel-catalog/hotel-catalog.seeder.ts` | Model typing aligned to standalone Mongoose. |
| `tsconfig.json` | Removed the deprecated `baseUrl` + unused `paths` (the workspace resolved **TypeScript 6.0.3**, which turns the `baseUrl` deprecation into a hard error that halted `tsc`; `nest build` uses local **TS 5.9.3**). No source used the path aliases. This unblocks both compilers. |
| `package.json` | Added scripts: `hotels:build`, `seed:hotels`, `seed:catalog`. |
| `common/filters/all-exceptions.filter.ts`, `health/mongo.health.ts`, `modules/leads/leads.service.ts` | Small, behavior-preserving lint fixes surfaced by the newer TS/typed-lint. |
| `.env.example` (+ `.env.development`/`.env.production` should mirror) | Added `AUTH_*` and `SEED_*` variables. |

---

## 3. Collections Added (18)

| Collection | Tenant-scoped | Notes |
|------------|:-------------:|-------|
| `organizations` | — (is the tenant) | slug-unique; multi-tenant root |
| `departments` | ✓ | unique `(organizationId, name)` |
| `permissions` | global | seeded catalog |
| `roles` | ✓ / global templates | `isSystem` templates + org roles; unique `(organizationId, code)` |
| `users` | ✓ (null for super-admin) | scrypt `passwordHash` (`select:false`), lockout + MFA-ready fields |
| `auth_sessions` | ✓ | hashed refresh tokens, TTL index |
| `password_resets` | — | hashed single-use tokens, TTL index |
| `service_categories` | global | Visa/Hotel/Transfer/Activity/Insurance/Package/Custom |
| `services` | ✓ | database-driven (replaces enums); required fields/docs, terms, currency |
| `vendors` | ✓ | supplier foundation |
| `vendor_rates` | ✓ | cost source (no pricing engine yet) |
| `hotel_catalog` | global reference | 151 Dubai hotels; unique `(name, city)` |
| `inquiries` | ✓ | new first-class aggregate + lifecycle |
| `audit_logs` | ✓ | append-only trail |
| `ai_sessions` / `ai_messages` / `ai_actions` / `ai_approvals` | ✓ | copilot memory + human-approval spine |

All new documents follow the existing `id / createdAt / updatedAt` + soft-delete conventions.

---

## 4. APIs Added

> All routes are under the `api` prefix, JWT-protected, and permission-gated unless marked **Public**.

**Auth** (`/auth`): `POST login` **Public**, `POST refresh` **Public**, `POST logout`, `POST forgot-password` **Public**, `POST reset-password` **Public**, `POST change-password`, `GET me`.

**Organizations** (`/organizations`): CRUD (`organization.read` / `organization.manage`; create/delete are super-admin).
**Departments** (`/departments`): CRUD (`department.*`).
**Permissions** (`/permissions`): `GET` catalog (flat or `?grouped=true`) (`permission.read`).
**Roles** (`/roles`): CRUD (`role.*`); system roles are immutable.
**Users** (`/users`): CRUD + `POST :id/roles` assign (`user.*`, `role.assign`).
**Service Catalog**: `/service-categories` (read), `/services` CRUD (`service.*`).
**Vendors**: `/vendors` CRUD, `/vendor-rates` CRUD (`vendor.*`, `vendor_rate.*`).
**Hotels** (`/hotels`): `GET` list (filter `starRating`/`area`/`city`/`search`) + `GET :id` (`hotel.read`).
**Inquiries** (`/inquiries`): CRUD + `POST :id/transition` + `POST :id/convert` (`inquiry.*`, `inquiry.convert`).
**Audit** (`/audit-logs`): `GET` (org-scoped; `audit.read`).
**AI Copilot** (`/ai/...`): `POST/GET sessions`, `GET/POST sessions/:id/messages`, `POST/GET actions`, `POST actions/:id/approve|reject|executed` (`ai.use` / `ai.approve_action`).
**AI (legacy, intact)**: `POST /ai/parse-inquiry|followup-suggestion|proposal-summary|chat|next-action` — unchanged logic, now require `ai.use`.

---

## 5. Seed Data Added

`npm run seed:catalog` (idempotent, safe to re-run) seeds, in order:

1. **Permissions** — the full permission catalog.
2. **Roles** — 20 system role templates: `SUPER_ADMIN`, `ORGANIZATION_OWNER`, `ORGANIZATION_ADMIN` + 17 business roles (Sales/Ops/Visa/Hotels/Transfers/Accounts/Support) with a curated permission matrix.
3. **Service categories** — Visa, Hotel, Transfer, Activity, Insurance, Package, Custom.
4. **Default organization** + a **SUPER_ADMIN** and an **ORGANIZATION_OWNER** user (passwords from `SEED_*` env, default `ChangeMe123!` — change immediately).
5. **Departments** — Management, Sales & Marketing, Operations, Visa, Hotels, Transfers, Accounts, Customer Support, Administration.
6. **Hotel catalog** — **151 Dubai hotels** (50×5★, 52×4★, 49×3★) from the cleaned dataset.

The hotel dataset itself is produced by `npm run hotels:build` from `assets/hotel list 3, 4 & 5 star.docx` → `assets/generated/hotels.cleaned.json` + `HOTEL_DATA_REPORT.md`. **152 parsed → 151 seeded**; one record dropped (see below).

---

## 6. Hotel Data Quality Highlights

- **152** records parsed (50/52/50 across 5/4/3★), **0** rejected, **0** missing area.
- **1 rating conflict flagged, not silently merged:** *"Holiday Inn Express Dubai Safa Park"* appears in **both** the 4★ and 3★ tables (same area, Al Wasl). The pipeline keeps the first occurrence, drops the duplicate (→ **151** final), and records the conflict in `HOTEL_DATA_REPORT.md` for business review.
- Names preserved faithfully (`One&Only`, `W Dubai – The Palm`, `Le Royal Méridien`). Full breakdown in `backend/HOTEL_DATA_REPORT.md`.

---

## 7. Breaking Changes

1. **The API is no longer open.** Every feature route now requires a valid JWT + the relevant permission. The previous state (all controllers `@Public()`, no login) is gone. Clients must authenticate via `POST /auth/login`.
2. **Legacy AI endpoints now require `ai.use`.** Their behavior/prompts are unchanged, but they are no longer anonymous.
3. **`Role` collection shape extended.** The old seed created bare `{ name, permissions }` role docs; roles now use `{ code, name, permissions, scope, isSystem, organizationId }`. Re-run `seed:catalog` (idempotent upsert by `code`).
4. **`tsconfig.json`**: `baseUrl`/`paths` removed (unused aliases) so the project compiles under the installed TypeScript 6.x/5.9.x. No import changes required.

---

## 8. Migration Notes

- **Order of operations for a fresh environment:**
  1. `npm run hotels:build` (generates the cleaned hotel JSON + data report — offline, no DB).
  2. `npm run seed:catalog` (permissions, roles, categories, org, users, departments, hotels).
  3. Log in as the seeded `SUPER_ADMIN` / `ORGANIZATION_OWNER` and change passwords.
- **Existing sales-pipeline collections are not yet tenant-scoped.** `leads`, `proposals`, `followups`, `fulfillments` retain their original schema (no `organizationId`) per the "do not break the existing modules" constraint. They are now permission-gated but remain single-tenant. Retrofitting `organizationId` onto them (and back-filling to the default org) is a clean follow-up: add the field, default it in services from `CurrentUser`, and add a data migration. The **new** `inquiries` aggregate is fully tenant-scoped and its `convert` action creates a downstream `lead`, providing the Inquiry → Lead bridge.
- **Hotel catalog is intentionally global** (shared Dubai reference data), not tenant-scoped.
- **No destructive migrations.** All seeds are upserts; existing MVP data is untouched.

---

## 9. Security Changes

- **Real authentication**: JWT access (15m) + refresh (7d) tokens; refresh tokens are stored **only as SHA-256 hashes** in `auth_sessions` with rotation on refresh and TTL auto-expiry.
- **Passwords**: scrypt (memory-hard) with per-user salt, self-describing hash format, constant-time verification; hashes are `select:false` and never serialized.
- **Account lockout**: configurable failed-attempt threshold → temporary lock (`AUTH_MAX_FAILED_LOGINS` / `AUTH_LOCKOUT_MINUTES`).
- **Password reset**: single-use, time-boxed, hash-stored tokens; reset revokes all sessions. (Email delivery is a later phase — off-production the token is returned so the flow is testable; in production the response is generic to avoid user enumeration.)
- **Permission-driven RBAC** with `Global / Organization / Department / Record` scope model; org-scope is enforced in every new service (queries filtered by `organizationId`; cross-tenant access returns *not found*). Non-super users cannot assign a super-admin role (privilege-escalation guard).
- **Fresh principal per request**: the JWT strategy re-resolves roles/permissions from the DB each request, so role changes, lockouts and deactivations take effect immediately.
- **Full audit trail**: login (success/fail), logout, password changes/resets, role assignment, org/dept/service/vendor/inquiry writes, and AI action approve/reject/execute are recorded in `audit_logs` (fire-and-forget safe — audit never breaks a business write).
- **AI stays human-in-the-loop**: `ai_actions` can never reach `EXECUTED` without an `APPROVED` `ai_approval`; the backend performs **no autonomous writes**.

---

## 10. Manual Testing Steps

Prereqs: a reachable MongoDB (`MONGODB_URI`), 32+ char JWT secrets, then:

```bash
cd backend
npm run hotels:build      # → assets/generated/hotels.cleaned.json + HOTEL_DATA_REPORT.md, prints 151 + sample 20
npm run seed:catalog      # idempotent: permissions, roles, categories, org, users, departments, hotels
npm run dev               # start the API (Swagger at /api/docs when enabled)
```

1. **Login** → `POST /api/auth/login` `{ "email": "superadmin@dmc.local", "password": "ChangeMe123!" }` → returns `accessToken`, `refreshToken`, `user` (with `permissions: ["*"]`).
2. **Authorized call** → `GET /api/auth/me` with `Authorization: Bearer <accessToken>` → your profile + effective permissions.
3. **Unauthorized is blocked** → `GET /api/leads` with no token → `401`; with a token lacking `lead.read` → `403`.
4. **Refresh/rotation** → `POST /api/auth/refresh` `{ refreshToken }` → new pair; the old refresh token is now rejected.
5. **Lockout** → 5 wrong-password logins → account temporarily locked (`ACCOUNT_LOCKED`).
6. **Password reset** → `POST /api/auth/forgot-password` (dev returns `resetToken`) → `POST /api/auth/reset-password` `{ token, newPassword }` → old sessions revoked.
7. **RBAC data** → `GET /api/permissions?grouped=true`, `GET /api/roles`, `GET /api/departments` (9 seeded).
8. **Hotels** → `GET /api/hotels?starRating=5&area=Palm%20Jumeirah` → filtered catalog.
9. **Inquiry → Lead** → `POST /api/inquiries` → `POST /api/inquiries/:id/transition {status:"READY_FOR_PRICING"}` → `POST /api/inquiries/:id/convert` → creates a `lead`, inquiry becomes `CONVERTED`.
10. **AI copilot** → `POST /api/ai/sessions` (with a `contextSnapshot`) → `POST /api/ai/sessions/:id/messages` (persisted, context-grounded reply) → `POST /api/ai/actions` → `POST /api/ai/actions/:id/approve` → `POST /api/ai/actions/:id/executed`.
11. **Audit** → `GET /api/audit-logs?action=user.login` → see the recorded events.
12. **Re-run safety** → run `npm run seed:catalog` again → hotels report `0 inserted, 151 unchanged` (idempotent).

---

*Generated as part of the Phase 1 foundation build. Data-quality details for the hotel import are in `backend/HOTEL_DATA_REPORT.md`.*
