# TRENIKO — Instagram Day 01 — Run record

| Field | Value |
|---|---|
| Status | Designed, exported, caption approved — NOT PUBLISHED |
| Blocker | No browser-control tooling available in this session |
| Publication time | — (not published) |
| Live post URL | — (not published) |
| Canva design ID | `DAHSk7yIDmE` |
| Canva design title | TRENIKO — IG Day 01 — Run your coaching business |
| Canva edit URL | https://www.canva.com/d/rpEoImvZAVgEY8S |
| Canva view URL | https://www.canva.com/d/puzLR8vqmJOY_go |
| Local export | `marketing/social/day-01/final.png` |
| Export spec | PNG, 1080 × 1350, 4:5, lossless, Canva Free (regular quality) |
| Caption | `marketing/social/day-01/caption.md` |
| Rejected candidates | `marketing/social/day-01/candidates/c1.png` … `c4.png` |

## Candidate evaluation

| # | Design ID | Verdict | Reason |
|---|---|---|---|
| 1 | DAHSk9Z3n2I | Reject | Fabricated tablet mockup with gibberish UI text ("Desciond", "Cair Fattine"), wrong logo, invented "TRY TRENIKO" ticker, missing support copy and CTA |
| 2 | DAHSk7yIDmE | **Selected (rebuilt)** | Only candidate carrying the real brand elements — uppercase TRENIKO wordmark in `#0ea5e9`, blue accent, CTA. Faults were purely positional and therefore fixable |
| 3 | DAHSk_ssePM | Reject | Duplicated headline ("Run your your coaching business"), misspelled "Treniiko com", off-brand serif/script type, copy repeated three times |
| 4 | DAHSk1DNii8 | Reject | Cleanest typography but zero brand colour, no wordmark, near-invisible support copy, half the canvas dead |

## What was changed on the selected candidate
- Deleted two baked-in raster "ghost" layers causing the blurred double text
- Rebuilt the layout on a 90 px left margin grid
- Headline → 78 px bold, `#111827`, line-height 1.1, dominates the canvas
- Wordmark → 40 px bold, `#0ea5e9` (matches `DashboardLayout.jsx:90`)
- Accent rule → 120 × 8 px, `#0ea5e9`
- Support copy → 36 px, `#4B5563` (7.5:1 contrast, AA for phone reading)
- CTA → 34 px bold, `#0ea5e9`

## Pre-publication checks (all passed)
- Dimensions exactly 1080 × 1350 — no crop risk in the 4:5 feed slot
- Spelling verified word by word, including `treniko.com`
- No internal/local URLs, no QA/test wording, no developer information, no credentials, no personal data
- No invented statistics, testimonials, user counts, scarcity or "AI-powered" claims
- English only
