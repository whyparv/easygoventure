# Hotel Catalog Hardening Report

> **Goal:** make the hotel catalog file-based and environment-independent — hotel
> APIs keep working even when the database is unreachable (exactly the Atlas
> outage we just hit).

**Build status:** `nest build` ✓ · `eslint --max-warnings 0` ✓ · `tsc --noEmit` ✓ (0 errors)
**Runtime status:** file-based fallback smoke-tested with **no database connection** — 151 records served.

---

## What changed, at a glance

```
Raw .docx ──pipeline──► assets/catalog/hotels/dubai.hotels.json   ◄── single source of truth
                        (HotelCatalogRecord[], validated at build)
                                     │
                 ┌───────────────────┴────────────────────┐
                 ▼                                          ▼
        HotelCatalogSeeder                        CatalogLoaderService
        (npm run seed:hotels /                    (loads + validates + caches
         seed:catalog → MongoDB)                   in memory at startup)
                 │                                          │
                 ▼                                          ▼
        Hotel APIs  ── DB reachable? ──► database ── else ──► in-memory file catalog
```

The database and the fallback can never drift, because both read the **same file**.

---

## Task 1 — Move the normalized dataset

- Canonical dataset now lives at **`assets/catalog/hotels/dubai.hotels.json`** (151 records).
- The pipeline emits it directly; the old `assets/generated/hotels.cleaned.json` (and its
  now-empty directory) was **removed** so there is exactly one source of truth. Every consumer
  (seeder + runtime fallback) reads this one file.

## Task 2 — `HotelCatalogRecord` schema

Defined in [`hotel-catalog-record.ts`](dmcCRM/backend/src/modules/hotels/catalog/hotel-catalog-record.ts):

```ts
interface HotelCatalogRecord {
  name: string;
  city: string;
  country: string;
  rating: number;    // integer 1–5 (the Dubai dataset is 3–5)
  address?: string;  // optional
}
```

The file is stored in exactly this shape. A separate **`HotelView`** shape is what the API
returns (adds a stable `id`, `category: 'HOTEL'`, `starRating`, `isActive`, and — only on the
fallback path — `source: 'file'`), so callers get a consistent contract regardless of source.

## Task 3 — Validate the dataset during build

- The pipeline maps its cleaned output to `HotelCatalogRecord[]` and runs
  `validateHotelCatalogRecord` over **every** record before writing. **A single invalid row fails
  the build** (`process.exit(1)`) rather than shipping a broken catalog — the build log now prints
  `Validated : 151 record(s) against HotelCatalogRecord`.
- Validation is centralized in one function (`validateHotelCatalogRecord`) reused at build time,
  at load time, and by `parseHotelCatalog`, so the contract is enforced identically everywhere.

## Task 4 — `CatalogLoaderService`

[`catalog-loader.service.ts`](dmcCRM/backend/src/modules/hotels/catalog/catalog-loader.service.ts) —
a NestJS `@Injectable` implementing `OnModuleInit`:

- **Load** the JSON from disk once at startup (`onModuleInit`), resolved relative to the compiled
  module so it works from both `src/**` (ts-node) and `dist/**` (nest build).
- **Validate** each record on load; invalid rows are counted and skipped (logged), never fatal.
- **Cache** the result in memory as `HotelView[]` plus an `id → view` map for O(1) get-by-id.
- **Never throws** — a missing/corrupt file leaves the cache empty and logs an error, so app boot
  is never blocked by the fallback dataset. Exposes `isLoaded()`, `count()`, `all()`, `getById()`.
- Ids are **deterministic** (`sha256(name|city)`, 24 hex chars), so a list response and a later
  get-by-id agree without any database.

## Task 5 — Hotel APIs: database if available, JSON fallback if not

[`hotels.service.ts`](dmcCRM/backend/src/modules/hotels/hotels.service.ts) now resolves the source
per request:

- **DB-first:** if the mongoose connection is live (`readyState === 1`), query MongoDB as before —
  identical filtering (star/city/area/search), sorting and pagination. Behavior unchanged on the
  happy path.
- **Automatic fallback:** if the connection is **down**, or a query throws a **connectivity error**
  (`MongooseServerSelectionError`, `MongoNetworkError`, `MongoNotConnectedError`, pool-cleared,
  timeout, …), the service transparently serves from `CatalogLoaderService`. Non-connectivity
  errors (e.g. a genuine validation error) still propagate — the fallback only masks infrastructure
  outages, not bugs.
- The **same filters, sort and pagination** are applied in-memory over the cached views, so the
  response contract (`PaginatedResponse`) is identical. Get-by-id works in both modes (Mongo
  ObjectId → DB; catalog hash id → file).
- Fallback responses carry `source: 'file'` so a client can tell it's browsing the offline catalog.

Verified live (no DB): 151 loaded · deterministic ids round-trip · filters correct
(5-star = 50, area~"palm" = 15, search~"atlantis" = 2) · malformed rows skipped, not fatal.

## Task 6 — This report

You're reading it.

---

## Files

**New**
- `modules/hotels/catalog/hotel-catalog-record.ts` — `HotelCatalogRecord` + `HotelView`,
  `validateHotelCatalogRecord`, `parseHotelCatalog`, `readHotelCatalogFile`,
  `hotelCatalogRecordId`, `recordToView`, canonical path constants.
- `modules/hotels/catalog/catalog-loader.service.ts` — the in-memory loader/validator/cache.
- `assets/catalog/hotels/dubai.hotels.json` — the canonical 151-record dataset.

**Changed**
- `modules/hotels/hotels.service.ts` — DB-first with automatic file fallback.
- `modules/hotels/hotels.module.ts` — provides & exports `CatalogLoaderService`.
- `modules/hotels/dto/hotel-response.dto.ts` — documents the optional `source` field.
- `database/hotel-catalog/hotel-catalog.pipeline.ts` — emits + validates `dubai.hotels.json`.
- `database/hotel-catalog/hotel-catalog.seeder.ts` — reads the canonical file (maps
  `rating → starRating`, `address → area`); DB and fallback share one source.
- `database/hotel-catalog/hotel-catalog.seed-cli.ts`, `database/seed-catalog.ts` — doc paths.

**Removed**
- `assets/generated/hotels.cleaned.json` (+ empty `assets/generated/`) — superseded.

---

## Regenerating & seeding

- **Rebuild the dataset** from the source asset: `npm run hotels:build` (offline; validates and
  writes `dubai.hotels.json`; fails the build on any invalid record).
- **Seed into MongoDB** (idempotent, upserts on `name + city`): `npm run seed:hotels` or the master
  `npm run seed:catalog`. Because the DB now seeds from the same file the fallback serves, the two
  are guaranteed consistent.

## Note on the earlier Atlas block

This hardening is precisely why the pending `seed:catalog` (blocked by Atlas IP access) is no longer
a hard dependency for **browsing** the hotel catalog: with the database unreachable, the hotel APIs
now serve the full 151-hotel catalog from the bundled JSON. Seeding is still required to sync the
new **permissions/roles** and to make hotel data queryable from the database itself.
