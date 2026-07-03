# Conventions

## General

- **TypeScript strict everywhere.** No `any` (ESLint enforces `no-explicit-any` as an
  error). Prefer precise types and `unknown` + narrowing over casts.
- **SOLID + Clean Architecture.** Keep HTTP/framework concerns at the edges; business
  rules in services; data access behind Mongoose models.
- **Feature-based modules.** Co-locate everything a feature needs in its module folder.

## Naming

- Files: `kebab-case.ts` for backend (`auth.module.ts`), `PascalCase.tsx` for React
  components, `camelCase.ts` for hooks/utilities.
- Backend classes: `PascalCase` with role suffix (`UsersService`, `AuthGuard`).
- Mongoose schemas/classes: `PascalCase` singular (`Agency`); collections are the
  lower-cased plural Mongoose default (`agencies`).

## Backend

- Controllers are thin; no business logic in them.
- Throw `DomainException` subclasses (`EntityNotFoundException`, etc.) — never raw
  `HttpException` from services.
- DTOs use `class-validator` decorators; the global `ValidationPipe` whitelists and
  transforms input.
- Every document exposes `id` (Mongo `_id`) plus `createdAt` / `updatedAt` (enable
  `timestamps: true` on every schema).
- Document endpoints with `@nestjs/swagger` decorators.

## Frontend

- Server state → TanStack Query; UI/client state → Zustand. Don't duplicate server
  state into Zustand.
- All network calls go through `shared/services/api.ts`.
- Forms use React Hook Form + Zod via `@hookform/resolvers/zod` and the shared `Form*`
  controls.
- Route paths come from `app/config/routes.ts` — no hard-coded path strings.
- Components are function components; styling via Tailwind + `cn()` helper.

## Git & commits

- Conventional Commits, enforced by commitlint:
  `type(scope): subject` — e.g. `feat(agencies): add contact list endpoint`.
- Pre-commit runs `lint-staged` (Prettier). Keep PRs small and focused.

## Environment

- Never commit real secrets. `.env.example` is the source of truth for required vars;
  backend validates them with Zod at boot and refuses to start if invalid.
