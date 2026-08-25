# TRENIKO — Brand Guide

Scope: marketing and social only. This guide documents the brand as it already
exists in the product and extends it for external channels. It does **not**
change application branding — `frontend/public/favicon.svg` and the in-app
wordmark remain the sources of truth.

---

## 1. The mark

The TRENIKO mark is a purpose-drawn geometric **T** in white on brand blue.

It is an *evolution* of the existing app favicon, not a replacement. The favicon
set an Arial Black "T" on a rounded blue square; the marketing mark keeps the
colour, the letter and the tile, and replaces the typographic letterform with
drawn geometry so it holds together at very small sizes.

| Property | Value |
|---|---|
| Crossbar | 62 × 16 units on a 100-unit grid, 3.2u corner radius |
| Stem | 16 × 48 units, 3.2u corner radius |
| Optical centre | mark centred on y = 52, not y = 50 — the heavy crossbar pulls the visual weight upward, so the mark is nudged down 2 units |
| Tile radius | 22% (matches the product's `rounded-2xl` card language) |
| Minimum size | 24 px. Verified legible at 40 px, the Instagram avatar size |

**Why a plain T.** Four AI-generated directions were explored (see
`marketing/brand/LOGO_EXPLORATION.md`). Every added idea — overlapping planes,
segmented stems, stacked "schedule row" bars — collapsed into noise at 40 px.
At avatar size only two or three shapes survive, so the distinctiveness is
carried by the lockup and the wider visual system, not by decorating the icon.

### Files

| File | Use |
|---|---|
| `treniko-avatar.png` | 1080 × 1080, **full-bleed** blue. Instagram / social avatars. Full bleed is deliberate: a circular crop of a rounded square would clip the corners, a circular crop of a full square yields a clean disc |
| `treniko-avatar.svg` | vector source of the above |
| `treniko-avatar-rounded.png` | 1080 × 1080 rounded tile. App icons, favicons, anywhere the container is *not* circular |
| `treniko-icon.svg` | vector source of the rounded tile |
| `treniko-logo.png` / `treniko-logo-light.png` | primary horizontal lockup, charcoal wordmark, transparent background. For white and light backgrounds |
| `treniko-logo-dark.png` | same lockup, white wordmark, transparent background. For charcoal and dark backgrounds |
| `treniko-icon-blue.png` / `treniko-icon-white.png` | bare mark, transparent, no tile. For tight or monochrome placements |

All PNGs are exported with an alpha channel except the avatars, which are
intentionally opaque.

### Logo use

- Clear space on every side of the lockup: **one tile-width**. Nothing intrudes.
- Never re-colour the mark. Blue tile + white T, or the bare mark in a single
  brand colour. No gradients, no shadows, no outlines, no rotation.
- Never re-letter the wordmark. TRENIKO is always uppercase, never
  "Treniko", "TreniKo" or "TRENIKO." with a full stop.
- Never place the light lockup on blue. Use the dark (white) lockup instead.
- Do not stack the icon above the wordmark at small sizes — the horizontal
  lockup is the only approved arrangement below 400 px wide.

---

## 2. Colour

| Role | Hex | Notes |
|---|---|---|
| **Primary — brand blue** | `#0ea5e9` | wordmark, mark, single focal accent per layout |
| Primary light | `#38bdf8` | hover states, secondary accents |
| Primary dark | `#0284c7` / `#0369a1` | pressed states, gradient end |
| Deep | `#0c4a6e` | rare, dark accents on light ground |
| Tint background | `#f0f9ff` | very light section fills |
| Ink (text) | `#111827` | headlines |
| Body / muted | `#4b5563` / `#6b7280` | supporting copy — `#4b5563` on white is 7.5:1, AA at small sizes |
| Border | `#e5e7eb` | 1px rules, card edges |
| Page | `#f9fafb` | light ground |
| Surface | `#ffffff` | cards |
| Dark surface | `#030712` / `#111827` | dark-mode surfaces |

**The one-accent rule.** Each layout gets exactly one blue focal element — a
rule, a CTA, a highlighted card. Blue is the punctuation, not the paragraph.
Layouts that turn blue into the background lose the product's calm.

---

## 3. Typography

The product uses the default Tailwind system sans stack. Marketing follows the
same neutral-grotesque character.

| Context | Face | Notes |
|---|---|---|
| Exported PNG assets in this repo | **Arial Black** (900) | the only heavy grotesque guaranteed present on the build machine; also what the original favicon used |
| Canva | **Inter**, fallback Archivo or Poppins | Inter is not installed locally, so it renders only in Canva |
| Product | system-ui / Segoe UI / Helvetica / Arial | unchanged |

- **Wordmark** — uppercase, weight 900, letter-spacing ≈ +5% of the size.
- **Headlines** — bold/extrabold, `#111827`, line-height 1.1, sentence case,
  hard line breaks chosen by meaning rather than by measure.
- **Supporting copy** — regular, `#4b5563`, line-height 1.4, never below 32 px
  on a 1080-wide social canvas.
- **Labels** — small, uppercase, letterspaced, `#6b7280`.

---

## 4. Spacing and layout

- Social canvases use a **90 px left margin** on a 1080 px width (the Day 1 grid).
- Vertical rhythm in multiples of 8.
- Cards: 16 px radius (`rounded-2xl`), 1 px `#e5e7eb` border, very soft shadow
  or none. Generous internal padding — whitespace is the brand.
- The blue accent rule under a headline is 120 × 8 px.

---

## 5. Social visual principles

1. **White or near-white grounds.** The product is calm and light; the feed
   should be too. Dark frames are the exception, used for contrast beats.
2. **Type is the hero.** Most posts are a headline, a rule, a supporting line
   and a CTA. No stock photography of gyms or athletes.
3. **One idea per frame.** If a slide needs two sentences to explain, it is two
   slides.
4. **Real product only.** Screenshots come from the live app. Never mock up a UI
   that does not exist, and never fabricate numbers inside a screenshot.
5. **The grid is a system.** Same margins, same type scale, same colour roles on
   every post, so nine posts read as one brand rather than nine designs.
6. **No fitness clichés.** No dumbbells, no barbells, no muscle imagery, no
   neon, no motivational-poster tone. TRENIKO is business software.

### Prohibited in all public copy and artwork
- Invented statistics, user counts, revenue figures or testimonials
- Fake scarcity or urgency
- "AI-powered", "revolutionary", "game-changing"
- Third-party brand logos (WhatsApp, Google, Excel…) — use plain text labels
- Any language other than English
- Personal contact details of the founder
