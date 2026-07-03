# Architecture

DMC CRM is a **modular monolith**. A single deployable backend hosts independent
feature modules that communicate through well-defined service boundaries. This keeps
operational complexity low today while leaving a clean seam to extract modules into
separate services later.

## Why a modular monolith

- One repo, one deploy, one database — fast to build and operate at this stage.
- Strong module boundaries (each feature owns its controllers/services/DTOs) mean a
  module can be lifted into its own service without a rewrite when scale demands it.
- Shared cross-cutting concerns (auth, logging, validation, error handling) live once
  in `common/` and `config/`.

## Backend layering

```
HTTP ─▶ Controller ─▶ Service (business logic) ─▶ Mongoose models (data access)
                         │
                         └─▶ Queues (BullMQ) for async work
```

- **Controllers** handle HTTP only: validation (DTOs), auth guards, response shape.
- **Services** own business rules. They throw `DomainException` subclasses, never raw
  HTTP errors.
- **Mongoose models** (injected per feature module) are the data-access gateway; the
  shared connection is owned by `DatabaseModule`.
- **Global pipeline**: `ValidationPipe` → `RolesGuard`/`JwtAuthGuard` → handler →
  `ResponseInterceptor` (success envelope) → `AllExceptionsFilter` (error envelope).

## Module boundaries

Each feature module under `backend/src/modules/<feature>` is self-contained. Modules
depend on each other only through exported providers — never by reaching into another
module's internals. Shared primitives live in `common/`.

## Frontend layering

```
app/      → shell: providers, router, layouts, guards, config
modules/  → feature screens (lazy-loaded), one folder per domain
shared/   → cross-feature building blocks (ui, form, hooks, services, stores, types)
```

- **State**: server state via TanStack Query; client/UI state via Zustand.
- **API access**: a single Axios instance (`shared/services/api.ts`) with token
  injection + transparent refresh.
- **Forms**: React Hook Form + Zod resolvers, with reusable `Form*` controls.

## Async & infrastructure

- **Redis** backs both caching and the BullMQ queues.
- **Queues** (`notifications`, `reports`, `followups`) are registered as infrastructure;
  processors are added per feature as needed.
- **Health**: `/api/health` aggregates MongoDB + Redis liveness via Terminus.

## Future service extraction

To extract a module (e.g. `notifications`) into its own service:

1. Move the module folder into a new app.
2. Replace in-process calls with a transport (HTTP/gRPC/queue events).
3. Give it its own schema or database.

The boundaries enforced here make this a mechanical change rather than a redesign.
