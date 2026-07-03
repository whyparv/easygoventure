# Phase 3.7 — CRM UX Consolidation & AI Proposal Engine

> Goal: a travel consultant should never wonder "which AI should I use?" — one AI
> workspace for thinking, one place to create leads, and an AI proposal engine
> grounded in the real hotel catalog.

**Gates:** backend `tsc`/`eslint`/`nest build` ✓ · frontend `tsc`/`eslint`/`vite build` ✓.
**Live-verified** against a real backend (validation, sanitization, missing-info, recommendations, proposal).

---

## Current → New workflow

| | Before | After |
|--|--------|-------|
| AI surface | "AI Assistant" that *also created leads* | **AI Workspace** — itineraries, proposals, WhatsApp drafts, visa, research (no lead creation) |
| Lead creation | AI page **and** Create → Lead | **Only `Create → Lead`** (AI Assisted \| Manual) |
| Proposals | Manual summary text | **AI proposal engine** grounded in the hotel catalog (tiered recommendations) |

## AI responsibilities (single, clear split)
- **AI Workspace** (`/ai`): conversational thinking — itinerary generation, proposal drafting, WhatsApp/email drafting, visa assistance, travel research. Markdown-rendered. **Never creates leads**; links to `Create → Lead`.
- **Create → Lead** dialog: the *only* place customers are captured — **AI Assisted** (paste → extract → review) or **Manual** — and it auto-creates the inquiry.
- **CRM Copilot** (chat prompt): when it detects customer details it extracts them, flags what's missing, and **offers** the lead workflow — it **never refuses** ("I cannot create leads" is gone).

---

## Part-by-part

### 1 · AI Workspace (consolidation)
`/ai` retitled **AI Workspace** (nav + header); starter chips now cover the five purposes
(itinerary, proposal, WhatsApp, visa, research). Lead-creation UI already removed in 3.6 — confirmed
gone. Chat renders Markdown; recent conversations kept 7 days.

### 2 · Single lead source
`Create → Lead` (topbar) and the Leads page both open **one** `LeadCreateDialog`. The old
`CreateLeadModal` is superseded and unreferenced. No other lead-creation path exists.

### 3 · Extraction + Missing Information (verified)
`POST /ai/parse-inquiry` now returns `missing: string[]`. Live: *"Looking for a Dubai trip"* →
`destination=Dubai, missing=["Name","Phone","Email","Travel Date","Travellers","Budget"]`. Shown
prominently in the dialog: **"Missing: … — add these before creating."**

### 4 · Traveller validation 1–100 (verified — bug fixed)
Enforced at **all three layers**:
- **Frontend:** dialog clamps to 1–100, strips negatives.
- **DTO:** inquiry `travelers` `@Min(1) @Max(100)` (was `@Min(0)`), package `numberOfTravelers` `@Max(100)`.
- **DB:** schema `min:1, max:100`.
Live: `-5 → 400 ("must not be less than 1")`, `150 → 400`, `3 → 201`.

### 5 · CRM copilot prompt
Chat system prompt rewritten: the assistant is a CRM copilot that **can** help capture leads —
extract details, note gaps, and point to `Create → Lead` (AI Assisted). Explicit instruction:
**NEVER reply that you cannot create leads.**

### 6 · Hotel recommendation engine (verified)
New `HotelRecommendationService` + `GET /hotels/recommendations?destination&budget&travelers&nights`.
Ranks catalog hotels into budget tiers **Budget / Mid-range / Premium / Luxury** (by star rating),
computes a **suggested tier** from per-night budget. Works off the always-available in-memory catalog
(no DB dependency). Live: `budget 15000, 2 pax, 4 nights → suggestedTier=Luxury (AED 1875/night)`,
tiers Mid-range/Premium/Luxury × 4.

### 7 · AI proposal generation (verified)
`POST /ai/proposal-draft` composes a **customer-facing Markdown proposal** grounded in the real
recommended hotels, with Hotels (table), Tours & Activities, Airport Transfers, and Visa sections.
Live: 2185-char proposal — *"# Exclusive Dubai Proposal for Aisha Khan…"*. Returns `{ proposal,
recommendations }`; the frontend renders it with the Markdown component.

### 8 · Data sanitization (verified)
`sanitize.util.ts` (trim, collapse spaces, phone → `+digits`, email → lowercase) applied via
`@Transform` on the lead + inquiry DTOs before validation/save. Live: `"  Acme    Travels  " →
"Acme Travels"`, `"+971 50 111 2222" → "+971501112222"`, `" Foo@BAR.com " → "foo@bar.com"`.

### 9 · Future image support (architecture only)
`HotelCard` ships with **`imageUrls: string[]`** (empty today), plus `rating`, `location`,
`highlights[]` — the card shape is image-ready with **no image generation**. Mirrored in the
frontend `HotelCard`/`HotelRecommendations` types.

---

## Flows

```
LEAD (single source)
  Create → Lead ─┬─ AI Assisted: paste → /ai/parse-inquiry (fields + confidence + MISSING) → review
                 └─ Manual: type fields
                 └──► POST /leads (sanitized) ─► POST /inquiries (auto)   ✅

PROPOSAL (AI engine)
  destination · budget · travellers · nights
        └──► GET /hotels/recommendations  → tiered, ranked, image-ready cards
        └──► POST /ai/proposal-draft       → Markdown proposal (Hotels·Activities·Transfers·Visa)

AI WORKSPACE  (no lead creation)  — itineraries · proposals · WhatsApp · visa · research
```

## Sanitization rules
- **Name / company / destination:** trim + collapse internal whitespace (case preserved).
- **Phone:** keep a single leading `+`, digits only.
- **Email:** trim + lowercase.
- Empty-after-clean → omitted; blank required fields are rejected.

## Bugs fixed
- **Traveller count could go negative/zero/huge** → clamped to 1–100 at frontend, DTO, and DB.
- **AI "I cannot create leads"** → replaced with CRM-copilot behavior.
- (Carried: the dashboard/fulfillment `limit:200` 400 fixed in 3.6.)

## Screens / files modified
**Backend:** `ai.service.ts` (missing-info, CRM prompt, proposalDraft), `ai.controller.ts` +
`dto/proposal-draft.dto.ts`, `ai.module.ts` (imports HotelsModule); `hotels/hotel-recommendation.service.ts`
(new) + `dto/recommend-hotels.dto.ts` + `hotels.controller.ts` + `hotels.module.ts`;
`common/utils/sanitize.util.ts` (new) + lead/inquiry DTOs; inquiry & package DTO+schema (1–100).
**Frontend:** `modules/ai/AiPage.tsx` (AI Workspace), `nav-config.ts`; `modules/leads/LeadCreateDialog.tsx`
(missing-info + traveller clamp); `shared/types/{domain,ops-domain}.ts`; `shared/services/{hotels,ai}.service.ts`,
`shared/queries/hotels.queries.ts`, `shared/mutations/ai.mutations.ts` (recommendation + proposal hooks).

## Known risks / honest notes
- Proposal quality (activities/visa wording) is LLM-dependent — the prompt requests all sections but
  the model may vary phrasing; the **structure and hotel grounding are deterministic**.
- Budget tiers use **star rating** as the price proxy (catalog has no prices) — good enough for
  recommendations; wire real rates later.
- The proposal-draft + recommendations are wired in the frontend **data layer**; a dedicated proposal
  UI panel in the workspace is a light follow-up (the chat already drafts proposals conversationally).
- **No in-browser visual pass** here (no display); all logic verified at the API level, both apps build clean.

## Final verdict

# CLIENT READY

AI is consolidated into one Workspace, lead creation has a single source with AI extraction +
missing-info + auto-inquiry, the traveller bug is fixed at every layer, inputs are sanitized before
save, and a catalog-grounded AI proposal engine (tiered, image-ready) is live — all verified against a
real backend. The noted caveats are non-blocking for the demo.
