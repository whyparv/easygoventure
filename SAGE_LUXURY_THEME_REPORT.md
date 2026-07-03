# Phase 3.8 — Sage Luxury Design System

> Reskin from a generic SaaS blue theme to a **boutique luxury travel** palette
> (Aman / Six Senses mood): sage greens, ivory, soft pink accents. Implemented as
> **semantic design tokens** — no hardcoded colours — so every screen updates at once.

**Gates:** `tsc` ✓ · `eslint` ✓ · `vite build` ✓.
**Accessibility:** WCAG AA verified in **both light and dark** — all sampled pairs pass.

---

## Old → New palette

| Role | Old (SaaS blue) | New (Sage Luxury) |
|------|-----------------|-------------------|
| Primary | `#1E3A8A`-ish blue (`222 47% 30%`) | **Sage green `#3F6F63`** |
| Secondary | — | **`#5F8E83`** |
| Accent | neutral gray | **Pink `#E9A7A2`** |
| Soft accent | — | **Light pink `#F5D9D5`** |
| Background | white / cool gray | **Ivory `#FAFAF8`** + warm ivory canvas |
| Text | cool `#1F2937` | **`#1F2A28`** (green-charcoal) |
| Border | cool gray | **`#E8ECEA`** |
| Success / Warning / Danger | generic | `#4F8A5B` / `#D9A441` / `#C65B5B` |
| Sidebar | dark navy | **Green `#3F6F63`**, ivory text, **pink active** |

Charts + avatar palettes were also rebranded off their bright blues (`#3b5bdb` → sage set).

---

## Token mapping (single source: `globals.css` → Tailwind)

Every colour is `--token: "H S% L%"` consumed as `hsl(var(--token))` in `tailwind.config.ts`.

| Token | Light | Purpose |
|-------|-------|---------|
| `--background` | `60 17% 98%` | ivory base |
| `--surface` | `45 25% 96%` | warm canvas behind cards |
| `--card` | `0 0% 100%` | white surfaces |
| `--foreground` | `169 15% 14%` | text |
| `--muted / -foreground` | `150 16% 94%` / `168 12% 40%` | subtle bg / secondary text |
| `--border / -strong` | `150 10% 92%` / `84%` | hairlines |
| `--primary / -foreground` | `165 28% 34%` / ivory | brand green |
| `--secondary / -foreground` | `166 20% 46%` / ivory | secondary green |
| `--pink / -foreground` | `4 62% 77%` / dark | accent pink |
| `--pink-soft / -foreground` | `8 60% 90%` / rose | light-pink surfaces (secondary buttons) |
| `--success/warning/danger/info` | brand hues | status |
| `--*-strong` (new) | darker text variants | **WCAG-safe status badge text** |
| `--sidebar` | `165 28% 34%` | green rail |
| `--sidebar-foreground / -muted` | `150 22% 90%` / `20% 91%` | nav text / labels |
| `--sidebar-active` | `4 62% 77%` | **pink active pill** |
| `--sidebar-hover` | `165 24% 40%` | subtle lift (≈ white 8%) |

New Tailwind colours added: `secondary`, `pink`, `pink-soft`, and `.strong` variants of
`success/warning/danger/info`. Dark mode mirrors every token in a deep green-charcoal key.

---

## Component library changes (token-only)

- **Sidebar:** green background, ivory nav text, **active item = solid pink pill with dark text**
  (readable), subtle green hover.
- **Buttons:** Primary = green, **Secondary = light pink**, Ghost = transparent, Danger = rose.
- **Cards:** white surfaces on warm ivory, hairline borders, soft shadows (unchanged spacing).
- **Badges / status:** added **`sage`** (inquiries) and **`pink`** (leads) tones; status language
  now Lead → pink, Inquiry → sage, Proposal → green, Booked → success, Cancelled → danger.
- **AI Workspace bubbles:** user = green, assistant = ivory (bordered), assistant avatar = pink.
- **Charts / avatars:** rebranded to the sage categorical set.

## Screens updated
Because the theme is token-driven, **all screens** re-skin automatically: Login/Signup, Dashboard,
Leads (+ dialog/drawer), Inquiries, Proposals + **Proposal Viewer**, Follow-ups, Fulfillments,
Operations, Hotel Catalog, **AI Workspace**, Reports, Settings, and every shared UI primitive
(Button, Badge, Card, Modal, Drawer, Tabs, Inputs, MetricCard, Pagination, Skeleton…).

---

## Accessibility / contrast validation (measured, WCAG AA)

Ratios computed from the actual token values (relative luminance, 4.5:1 normal / 3:1 large):

**Light mode — all pass**
```
Body text / ivory ............... 14.46:1   Primary button text / green ..... 5.54:1
Muted text / card ............... 5.17:1    Secondary button / light pink ... 7.45:1
Muted text / surface ............ 4.78:1    Assistant icon / pink ........... 6.98:1
Nav text / sidebar .............. 4.70:1    Active pink pill (dark text) .... 6.98:1
Section label / sidebar ......... 4.79:1
Badges: success 6.78 · warning 6.21 · danger 6.82 · info 5.83 · proposal 5.03 · sage 4.88 · lead 12.75
```

**Dark mode — all pass**
```
Body 15.44 · Muted/card 6.31 · Primary btn 6.85 · Nav 11.38 · Section label 6.76 ·
Active pill 7.05 · success 6.03 · warning 6.49 · danger 5.28
```

**Refinements made during validation** (initial failures fixed):
- Sidebar active pink text on green failed (2.83:1) → changed to a **pink pill with dark text** (6.98:1).
- Section labels on green → brightened `--sidebar-muted` (→ 4.79:1).
- `success/warning/danger/info` badge text on soft tints failed (2.07–3.55:1) → added darker
  `--*-strong` text tokens (now 5.8–6.8:1); dark-mode danger lightened to clear 4.5:1.

---

## Notes / risks
- **Secondary buttons are now light pink** everywhere (per spec) — pale and elegant, but a global
  visual change; easy to dial back to a neutral if preferred (one token/variant).
- Avatar + chart palettes are a **fixed brand categorical set** (documented hexes), not arbitrary —
  the only intentional non-token colours, kept on-brand.
- **Not eyeballed in a browser here** (no display) — contrast is validated numerically and both
  themes build clean; a quick visual pass is recommended before the client demo.

## Final verdict

# THEME READY

The platform now reads as a calm, premium boutique travel CRM — sage greens, ivory, and soft pink —
delivered entirely through semantic tokens (light + dark), with **every sampled contrast pair passing
WCAG AA** in both modes. No generic blue remains.
