# TRENIKO — Logo exploration record

## Round 1 — Canva generative (design_type: `logo`)

Job `492cc6db-e6c4-48d2-b445-511b31141293`. Brief forbade dumbbells, human
figures, pulse lines, lightning bolts and circuit imagery, and allowed exactly
one string of text: `TRENIKO`. All four returns spelled the wordmark correctly —
no gibberish, unlike the Day 1 poster round.

| # | Canva title | URL | Verdict |
|---|---|---|---|
| 1 | Geometric Monogram Logo with Bold Wordmark | `canva.com/d/ly6WdMTjQHi38A6` | Reject — angled foot on the stem is fussy detail that silts up below ~64 px |
| 2 | Abstract 'T' Monogram Above Wordmark | `canva.com/d/dkCm3DOkqRv4-fK` | Reject — charcoal T overlapped by a blue T. Two-tone overlap muddies at 40 px and reads as "TI" |
| 3 | Bold 'T' Monogram with Precise Structure | `canva.com/d/ogpHhbDV7shbWFo` | Reject — three vertical strokes under the crossbar read unmistakably as a **Greek column**. Law firm / bank, not SaaS |
| 4 | Minimal Logo with Basic 'T' Shape | `canva.com/d/EH7wS-I6-jGQgtT` | Closest — cleanest geometry and the most credible SaaS feel. Informed the final direction |

All four were wordmark lockups on white. None was usable as an avatar, which is
the asset that actually mattered.

## Round 2 — deterministic candidates (A / B / C)

Rendered locally as SVG so geometry could be controlled exactly, then
downsampled to a true 40 px and inspected.

| Candidate | Concept | 40 px verdict |
|---|---|---|
| **A** | Evolution of the existing favicon: one geometric T, white on blue | **Survives.** Unambiguous, crisp |
| **B** | T plus a tinted bar beneath, suggesting stacked rows | Fail — the 72%-opacity bar reads as a compression artifact or a smudge |
| **C** | T silhouette built from three separated "schedule row" bars | Fail — the gaps close up; reads as a colon or a funnel icon, not a T |

The scheduling/organisation metaphor was tested twice (B and C) and abandoned on
evidence: at avatar size the separations that carry the meaning are sub-pixel.

## Round 3 — refinement of A

Five drawings of the same letter compared at 40 px: baseline, pill terminals,
heavy/wide squared, mixed terminals, and a stem bleeding to the canvas edge.

- The **bleeding-stem** variant was rejected specifically because Instagram
  crops avatars to a circle, which severs the stem at the bottom.
- **Heavy and wide with a small corner radius** won: most presence in the
  circular crop, cleanest edges when downsampled.
- Two corrections applied after visual QA: the mark was enlarged for better
  presence inside the circle, and nudged **down 2 units** for optical centring,
  because the heavy crossbar makes a geometrically centred T sit visually high.

## Selected

Candidate A, refined — see `BRAND_GUIDE.md` §1 for the final geometry.
