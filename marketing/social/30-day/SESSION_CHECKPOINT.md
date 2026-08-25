# TRENIKO — 30-day Instagram system — session checkpoint

> **SUPERSEDED — SESSION 4 (18 Aug 2026).** Current state is in
> `../SESSION_CHECKPOINT.md`. This file records sessions 1-3 and is accurate
> as history; its counts are stale (P02 has since published).


**Written:** 18 Aug 2026, end of session 3
**Account:** @treniko_fitness (Business) — verified before every action
**Claude in Chrome:** connected · **ffmpeg:** installed (user scope)

This file is the single source of truth for state. Earlier contradictory notes
have been removed, not kept alongside.

---

## State

**PUBLISHED:** P01
**STATIC FEED SCHEDULED:** 15 / 15 — scheduled and verified in Instagram
**REELS:** 5 / 5 MP4 complete · 0 / 5 scheduled · 5 / 5 manual-only
**STORIES:** 7 ready, manual
**NOT STARTED:** nothing

**NEXT ACTION:** get the five MP4s onto the phone and publish P05
(`reels/reel-01/reel-01.mp4`) as a Reel from the Instagram app on
**Sat 22 Aug 2026, 19:00**, using `reels/reel-01/caption.md`. Step-by-step:
`REEL_PUBLISH_QUEUE.md`.

---

## PUBLISHED (1)

| ID | Date | URL |
|---|---|---|
| P01 | Mon 17 Aug 2026 | instagram.com/p/DcJxpIhjJvG/ |

## SCHEDULED AND VERIFIED (15)

Every one was read back off `instagram.com/scheduled_content/` — thumbnail,
caption preview and time — after a hard reload. **None of these was touched in
session 3.** Weeks 1 and 2 were re-checked at the end of session 3 and are
exactly as below.

| ID | Date | Time | Format |
|---|---|---|---|
| P02 | Tue 18 Aug | 11:30 | Carousel ×3 |
| P03 | Thu 20 Aug | 18:30 | Carousel ×3 |
| P04 | Fri 21 Aug | 12:00 | Carousel ×7 |
| P06 | Mon 24 Aug | 11:00 | Carousel ×6 |
| P07 | Tue 25 Aug | 18:00 | Single |
| P08 | Thu 27 Aug | 12:00 | Carousel ×6 |
| P09 | Fri 28 Aug | 18:30 | Single |
| P11 | Mon 31 Aug | 19:00 | Carousel ×4 |
| P12 | Tue 1 Sep | 11:00 | Carousel ×6 |
| P13 | Thu 3 Sep | 18:00 | Single |
| P15 | Sat 5 Sep | 18:30 | Carousel ×5 |
| P16 | Mon 7 Sep | 11:30 | Single |
| P17 | Tue 8 Sep | 19:00 | Carousel ×4 |
| P19 | Fri 11 Sep | 18:00 | Single |
| P20 | Sat 12 Sep | 11:00 | Carousel ×5 |

**Next publication:** P02, Tue 18 Aug 2026, 11:30.
**Final scheduled publication:** P20, Sat 12 Sep 2026, 11:00.

## READY — MANUAL PUBLISH REQUIRED

### Reels (5) — finished MP4s

| ID | Date | Time | MP4 | Caption | Cover |
|---|---|---|---|---|---|
| P05 | Sat 22 Aug | 19:00 | `reels/reel-01/reel-01.mp4` | `reels/reel-01/caption.md` | `reels/reel-01/cover.png` |
| P10 | Sat 29 Aug | 11:30 | `reels/reel-02/reel-02.mp4` | `reels/reel-02/caption.md` | `reels/reel-02/cover.png` |
| P14 | Fri 4 Sep | 12:30 | `reels/reel-03/reel-03.mp4` | `reels/reel-03/caption.md` | `reels/reel-03/cover.png` |
| P18 | Thu 10 Sep | 12:00 | `reels/reel-04/reel-04.mp4` | `reels/reel-04/caption.md` | `reels/reel-04/cover.png` |
| P21 | Mon 14 Sep | 18:30 | `reels/reel-05/reel-05.mp4` | `reels/reel-05/caption.md` | `reels/reel-05/cover.png` |

All five: 1080 × 1920, 9:16, 14.9 s, H.264 High / yuv420p, 30 fps, silent AAC,
~1.5 MB, `+faststart`, zero decode errors. Full detail and the mobile workflow:
**`REEL_PUBLISH_QUEUE.md`**.

### Stories (7) — Instagram web cannot create Stories

Dates, dayparts, asset paths, Story types and exact poll and question text:
**`STORY_PUBLISH_QUEUE.md`**. Highlight mapping: **`HIGHLIGHT_PLAN.md`**
(PRODUCT is ready now; FEATURES from 24 Aug; FOR TRAINERS, UPDATES and FAQ wait
until they have something genuine in them; RESULTS deliberately does not exist).

## NOT STARTED

Nothing. Every piece in the 21-item calendar exists as a finished asset.

---

## What session 3 did

1. **Installed ffmpeg**, user-scoped, via `winget install Gyan.FFmpeg`. Nothing
   was committed, `package.json` was not touched, no UAC prompt was needed.
2. **Cleaned the Reel frames.** The hook / pain / CTA frames carried production
   labels reading "0–2 SEC · HOOK" — internal wording that must never reach a
   published Reel. They were re-rendered without them, and the headline block is
   now optically centred instead of sitting at a fixed height, which the still
   frames could carry but a moving one could not. Same type, margins, colour and
   wordmark. `_tooling/reel-frames.js`.
3. **Captured the real product.** Started the local dev stack, created a
   synthetic demo tenant through the app's own API, and screenshotted the running
   application. Details and the safety rules under *On the product capture* below.
4. **Built the product sections.** Three cards per Reel, each a real screenshot
   region enlarged ~2× on a branded ground with a headline. A whole desktop screen
   shrunk into a 1080-wide frame is unreadable on a phone; one enlarged fragment
   is not. `_tooling/reel-cards.js`, which refuses to render a caption line that
   would reach the margin.
5. **Rendered five MP4s.** `_tooling/build-reels.sh` — a slow push-in on every
   still, short crossfades between sections, slide cuts inside the product run.
6. **QA'd the rendered video, not the inputs.** 150 sampled frames across the
   five files: no black borders anywhere, no clipped text, no browser chrome, no
   `localhost`, no Windows UI, no Croatian strings, correct wordmark and
   `#0ea5e9`, legible with sound off. Full decode of all five: zero errors.
7. **Tested Instagram web Reel scheduling.** It could not be completed — see
   below. Nothing was scheduled, cancelled, duplicated or altered.
8. **Wrote `REEL_PUBLISH_QUEUE.md`** and updated `SCHEDULING_STATUS.md`,
   `CONTENT_CALENDAR.md` and `reels/README.md`.

### On the Instagram Reel scheduling test

Instagram's **Schedule content** composer does accept video — its file input
advertises `video/mp4` and `video/quicktime`, and the upload begins. It then
stalls indefinitely on the preview step.

The cause is the automated browser, not the file. Instagram builds its preview by
loading the video into an HTML `<video>` element, and in this browser session
that element never leaves `readyState 0` — for **every** video tried, including a
VP9/WebM control file and a conservative `main`-profile H.264 re-encode, served
both as a blob and over plain HTTP from a local server. Video decoding is not
available to the page here. The MP4s are sound: ffmpeg decodes all five end to
end without an error.

So, precisely:

- **Not proven** that Instagram web can schedule a Reel.
- **Not proven** that it cannot.
- **Proven** that it cannot be driven from this automated browser.

Do not record a scheduling success that did not happen, and do not spend another
session retrying it here. Publishing from the phone is the reliable path.

### On the product capture

The product frames are screenshots of the **running application**, captured from
a synthetic demo tenant created for the purpose on the **local development**
server (`localhost:5173` / `localhost:3000`, `NODE_ENV=development`). Production
was never read or written.

The tenant holds five clients recorded as a first name and a surname initial
(Alex M., Jordan T., Sam K., Riley P., Casey B.), reserved `@example.com`
addresses, no phone numbers, no dates of birth, no injuries and no health notes;
one "10 Session Pack" used to different depths so the *2 sessions left* alert
fires honestly; and invented payment amounts. Its plan was moved to Pro locally
so package assignment would work — see the defect note below.

No browser chrome, address bar, `localhost`, developer tooling or Windows window
appears in any frame: each source is a page capture and only a named region of it
is used. Every crop region is documented at the top of `_tooling/reel-cards.js`.

Recreate the tenant with `_tooling/seed-demo.js` then `_tooling/seed-demo2.js`.

### Two product defects found while capturing

Neither was fixed — they are outside this session's scope, but both are real and
both are logged here rather than lost:

1. **`checkClientLimit` blocks far more than client creation.** It fires on any
   `POST` whose path contains `/clients` (`middleware/subscription.js`), so a
   trainer at their plan's client limit cannot assign a package or record a
   payment either — both are `POST /api/clients/:id/...`. On the Free plan that
   means a trainer with 5 clients silently cannot log money coming in.
2. **Croatian dates leak into the English UI.** The clients table's *Completed*
   column renders "22. kol" with the language set to English. That column was
   hidden for the capture rather than shown wrong.

---

## Guardrails held (all three sessions)

English only · no invented statistics, testimonials, customers or user counts ·
no fabricated product features · no fabricated UI · no customer data · no
copyrighted music · no ads, no boosts, no payment method, **€0 spent** · no
Facebook, TikTok, LinkedIn or YouTube · no Meta Business Suite · nothing
published to a personal account · nothing already scheduled was cancelled,
rescheduled, duplicated or rewritten · ffmpeg installed outside the repo and not
added as a project dependency · no production data touched.
