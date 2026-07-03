# DMC CRM

Production-grade scaffold for a **B2B Travel Operations CRM** (Destination Management
Company). Built as a **modular monolith** with a clean seam toward future service
extraction.

> This is a foundation, not a product. It contains no business logic, demo data, or mock
> APIs — only the enterprise-ready structure a team builds on top of.

---

## Tech stack

| Layer        | Technology                                                                      |
| ------------ | ------------------------------------------------------------------------------- |
| **Frontend** | React 19, Vite, TypeScript, React Router, TanStack Query, Zustand, React Hook Form, Zod, Axios, TailwindCSS, Lucide |
| **Backend**  | NestJS, TypeScript, MongoDB, Mongoose, Redis, BullMQ, JWT + RBAC, Swagger, Helmet, Pino |
| **Tooling**  | npm workspaces, ESLint, Prettier, Husky, lint-staged, commitlint, Docker        |

---

## Repository layout

```text
dmcCRM/
├── apps/                  # reserved for future extracted services
├── frontend/              # React 19 + Vite SPA
├── backend/               # NestJS modular monolith
├── packages/              # shared libraries (future)
├── docker/                # Dockerfiles, compose, nginx
├── docs/                  # architecture & conventions
├── scripts/               # bootstrap & automation
├── .github/               # CI workflows, PR template
└── README.md
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[docs/CONVENTIONS.md](docs/CONVENTIONS.md) for details.

### Backend (`backend/src`)

```text
common/      # BaseEntity, DTOs (Pagination/ApiResponse/ApiError), filters, interceptors, exceptions
config/      # ConfigModule + Zod env validation + typed namespaces
database/    # Mongoose connection (DatabaseModule) + roles seed
redis/       # shared ioredis connection + service
queues/      # BullMQ root + notifications/reports/followups queues
jobs/        # queue processors (added per feature)
health/      # /api/v1/health (MongoDB via Terminus)
modules/     # auth, users, agencies, inquiries, quotes, followups, bookings, vouchers, analytics, notifications
main.ts      # bootstrap: Helmet, CORS, compression, ValidationPipe, Swagger, Pino
```

### Frontend (`frontend/src`)

```text
app/         # router, providers, layouts (Sidebar/Topbar/AdminLayout), guards, config
modules/     # one folder per domain screen (lazy-loaded)
shared/      # components (ui + form), hooks, utils, services (api/queryClient), stores, types, validators
styles/      # Tailwind globals + dark-mode tokens
main.tsx     # entry
```

---

## Prerequisites

- **Node.js 20+** and **npm 10+** (`.nvmrc` pins 20)
- **MongoDB** (a connection string — e.g. MongoDB Atlas; configured via `MONGODB_URI`)
- **Docker** + Docker Compose (for Redis)

---

## Quick start

```bash
# 1. Clone and enter
cd dmcCRM

# 2. One-shot bootstrap: installs deps, starts Redis, seeds RBAC roles into MongoDB
./scripts/bootstrap.sh

# 3. Run backend + frontend together
npm run dev
```

- Frontend → http://localhost:5173
- Backend  → http://localhost:8080/api/v1  (all endpoints are under `/api/v1`)
- API docs → http://localhost:8080/api/docs
- Health   → http://localhost:8080/api/v1/health

### API contract

- Every endpoint returns one envelope: `{ success, data, message, timestamp }`.
  Paginated endpoints put `{ items, meta }` in `data`.
- All routes live under `/api/v1`. The Swagger doc declares this server prefix,
  so "Try it out" hits the correct paths.
- When `API_KEY` is set, all endpoints except `/api/v1/health` (and the Swagger UI)
  require the `x-api-key` header. Leave `API_KEY` empty to disable the gate locally.
- `DELETE /api/v1/leads/:id` is a **soft delete** (`isDeleted`/`deletedAt`); related
  proposals, fulfillments, follow-ups, and activities are preserved.

---

## Manual setup

```bash
# Install all workspaces
npm install

# Environment files
cp backend/.env.development backend/.env
cp frontend/.env.development frontend/.env

# Start infrastructure only (Redis; MongoDB is external via MONGODB_URI)
npm run docker:up        # or: docker compose -f docker/docker-compose.yml up -d redis

# Database (MongoDB is schemaless — no migrations; just seed baseline roles)
npm run seed -w backend  # seeds RBAC roles only

# Develop
npm run dev              # backend + frontend
npm run dev -w backend   # backend only
npm run dev -w frontend  # frontend only
```

---

## Docker usage

Run frontend, backend, and redis in containers (MongoDB stays external via `MONGODB_URI`):

```bash
npm run docker:build
npm run docker:up
```

| Service  | URL / Port                     |
| -------- | ------------------------------ |
| frontend | http://localhost:8081          |
| backend  | http://localhost:8080/api/v1   |
| redis    | localhost:6379                 |

Tear down: `npm run docker:down`.

> Set `MONGODB_URI`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` via your shell or a
> root `.env` before `docker:up` in any shared environment.

---

## Common scripts

| Command                          | Description                              |
| -------------------------------- | ---------------------------------------- |
| `npm run dev`                    | Backend + frontend in watch mode         |
| `npm run build`                  | Build both apps                          |
| `npm run lint`                   | Lint both apps                           |
| `npm run format`                 | Prettier write across the repo           |
| `npm run seed -w backend`        | Seed baseline RBAC roles into MongoDB    |
| `npm run docker:up` / `:down`    | Start / stop the Docker stack            |

---

## Data model

The data layer uses **MongoDB via Mongoose**. The shared connection lives in
[backend/src/database/database.module.ts](backend/src/database/database.module.ts); feature
modules declare their own schemas with `MongooseModule.forFeature([...])` as they are built.

Planned collections — `Role`, `User`, `Agency`, `AgencyContact`, `Inquiry`, `Quote`,
`Followup`, `Booking`, `Voucher`, `AuditLog` — each exposing `id` (Mongo `_id`) plus
`createdAt` / `updatedAt` (`timestamps: true`). The baseline `Role` documents are created
by `npm run seed -w backend`.

---

## Conventions

- **Conventional Commits** (enforced by commitlint), e.g. `feat(agencies): ...`
- **Strict TypeScript**, no `any` (ESLint error)
- **Feature-based modules**, SOLID, clean architecture
- Pre-commit hooks via Husky + lint-staged (Prettier)

Full details in [docs/CONVENTIONS.md](docs/CONVENTIONS.md).

---

## License

Proprietary — all rights reserved.
