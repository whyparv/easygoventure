# Hotel Seed — Execution Report

> Verifies, **executes**, and validates the hotel-catalog seeding against the configured
> database. This is a real run, not a code inspection — the counts below were read back
> from the live database after seeding.

## Outcome

**✅ SEEDING EXECUTED SUCCESSFULLY** against the configured **production MongoDB Atlas**
cluster (`cluster0.wcurhcv.mongodb.net`, database `dmc_crm`). `HotelCatalog` now contains
**151 hotel records**. Idempotency and the unique constraint were both verified live.

---

## Pre-flight verification (steps 1–5)

| Check | Result |
|-------|--------|
| 1. `backend/assets/generated/hotels.cleaned.json` exists | ✅ |
| 2. Record count in file | ✅ **151** — breakdown `{5-star: 50, 4-star: 52, 3-star: 49}` |
| 2b. Required samples present in file | ✅ all 6 (Burj Al Arab, Atlantis The Palm, Atlantis The Royal, Address Downtown Dubai, FIVE Palm Jumeirah, Rove Downtown Dubai) |
| 3. `HotelCatalog` schema exists | ✅ `src/modules/hotels/schemas/hotel-catalog.schema.ts` with `index({ name:1, city:1 }, { unique:true })` |
| 4. `HotelCatalogSeeder` exists | ✅ `src/database/hotel-catalog/hotel-catalog.seeder.ts` — bulk upsert `filter: { name, city }` |
| 5. Seed scripts wired | ✅ `seed:hotels → ts-node …/hotel-catalog.seed-cli.ts`, `seed:catalog → ts-node …/seed-catalog.ts` |

**Command executed for seeding:** `npm run seed:hotels` (the targeted hotel seeder — same
`HotelCatalogSeeder` that `seed:catalog` invokes, chosen to keep the write footprint to the
`hotel_catalog` collection only and avoid unrelated org/user bootstrap on the shared Atlas DB).

---

## 1. Database connected

**Yes.** A read-only connectivity gate (`countDocuments`) connected to the Atlas cluster
successfully before any write was attempted (20 s server-selection timeout; no timeout hit).

## 2. Seeder executed

**Yes** — via `npm run seed:hotels`. Output:

```
Hotel catalog seeded: 151 records (151 inserted, 0 updated, 0 unchanged)
```

## 3. Initial record count

**0** — `HotelCatalog.countDocuments()` returned `0` before seeding (the collection existed
with its unique index, but had never been populated — confirming the premise that it was
never seeded).

## 4. Final record count

**151** — read back after seeding:

```
COUNT=151
BY_RATING={"5-star":50,"4-star":52,"3-star":49}
```

Matches the expected 50 × 5-star, 52 × 4-star, 49 × 3-star.

## 5. Sample seeded records

All six required records were found in the database (queried live after seeding):

| Requested | Found in DB |
|-----------|-------------|
| Burj Al Arab | ✅ `Burj Al Arab Jumeirah` · 5★ · Jumeirah Beach Road, Dubai |
| Atlantis The Palm | ✅ `Atlantis The Palm` · 5★ · Palm Jumeirah, Dubai |
| Atlantis The Royal | ✅ `Atlantis The Royal` · 5★ · Palm Jumeirah, Dubai |
| Address Downtown Dubai | ✅ `Address Downtown Dubai` · 5★ · Mohammed Bin Rashid Blvd, Dubai |
| FIVE Palm Jumeirah | ✅ `FIVE Palm Jumeirah` · 5★ · Palm Jumeirah, Dubai |
| Rove Downtown Dubai | ✅ `Rove Downtown Dubai` · 3★ · Downtown Dubai, Dubai |

## 6. Second-run record count

**151** (unchanged). The seeder was run a second time (`npm run seed:hotels`):

```
Hotel catalog seeded: 151 records (0 inserted, 151 updated, 0 unchanged)
```
Then re-counted: `COUNT=151`, `BY_RATING={"5-star":50,"4-star":52,"3-star":49}`.

## 7. Idempotency result

**✅ PASS.** The second run inserted **0** new records (151 upserted in place) and the total
remained **151** — not 302. The seeder performs `updateOne … { upsert: true }` keyed on
`{ name, city }`, so re-running converges to the same state.

### Unique-constraint validation

**✅ PASS.** An active test inserted a duplicate of an existing record
(`name="Address Beach Resort", city="Dubai"`) directly; MongoDB rejected it with **E11000**
(duplicate key) and the count stayed **151 → 151**. Duplicates cannot be created — the
uniqueness key is **`name + city`** (unique index confirmed present with `unique: true`).

## 8. Failures encountered

**None.** Connection succeeded, both seed runs completed cleanly, all validation queries
returned the expected values, and the duplicate-rejection test behaved as required.

---

## Notes

- **Target was production Atlas.** No assumptions were made — every number above was read
  back from the live cluster. Two throwaway read-only/one-off verification scripts were used
  during validation and then removed; the pipeline itself (parser/normalizer/validator/
  deduplicator/`hotels.cleaned.json`/`HotelCatalogSeeder`/seed scripts) was **not modified**.
- **Reproduce:** from `backend/`, `npm run seed:hotels` (idempotent). To (re)generate the
  cleaned dataset first, `npm run hotels:build`. `npm run seed:catalog` seeds the full
  catalog (permissions/roles/departments/service-categories/org+users) **and** hotels via the
  same `HotelCatalogSeeder`.
- **Post-run state:** `hotel_catalog` collection = 151 documents; unique index on
  `{ name: 1, city: 1 }`; no duplicates.
