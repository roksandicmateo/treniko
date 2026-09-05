# TRENIKO — September 2026 social campaign: what was produced

**Sprint date:** 5 September 2026 · timezone **Europe/Zagreb**
**Window covered:** 5–30 September 2026 · all public copy **English**
**Accounts:** Instagram `@treniko_fitness` · Facebook Page **Treniko**
**Spend:** €0. No ad account, no boost, no payment method touched.
**Published or scheduled during this sprint:** **nothing.** See §9.

---

## 1. September strategy

The month is one argument, told in five ways:

> **TRENIKO helps personal trainers run their coaching business without
> spreadsheets, scattered calendars and manual admin.**

The strongest thing the product can honestly claim is a chain, not a feature
list: **clients → sessions → packages → payments → progress**. Every product post
this month shows a link in that chain, with a real screenshot, and the education
posts describe the moment the chain breaks when it lives in six separate apps.

What the campaign deliberately does **not** say: no AI coach, no workout
generator, no payment processing, no marketplace, no community. None of those
exist in the product, so none appears in the copy.

The month splits cleanly:

* **5–14 Sep** — cycle 1, built and scheduled in August. Untouched by this sprint.
* **15–30 Sep** — built here: 8 feed posts, 10 Story sequences, Facebook
  adaptations, and a scheduling manifest.

**Cadence:** 3 Instagram feed posts a week, 2–3 Story sequences a week. Facebook
takes the same eight posts with rewritten copy, 30–60 minutes offset.

**Pillar mix across the 8 new posts:** problem 25% · workflow 12.5% · product
demo 25% · education 25% · brand 12.5%. No two consecutive product posts.

---

## 2. The complete calendar, 5–30 September

Full table with dates, times, objectives, asset paths and status:
**`../september-2026-content-calendar.md`**

Summary of the window:

| | Instagram feed | Reels | Stories | Facebook feed |
|---|---|---|---|---|
| 5–14 Sep (cycle 1, scheduled in Aug) | 5 | 2 | 5 | 3 |
| 15–30 Sep (**this sprint**) | **8** | 0 | **10** | **8** |

No new Reels were produced: video was not in this sprint's scope, and the five
existing Reels already carry the month to 14 September.

---

## 3. Instagram captions

One file per post in `captions/`, each with date, platform, type, pillar, hook,
on-screen copy, full caption, CTA, hashtags, visual notes and whether a
screenshot is required.

| ID | Date · time | Type | Pillar | Hook |
|---|---|---|---|---|
| **F01** | Tue 15 Sep · 11:30 | Carousel ×4 | Problem | 21:40. "Any chance we can move tomorrow?" |
| **F02** | Thu 17 Sep · 18:30 | Carousel ×3 | Product | What needs you today? |
| **F03** | Sat 19 Sep · 11:30 | Carousel ×5 | Education | What breaks when you go from 10 clients to 25 |
| **F04** | Tue 22 Sep · 19:00 | Carousel ×5 | Workflow | Client. Session. Package. Payment. |
| **F05** | Thu 24 Sep · 18:00 | Carousel ×4 | Education | How to follow up without feeling like a nag |
| **F06** | Sat 26 Sep · 11:30 | Carousel ×3 | Product | "How many sessions do I have left?" |
| **F07** | Mon 28 Sep · 11:00 | Single | Problem | You can name your best client. Can you name the one about to leave? |
| **F08** | Wed 30 Sep · 19:00 | Carousel ×2 | Brand | Run your coaching business. Not your spreadsheets. |

Hashtags go in the **first comment**, per `../social/HASHTAG_STRATEGY.md` —
audience-precision tags (`#ptbusiness`, `#coachingadmin`, `#clientmanagement`),
never `#fitness`.

## 4. Facebook adaptations

Every post has a separate **CAPTION — Facebook** section in the same file. They
are not copies: Facebook gets a longer, flatter, more conversational register,
the link written out in full with a UTM tag
(`utm_source=facebook&utm_medium=social&utm_campaign=sep2026&utm_content=fNN`),
and a question at the end. Two of the eight (F05, F07) carry **no link at all** —
they are discussion posts, and a link would blunt them.

Assets are re-exported at **1200 × 1500** in `feed/_facebook/`.

## 5. Story sequences

Ten sequences, 21 frames, all 1080 × 1920. Full sticker text in
`captions/STORIES-2026-09.md`.

| ID | Date | Format | Purpose |
|---|---|---|---|
| S01 | 15 Sep | Poll — where do you track sessions? | Research |
| S02 | 16 Sep | Reshare + product + link | Website visits |
| S03 | 18 Sep | Question box — which admin job would you hand over? | Research |
| S04 | 19 Sep | Poll — how do you know who has paid? | Research |
| S05 | 21 Sep | Product — who is about to run out? | Website visits |
| S06 | 22 Sep | Three-frame workflow | Product understanding |
| S07 | 24 Sep | Emoji slider — chasing a late payment | Research |
| S08 | 26 Sep | Poll — how many active clients? | Research |
| S09 | 28 Sep | Question box — spotting a quiet client | Research |
| S10 | 30 Sep | Month recap + link | Brand, visits |

Six of the ten are built around a poll, question box or slider. Those frames
deliberately leave the sticker's space **empty** — the sticker is added in the
Instagram app, because a drawn poll cannot be voted on and the replies are the
whole point.

## 6. Screenshots captured

From a synthetic demo tenant on the **local development server**. Trainer *Alex
Morgan*; clients *James Carter, Emma Wilson, Daniel Brooks, Sophie Taylor, Olivia
Bennett, Marcus Reid* — all fictional, `@example.com` addresses, no phone
numbers, no dates of birth, no health notes, invented amounts. **Production was
never read or written.**

**Full screens (17)** — `screenshots/`
`desktop-dashboard` · `desktop-calendar` · `desktop-calendar-week-ahead` ·
`desktop-clients` · `desktop-clients-narrow` · `desktop-client-detail` ·
`desktop-client-packages` · `desktop-client-billing` · `desktop-client-progress` ·
`desktop-packages` · `desktop-trainings` · `desktop-groups` ·
`mobile-dashboard` · `mobile-calendar` · `mobile-clients` ·
`mobile-client-detail` · `mobile-packages`

**Component crops (16)** — `screenshots/crops/`, these are what appear in the
assets: `dash-attention` · `dash-today` · `dash-upcoming` · `phone-attention` ·
`phone-today` · `phone-clients` · `phone-package` · `phone-client-summary` ·
`phone-billing` · `clients-table` · `calendar-week` · `package-card` ·
`client-summary` · `client-package` · `billing-totals` · `progress-weight`

Crops are located in the DOM by their own heading and clipped to the measured
element, so a layout change moves the crop instead of cutting a card in half.
Phone-width captures are preferred for feed assets: a 1440-wide table scaled into
a 1080 canvas leaves body text around 12 px, which is unreadable on a phone.

**Two screens were deliberately NOT shipped** — see §10.

## 7. Visual assets created

| What | Count | Size |
|---|---|---|
| Instagram feed slides | 27 | 1080 × 1350 |
| Facebook exports | 27 | 1200 × 1500 |
| Story frames | 21 | 1080 × 1920 |
| Template specimens | 7 | feed + story sizes |
| Product screenshots | 17 full + 16 crops | native |
| **Total PNGs** | **115** | |

Every size was verified programmatically after rendering.

The renderer is deterministic and **refuses to draw a line that would reach the
margin** — a clipped word fails the build rather than shipping. Five reusable
layouts are specimen-rendered in `templates/`: feed hook, feed product, feed
statement, feed list/number, story statement, story poll.

## 8. Canva / Figma status

| | |
|---|---|
| **Canva** | ✅ **Connected and used** — a folder was created: **TRENIKO — September 2026 social**, <https://www.canva.com/folder/FAHUT59ACno> |
| Assets uploaded to Canva | ❌ **No.** Canva's connector ingests images only from **public** URLs. These assets are not published anywhere public, and publishing them to a file host to work around that would put unreleased marketing on the open internet. Upload them by hand from `marketing/september-2026/` |
| Designs generated in Canva | ❌ **No.** The assets are built from real product screenshots by a deterministic renderer. AI-generated Canva designs would have been generic and would not have contained the real UI |
| **Figma** | ❌ **Not available.** No Figma integration is connected to this session |
| Brand kit | None exists in the Canva account (`list-brand-kits` returned empty) |

Everything needed to rebuild the system in Canva or Figma — colours, type sizes,
margins, radii — is written down in `README.md` under *Design system*, and the
seven specimens in `templates/` show each layout at full size.

## 9. Scheduling status

**NOTHING WAS SCHEDULED. NOTHING WAS PUBLISHED. Nothing was cancelled or
altered.**

> The **Claude browser extension was not connected** for this session.
> `tabs_context_mcp` returned *"Browser extension is not connected"* on every
> attempt. Instagram scheduling and Meta Business Suite are browser-only in this
> setup, so no new item could be scheduled — and no existing scheduled item could
> be **verified** either.

Nothing was recorded as scheduled that is not. The manifest
`scheduling/schedule-manifest.csv` lists all 26 rows for 15–30 Sep with status
`READY` (schedulable in a browser) or `MANUAL` (needs the Instagram app because
of a poll, question or slider sticker). Step-by-step instructions, including the
platform quirks that have cost previous sessions real time, are in
`scheduling/README.md`.

### Exact dates and times scheduled

**None, by this sprint.**

For completeness, the items scheduled in **August** that fall inside this window —
last read back off the platform on **24 August 2026**, and *not* re-verified today:

| ID | Date | Time | Where |
|---|---|---|---|
| P15 | Sat 5 Sep | 18:30 | Instagram-native |
| P16 | Mon 7 Sep | 11:30 | Instagram-native |
| P17 | Tue 8 Sep | 19:00 | Instagram-native |
| P18 | Thu 10 Sep | 12:00 | Business Suite — Reel, IG + FB |
| P19 | Fri 11 Sep | 18:00 | Instagram-native |
| P20 | Sat 12 Sep | 11:00 | Instagram-native |
| P21 | Mon 14 Sep | 18:30 | Business Suite — Reel, IG + FB |
| FB | 5, 8, 12 Sep | 12:00 | Business Suite — Facebook feed |

**Re-verify these before trusting them.** Instructions: `scheduling/README.md` §0.

### Could not be scheduled

| What | Why |
|---|---|
| All 8 Instagram feed posts (15–30 Sep) | Browser extension not connected |
| All 8 Facebook feed posts | Browser extension not connected |
| S02, S05, S06, S10 (schedulable Stories) | Browser extension not connected |
| S01, S03, S04, S07, S08, S09 | **Permanently manual** — Business Suite's Story composer has no poll, question or slider sticker |
| Hashtag first comments | Instagram cannot schedule a first comment; paste on publish day |
| Facebook pinned post | Scheduling cannot pin; pin by hand after it publishes |

## 10. Product defects found while capturing

None of these was fixed — this was a marketing sprint, and all four are
application work. All four are real and reproducible on the local build.

1. **Croatian dates in the English UI (Progress page).** The Strength Progress
   chart labels its x-axis `17. srp`, `7. kol`, `4. ruj` with the language set to
   English. **The `/dashboard/progress` screenshot was therefore not shipped.**
   This is the same class of leak the August session found in the clients table.
2. **`Total Hours` is multiplied by set count.** `routes/progress.js:95` sums
   `end_time - start_time` across a join to `training_exercises` and
   `training_sets`, so each training's duration is counted once per set row:
   eight one-hour sessions read **72.0 h**. The overview query at line 169 has the
   same shape.
3. **The client page's Progress → Strength sub-tab crashes.**
   `TypeError: entries.map is not a function` in `<StrengthProgress>`
   (`frontend/src/components/progress/StrengthProgress.jsx`); the error boundary
   replaces the whole section with "Something went wrong". **That screenshot was
   not shipped either.**
4. **"Last session" can show a future date.** `last_session_date` is
   `MAX(session_date)` over non-cancelled sessions (migration 031), so a client
   with a booking next week shows that date under a column headed *Last session*.
   Worked around for the campaign by capturing the clients table at a viewport
   below `lg`, where the column is not rendered.

Two defects logged by the August session are **fixed** and were re-verified here:
`checkClientLimit` is now scoped to client creation only, and package assignment
and payment recording work at the plan limit.

## 11. Validation performed

| Check | Result |
|---|---|
| All public copy in English | ✅ no Croatian in any caption, calendar or asset source |
| Only real, existing features described | ✅ every product claim maps to a screen in the running app |
| No fake testimonials, customers, revenue or statistics | ✅ none anywhere; one draft Story line implying trainer research was rewritten before rendering |
| No invented product capabilities | ✅ no AI, no payments processing, no marketplace, no community |
| Screenshots represent the current application | ✅ captured today from the running build |
| No misleading screenshots | ✅ two screens with defects were excluded rather than dressed up |
| No `localhost`, URL bar, browser chrome or dev tooling | ✅ page captures only; no window is ever in shot |
| No real personal data | ✅ synthetic tenant, `@example.com`, no phone numbers, no health notes |
| Asset dimensions | ✅ 82 campaign PNGs checked programmatically: 1080×1350, 1200×1500, 1080×1920 |
| Consistent branding | ✅ single wordmark treatment, `#0ea5e9`, one type system across feed and stories |
| Mobile legibility | ✅ product captures taken at phone width; body text lands near 27 px in a 1080 canvas |
| Strong first-line hook | ✅ every post opens on a concrete trainer moment, not a slogan |
| Clear CTA | ✅ no "buy now" anywhere — checkout does not exist. "Try TRENIKO", "See how it works", "Tell us how you track this" |
| Banned phrasing | ✅ grep for "unlock", "revolutionise", "game-changing", "next level", "empower", "AI-powered" returns nothing |

## 12. Recommended KPI tracking — next 7 days

Baseline first: the account's non-follower reach was **0%** at the last
measurement (`../social/CONTENT_BASELINE.md`). Read these on **Mon 21 Sep** and
again on **Mon 28 Sep** — weekly, not daily; daily numbers at this size are noise.

**From Instagram Insights (manual read, per post):**

| Metric | Why it matters | Target for week 1 |
|---|---|---|
| Reach, split follower / non-follower | The only number that can grow the account | **any** non-follower reach > 0 |
| Saves | The honest signal for education posts (F03, F05) | ≥ 1 per education post |
| Sends / shares | The honest signal for problem posts (F01, F07) | ≥ 1 per problem post |
| Profile visits | Post → profile conversion | ≥ 5 across the week |
| Link taps in bio | Profile → website | ≥ 2 |
| Story replies | The point of the six sticker Stories | ≥ 3 total answers |
| Poll vote counts | Free audience research | record the split, not just the total |

**From the product's own first-party analytics** (migrations 034 and 035, live
since 24 Aug — `../social/SESSION_CHECKPOINT.md`):

| Metric | Where |
|---|---|
| Landing-page views by channel | admin Acquisition panel, `page_view` |
| Registrations attributed to Instagram / Facebook | `signup_attribution` |
| **Views → signups per channel** | the one number the whole funnel exists to produce |

**Decision rules for the 28 Sep review** — write these down now so the answer is
not chosen after the fact:

* If non-follower reach is still 0% across all eight posts, the format is the
  problem, not the copy: shift October's mix towards Reels, which are the only
  format that reaches non-followers.
* If saves cluster on the education posts and product posts land flat, raise
  education to 40% of October and cut product demos to one a week.
* If Story replies produce actual trainer answers, October's calendar should be
  written **from those answers**, not from a pillar table.
* Do not change posting times on one week of data. Two weeks minimum, and only
  where the same slot underperforms twice.

---

## Guardrails held

English only · no invented statistics, testimonials, customers or user counts ·
no fabricated product features · no fabricated UI · no customer data · **nothing
published** · **nothing scheduled** · nothing already scheduled was cancelled,
rescheduled, duplicated or rewritten · no application code changed · `sharp` and
`puppeteer-core` installed outside the repository and not added to any
`package.json` · production never read or written · **€0 spent**.
