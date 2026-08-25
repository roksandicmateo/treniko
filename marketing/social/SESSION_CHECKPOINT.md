# TRENIKO — social system — session checkpoint

**Written:** 24 Aug 2026, end of **session 9** · timezone **Europe/Zagreb**
**Accounts:** Instagram @treniko_fitness (Business) · Facebook Page **Treniko**
**Claude in Chrome:** connected · **ffmpeg + ffprobe:** available (user scope)

This is the single source of truth for state. The session-3 checkpoint at
`30-day/SESSION_CHECKPOINT.md` is kept as history and has been marked
superseded.

---

## SESSION 9 — 24 Aug 2026

Session 9 closed the measurement loop. **No content was scheduled, published or
altered.** €0 spent.

### The funnel is now measurable end to end

    CONTENT → PROFILE VISIT → WEBSITE VISIT → REGISTRATION → ACTIVE TRAINER
    └─ Instagram Insights ─┘   └── mig 035 ─┘   └── mig 034 ─┘

Session 8 could say which Reel produced a trainer. It could not say how many
people that Reel sent who did **not** sign up — so two signups from ten visits
and two from nine hundred looked identical. That is fixed.

| Step | Measured? | By what |
|---|---|---|
| Reach, profile visits, link taps | ✅ | Instagram Insights (manual read) |
| **Landing-page views** | ✅ **new** | `page_view`, migration 035 |
| **Registration completed** | ✅ | `tenants.created_at` |
| **…attributed to a channel** | ✅ | `signup_attribution`, migration 034 |
| **Views → signups, per channel** | ✅ **new** | admin Acquisition panel |
| Unique visitors | ❌ | no identifier is stored, deliberately |
| Registration *started* | ❌ | the /register view is counted; typing is not |
| Paid conversion | ❌ n/a | no payment processor exists |

### What was built, and what was refused

**First-party, not Umami or Plausible.** Both were tested against the real box.
Plausible needs Docker + ClickHouse; Docker is not installed and the droplet is
1 vCPU / 961 MB with ~589 MB free. Umami would run but keeps views in its own
schema, making visits-joined-to-registrations a cross-system problem — the one
number the whole exercise exists to produce.

**Nothing identifying is stored.** No IP, no user agent, no cookie, no visitor
or session id, no fingerprint. A test pins the exact column list, so adding an
identifier later breaks a build.

**Consequence, stated wherever the number appears:** this counts page **views**,
not unique visitors. Deduplicating would need exactly the identifier being
refused, and an inflated denominator understating conversion is a safer error
than tracking people to correct it.

**Not consent-gated, and that is deliberate.** `attribution.js` writes to
sessionStorage — device storage — so it stays gated. The view beacon stores
nothing on the device, so there is nothing to consent to. It is also a
correctness requirement: registrations are counted unconditionally, so gating
views on consent would divide a consented sample into an unconsented total and
overstate every rate. **Verified live in a browser that had declined analytics
cookies — the view was counted, the attribution was not.**

### The admin panel refuses to invent a rate

- **No aggregate visit-to-signup rate.** Views start 24 Aug; signups go back to
  the first account ever created. Dividing them would produce a plausible,
  wrong number. The panel shows the measuring-since date and explains why.
- **A channel with signups but no views prints "not measured"**, not 0% and not
  ∞. Every account predating the counter is that case.
- **A channel with views and zero signups stays visible.** That is the most
  decision-useful row on the page — traffic that converts nobody.

### Verified in production

Real browser → live `treniko.com` with UTM tags → row in the production
database, read back off the server. QA rows were then deleted so real traffic
starts from a clean slate. Zero 5xx. Database backed up before the migration.

### Guardrails held

Nothing published, nothing scheduled, nothing altered · no Meta Pixel, no
advertising tracker, no third-party analytics account · no ad account, no
payment method, no boost · **€0**.


---

## SESSION 8 — 24 Aug 2026

Session 8 was **attribution and measurement**, plus one Story question closed
for good. Nothing was published, nothing already scheduled was touched, and
**€0 was spent.**

### The funnel now joins up — signup attribution is live in production

The gap that made every previous session's reach numbers unactionable is
closed. `signup_attribution` (migration 034) records first touch against the
tenant at registration, and the admin dashboard reads it back as **signups by
source / campaign / content**.

    REACH → PROFILE VISIT → WEBSITE CLICK → ??? → REGISTRATION → ACTIVATION
    └──────── Instagram Insights ────────┘       └──── now measured ────┘

The UTM strings this file has been specifying for five sessions finally land
somewhere. `utm_content=reel-p05` will show up in the admin panel as a signup
against that Reel.

**What is still NOT measured, and is labelled as such in the panel rather than
left blank:** landing-page visits, registration starts, signup conversion rate,
social *traffic* by source, and trial-to-paid conversion. The first three need
page analytics, which is not installed. The last one cannot exist — there is no
payment processor in the product.

So the honest funnel today is:

| Step | Measured? | By what |
|---|---|---|
| Reach, profile visits, link taps | ✅ | Instagram Insights (manual read) |
| Landing-page visits | ❌ | nothing — needs cookieless page analytics |
| Registration started | ❌ | nothing |
| **Registration completed** | ✅ | `tenants.created_at` |
| **…attributed to a channel** | ✅ **new** | `signup_attribution` |
| Activation (verified, DPA, first client) | ⚠️ partial | `users.email_verified`, `dpa_accepted` |
| Paid conversion | ❌ n/a | no payment processor exists |

### Instagram link-sticker Stories: tested, and the answer is NO

Session 7 left this open, guessing "probably". It is **not** possible, and the
composer says so itself. Attaching a link opens *Veza za prelazak prstom prema
gore* with an explicit notice:

> **"Links will only be shown on Facebook stories."**
> "Viewers on Facebook will be able to swipe up to visit this URL.
> **This feature is not supported by Instagram.**"

So `Add link` is a **Facebook-only** swipe-up. It does not produce an Instagram
link sticker. Combined with session 7's finding that there is no poll and no
question sticker either, the split is now final:

| Story type | Schedulable for Instagram? |
|---|---|
| Plain image card | ✅ **yes** — 6 already scheduled |
| Link sticker | ❌ **no** — Facebook only |
| Poll | ❌ **no** |
| Question box | ❌ **no** |

**S3, S4, S8–S14 are all manual, permanently, on current Business Suite.** Stop
re-testing this. The remaining eight Stories need the phone.

S4 was loaded into the composer to run this test and then **discarded** — it was
deliberately not scheduled, because the asset reads *"Tap through to the post"*
and Business Suite cannot reshare a feed post into a Story. Scheduling it with a
link to the website instead would have changed what the piece says.

### Facebook Page audit — no changes were warranted

| Field | State |
|---|---|
| Name | **Treniko** ✅ |
| Profile photo | TRENIKO mark ✅ |
| Cover | branded, headline clear of the avatar ✅ |
| Category | **Softverska tvrtka** (Software company) ✅ |
| Description | English, accurate, on-positioning ✅ |
| Website | `treniko.com` ✅ |
| Instagram connection | ✅ linked in one Business Suite asset |
| Followers | 1 |
| **Username / vanity URL** | ⚠️ **still not confirmed available** — the setting was not reachable from Page settings or Business Suite this session. `MANUAL_QUEUE.md` § M6 stands |

Facebook suggests "add an address" and "add a phone number" to complete setup.
**Neither should be done.** TRENIKO is a software company with no premises, and
inventing a location to satisfy a progress bar is exactly the kind of thing this
account does not do.

### Facebook now has a coherent organic sequence

Seven feed posts and four Reels, through 14 Sep, covering every beat the brief
asks for except the one that cannot be honest yet:

| Beat | Where |
|---|---|
| What TRENIKO is | **26 Aug** pinned post (session 7) |
| Problem | 27, 31 Aug · 8 Sep |
| Solution / benefit | 5, 12 Sep |
| Features + product demo | the four Reels |
| Education | 27 Aug, 5 Sep |
| **Social proof** | **absent, deliberately.** There are no customers to quote |

### Guardrails held

English only · no invented proof, and no rating or review markup in the new
structured data either · nothing already scheduled was touched, duplicated or
rewritten · nothing published immediately · the S4 draft was discarded, not
saved · no ad account, no payment method, no boost, **€0**.


---

## SESSION 7 — 24 Aug 2026

Session 7 was **website deployment plus the first Stories ever scheduled.**
Production was deployed and verified; six Stories and one Facebook post were
scheduled. **€0 spent, no ad account, no payment method, no boost.** Meta offered
a $2 boost immediately after scheduling the Facebook post and it was declined.

### The six-session Story question is answered: Business Suite CAN schedule Stories

`Create story` → **Share to** (Facebook and/or Instagram, independently
selectable) → media → **Zakaži** with a **separate date and time picker per
platform.** This supersedes every earlier note saying Stories are manual.

**The limit is stickers, not scheduling.** The composer offers `Uredi` (edit) and
**`Add link` per card** — and nothing else. There is **no poll sticker and no
question sticker.** So:

| Story type | Schedulable in Business Suite? |
|---|---|
| Plain image card | **Yes** |
| Link-sticker card | **Probably** — `Add link` exists per card, **not yet tested** |
| **Poll** | **No.** No sticker exists |
| **Question box** | **No.** No sticker exists |

That splits the 14-slot queue cleanly. The six highlight seeds carry no sticker,
so they were scheduled. **S3, S4, S8–S14 still need the phone**, because the
answers to a poll or a question box are the entire point of those Stories.

### Scheduled this session — read back off the platform, not assumed

| What | When | Where |
|---|---|---|
| **PRODUCT highlight seeds** — `story-{1-what,2-who,3-benefit}.png` | **Tue 25 Aug 2026, 11:00** | **Instagram only** |
| **FOR TRAINERS highlight seeds** — `story-{1-for,2-not-for,3-first-week}.png` | **Sat 29 Aug 2026, 12:30** | **Instagram only** |
| **Facebook native pinned post** — "Run your personal training business without the admin chaos." | **Wed 26 Aug 2026, 12:00** | **Facebook only** |

Stories are Instagram-only on purpose — `FACEBOOK_STRATEGY.md` says a Page Story
at 1 follower collects nothing. FOR TRAINERS sits an hour after the P10 Reel so
it can push viewers at the Reel, which is still the only thing that reaches a
non-follower.

The Facebook post is the **PIN 1 equivalent** `FACEBOOK_STRATEGY.md` asks for:
long-form, honest, no invented proof, and a clickable UTM-tagged link
(`utm_content=fb-pin-1`) as the last line. The link preview renders the real
`og-image.png` — verified live in the composer preview. **It still has to be
pinned by hand once it publishes; scheduling cannot pin.**

### Instagram web can build Highlights after all

`+ New` on the profile opens **New Highlight → name → Stories picker**. The
picker is **empty**, and that is the whole blocker: **no Story has ever been
published on this account**, so there is nothing to put in a highlight.

**This is a sequencing problem, not a mobile-app problem.** From 25 Aug the
PRODUCT seeds are live and PRODUCT can be built **from the browser in about a
minute**. FOR TRAINERS follows on 29 Aug. `MANUAL_QUEUE.md` § M2 can be retired.

No highlight was created and nothing was named — the dialog was opened to test
the capability and cancelled.

### Corrections to what this file used to say

1. **"Facebook needs regular feed content" was already out of date.** The Page
   had **five feed posts** scheduled before this session (27, 31 Aug, 5, 8,
   12 Sep) plus the four Reels. Nothing was duplicated. One post was added.
2. **Instagram is at 10 posts, not 2.** P03–P10 published on schedule.
3. **Instagram web now advertises post and Reel scheduling** ("up to a month in
   advance"). Untested here, but the session-3/4 conclusion that web cannot
   schedule a Reel should be **re-tested before it is relied on again.**

### The wrong-account hazard is real and it nearly fired

`business.facebook.com/latest/planner?asset_id=1300314106493001` **silently
redirected to `asset_id=839813676042993` — the FC Barcelona Fans Page** — and
loaded a composer pointed at it. The account holds six unrelated Pages.

**Always confirm the asset selector reads `Treniko, treniko_fitness` before
typing anything.** A deep link is not sufficient.

### Guardrails held

English only · no invented proof · nothing already scheduled was touched,
duplicated or rewritten · nothing was published immediately · no ad account, no
payment method, no boost, **€0** · the $2 boost upsell after scheduling was
declined with *Maybe later*.


---

## State

| | |
|---|---|
| **PUBLISHED** | **10** on Instagram — P01…P10 published on schedule |
| **Non-follower reach** | **0%** — see `CONTENT_BASELINE.md` |
| **Instagram** | 2 followers · 0 following · **10 posts** · **0 highlights** · **0 Stories published, 6 scheduled** |
| **Facebook Page** | ✅ **Treniko** — 1 follower · **7 feed posts + 4 Reels scheduled** · id `1300314106493001` |
| **Meta Business Suite** | ✅ **FULL** — schedules Facebook **and** Instagram, including **Reels** |
| **Instagram ↔ Facebook link** | ✅ **CONNECTED** (user completed the mobile step, 18 Aug) |
| **SCHEDULED in Instagram, verified live** | **14** — P03 … P20 · **not touched this session** |
| **REELS** | 5 / 5 MP4 complete · **5 / 5 SCHEDULED on Instagram AND Facebook** · see `REELS_SCHEDULED.md` |
| **STORIES** | **6 SCHEDULED** (25 + 29 Aug, Instagram) · **8 remain manual — permanently**, see session 8 |
| **HIGHLIGHTS** | 0 created. **Buildable from web from 25 Aug**, once the seeds publish |
| **Feed coverage** | to **Mon 14 Sep 2026** scheduled · **cycle 2 written to Sat 17 Oct 2026** as concepts |
| **Cycle 2** | 40 pieces — 10 feed · 10 Reels · 20 Stories · **copy final, 0 assets built** |
| **Spend** | **€0.** No ad account, no payment method, no boost |
| **Attribution** | ✅ **LIVE** — migration 034, visible in the admin dashboard |
| **Page views** | ✅ **LIVE** — migration 035, first-party, cookieless, counting from 24 Aug 2026 |
| **Published by an automated session** | **NOTHING.** Ever |

### NEXT ACTION

**On Tue 25 Aug, after 11:00 — build the PRODUCT highlight.** The three seed
Stories publish at 11:00 and are then selectable. This is **five clicks in a
browser**, no phone required:

Profile → **+ New** → name it **PRODUCT** → pick the three → cover
`highlights/highlight-product.png`.

Repeat on **Sat 29 Aug after 12:30** for **FOR TRAINERS**.

A Story stays selectable for 24 hours; after that it is only reachable through
the archive. **Do it the same day.**

Then, in order:

1. **Pin the Facebook post** once it publishes on Wed 26 Aug 12:00. Scheduling
   cannot pin, and an unpinned "what is this" post on a Page with one follower
   does almost nothing.
2. **S3 — Tue 25 Aug evening, question box.** Phone. The sticker is the point.
3. **Test whether `Add link` on a scheduled Story works**, using S4 (Fri 28 Aug).
   If it does, S10, S12 and S14 stop needing the phone too.

Full list, in priority order: **`MANUAL_QUEUE.md`** — but § M2 (highlights needs
a phone) is **wrong now** and can be retired.

---

## Language decision — session 4

**English only.** The session-4 brief asked for Croatian-first content; the
decision after review was to keep the account single-language.

The audience is still Croatian personal trainers first — reached by relevance,
hashtags and Reels distribution rather than translation. `STRATEGY.md` already
carried this under *Never* ("Any language other than English in public copy") and
that rule stands. The five Reels were **not** re-rendered and ship in English.

Do not reopen this without a deliberate decision; a feed that changes language
halfway reads as two different accounts.

---

## What session 6 did

Session 6 was **Facebook setup and cycle-2 content planning**. Nothing was
published to Instagram, nothing already scheduled was touched, no application
code changed, no production data was touched, and **€0 was spent**.

1. **Created the TRENIKO Facebook Page** — the prerequisite that has blocked
   Business Suite for two sessions. Branded with the existing avatar and a
   purpose-built cover, category *Software company*, website, business email,
   and a **Learn More** CTA pointing at a UTM-tagged `treniko.com`. 0 followers,
   nothing posted.
2. **Rendered a Facebook cover** — `30-day/_tooling/facebook-cover.js` →
   `facebook/fb-cover.png`, 1640 × 856, using the existing `brand.js` helpers so
   it is the same design system as everything else. It took three iterations
   against the *live* Facebook preview (see below).
3. **Verified Business Suite can now schedule Facebook content.** The Planner
   loads against the Treniko asset and offers *Schedule a post or story*.
4. **Failed to connect Instagram to the Page**, and stopped rather than working
   around it. See below — this is the session's one unfinished item.
5. **Audited both accounts live** and wrote `SOCIAL_AUDIT.md`. The Instagram
   profile was **read only; nothing on it was changed.**
6. **Wrote cycle 2** — `CONTENT_BATCH_CYCLE_2.md`, 40 pieces covering
   15 Sep → 17 Oct, checked for duplication against all 21 cycle-1 pieces.
7. **Settled the UTM conflict** that had been open between two documents, and
   propagated it to every affected file.
8. **Wrote the hashtag and Facebook strategies**, and `MANUAL_QUEUE.md`.

### Files created in session 6

| File | What |
|---|---|
| `SOCIAL_AUDIT.md` | live state of both accounts, what web cannot do, and the connection blocker |
| `MANUAL_QUEUE.md` | every mobile-only action, M1–M7, ordered by value |
| `CONTENT_BATCH_CYCLE_2.md` | 10 feed · 10 Reels · 20 Stories, full field set, 15 Sep → 17 Oct |
| `HASHTAG_STRATEGY.md` | six clusters, per-pillar recipes, and what never to use |
| `FACEBOOK_STRATEGY.md` | cross-post vs native vs Instagram-only, and why the Page exists |
| `30-day/_tooling/facebook-cover.js` | deterministic cover generator |
| `facebook/fb-cover.png` | the cover itself |

Updated: `SESSION_CHECKPOINT.md`, `PUBLISHING_QUEUE.md` (Business Suite finding
corrected), `30-day/UTM_CONVENTION.md` (rewritten), `ANALYTICS_IMPLEMENTATION.md`
(conflict marked resolved), `30-day/STORY_PUBLISH_QUEUE.md` and
`CONTENT_CALENDAR_30_DAYS.md` (UTM strings only).

### The Facebook Page is named "Treniko", not "TRENIKO"

Facebook rejected the all-caps form: *"Naziv stranice 'TRENIKO' nije valjan.
Predlažemo naziv stranice 'Treniko'."* This is a platform naming rule, not a
choice, and it is a **deviation from the brief that could not be avoided**.
"Treniko" matches the `treniko.com` page title, and the wordmark in the cover
and avatar still reads TRENIKO.

### The cover took three attempts, and why that matters

Facebook uploads 1640 × 856 but **displays a wider, shorter crop**, and centres
the profile circle over the lower middle. Version 1 put the headline where the
avatar lands — the cover obscured its own tagline. Version 2 was clipped off the
top. Only version 3, tightened to a measured safe band of y 120–460, survived.

The generator now **throws** rather than emit a cover whose text falls into that
zone. Each version was checked against the live preview, not against the PNG.

### The one thing session 6 could not finish

**Instagram is still not connected to the Facebook Page.** Four attempts from
two independent entry points. The dialog's *Continue* fires a GraphQL POST that
returns 200, then waits on an Instagram OAuth **popup window** that never becomes
a reachable tab.

**No Instagram password was typed anywhere, and no attempt was made to route
around the authentication step.** Connecting from the Instagram side was also
checked — *Business tools and controls* on web offers only account-type
switching, so that route does not exist either.

It is a two-minute job in the mobile app: `MANUAL_QUEUE.md` § M1.

**Facebook Page username** is also unavailable — Facebook withholds vanity URLs
from Pages with no followers and no posts. Re-check later; `MANUAL_QUEUE.md` § M6.

---

## What session 5 did

Session 5 was infrastructure and measurement only. **No content was generated,
nothing was published, nothing was scheduled, and no application code changed.**

1. **Investigated Meta Business Suite** — the recommended fix for the Reel
   bottleneck. **It cannot manage @treniko_fitness.** Business Suite is signed
   in and holds 6 Facebook Pages, none of them TRENIKO; the asset search for
   `treniko` returns "No results"; and every Page shows "Connect Instagram",
   which is the mechanism — Business Suite reaches Instagram *through a linked
   Facebook Page*. No TRENIKO Page exists, so there is nothing to link. Full
   detail and a wrong-account hazard warning: `PUBLISHING_QUEUE.md`.
   **Nothing was connected, created or published.**
2. **Re-verified the 14 scheduled feed posts** live, across the August and
   September monthly views. Unchanged: Aug 20, 21, 24, 25, 27, 28, 31 and
   Sep 1, 3, 5, 7, 8, 11, 12. Nothing added, altered, cancelled or duplicated.
3. **Re-audited the profile** — handle, display name, bio, link, category,
   highlights (still 0), no restrictions. Nothing was changed.
4. **Read real Instagram Insights for the first time** and recorded them in
   `CONTENT_BASELINE.md`. The number that matters: **non-follower reach is 0%**.
   Nothing has entered distribution yet.
5. **Confirmed €0 spend** from the Professional dashboard: "No ads available".
6. **Inspected the codebase for the attribution plan** and traced the whole
   registration path — four files, one request. Wrote
   `ANALYTICS_IMPLEMENTATION.md`. **Plan only; nothing implemented.**

### Files created in session 5

| File | What |
|---|---|
| `ANALYTICS_IMPLEMENTATION.md` | attribution design, UTM convention, migration 034, test plan, deploy and rollback plan |
| `CONTENT_BASELINE.md` | day-2 baseline, read off the platform, `NOT AVAILABLE` where genuinely unavailable |

`PUBLISHING_QUEUE.md` gained the Meta Business Suite finding. Nothing else was
edited.

### The Reel bottleneck now has no software fix available

Both routes are closed for the moment:

- **Instagram web** — proven twice that an automated browser cannot complete the
  video preview step.
- **Meta Business Suite** — unavailable until a TRENIKO Facebook Page exists.

**Publishing the five Reels from the phone remains the only working path**, and
P05 is due **Sat 22 Aug 19:00**. That is four days away and it is the single
most valuable thing anyone can do for this account, because it is the only
content type that can reach a non-follower.

---

## What session 4 did

1. **Audited everything** — all 173 files under `marketing/`, all seven strategy
   documents, and the live Instagram profile and scheduled queue.
2. **Re-verified the five Reels.** `ffprobe` metadata plus a **full decode of
   every file: zero errors.** 1080 × 1920, 14.9 s, H.264 High / yuv420p, 30 fps,
   447 frames, faststart. Visually re-checked sampled frames from the rendered
   video: no browser chrome, no `localhost`, no fabricated data, no spelling
   errors, correct wordmark and `#0ea5e9`.
3. **Independently reproduced the Reel-scheduling blocker** (see below).
4. **Verified the scheduled queue live** — 14 items, read off both the August and
   September monthly views at `instagram.com/scheduled_content/`. Every date and
   time matches plan. **Nothing was added, changed, cancelled or duplicated.**
5. **Filled the Story gap.** Weeks 3–5 previously had **no Stories at all** while
   five feed posts and two Reels went out. Added S8–S14.
6. **Unblocked the FOR TRAINERS highlight** — its three Stories now exist.
7. **Fixed a defect in an existing unposted asset** (see below).
8. **Found that treniko.com has no analytics of any kind** — see below.
9. **Wrote the five master documents** and marked the older ones superseded.

### Assets created (11 PNGs, all 1080 × 1920, verified)

| Path | Slot |
|---|---|
| `30-day/stories/week-3/story-5-poll.png` | S8 — Mon 31 Aug |
| `30-day/stories/week-3/story-6-question.png` | S9 — Wed 2 Sep |
| `30-day/stories/week-3/story-7-reshare.png` | S10 — Sat 5 Sep |
| `30-day/stories/week-4/story-8-poll.png` | S11 — Tue 8 Sep |
| `30-day/stories/week-4/story-9-reshare.png` | S12 — Thu 10 Sep |
| `30-day/stories/week-4/story-10-question.png` | S13 — Fri 11 Sep |
| `30-day/stories/week-5/story-11-recap.png` | S14 — Mon 14 Sep |
| `30-day/stories/highlights-trainers/story-1-for.png` | FOR TRAINERS |
| `30-day/stories/highlights-trainers/story-2-not-for.png` | FOR TRAINERS |
| `30-day/stories/highlights-trainers/story-3-first-week.png` | FOR TRAINERS |
| `30-day/stories/week-2/story-4-reshare.png` | S4 — **re-rendered, see below** |

Generator: `30-day/_tooling/stories-wk3-5.js`. Run from the repository root.
Uses the existing `vertical.js` helpers, so style, canvas and safe areas are
unchanged.

### Two defects found and fixed in the marketing assets

1. **"Swipe up to the post."** — `week-2/story-4-reshare.png` told viewers to use
   a gesture Instagram removed in 2021. The card was unposted, so it was
   re-rendered to read "Tap through to the post."
2. **Unreadable support text on dark Stories.** `vpage()` defaults support text
   to `#4b5563`, which on the `#0b1220` ink ground is near-invisible on a phone.
   Caught in visual QA of the first render. The two dark cards now pass
   `body: '#cbd5e1'`. **The helper's default is unchanged** — any future dark
   card with support text must do the same, or `vertical.js` should be fixed
   properly.

### Reel web-scheduling — re-tested, still impossible here

Session 3 concluded Instagram web Reel scheduling cannot be driven from an
automated browser. Session 4 tested this a different way and got the same answer:
a video the browser **generated itself** in-page (canvas → MediaRecorder → blob)
never left `readyState 0`, timing out after 8 s with **no error code at all**.

The MP4s are sound — ffmpeg decodes all five end to end without a single error.
Video decoding is simply unavailable to the page in this browser session.

> **Not proven** that Instagram web can schedule a Reel.
> **Not proven** that it cannot.
> **Proven** that it cannot be driven from an automated browser session.

**Do not spend a fifth session retrying this.** The durable fix is Meta Business
Suite, which can schedule Reels — see `META_SETUP_PLAN.md`.

### The measurement problem — biggest strategic finding

`treniko.com` has **no analytics of any kind**. Verified by reading the
repository, not assumed:

- no GA4, Plausible, Umami, PostHog, Matomo, Fathom or Segment in `frontend/`
- no UTM parsing anywhere in the application
- no `referrer` / `source` / `utm_*` capture at registration

So the funnel breaks in the middle:

```
REACH → PROFILE VISIT → WEBSITE CLICK → ✗ → REGISTRATION → ACTIVATION
└──────── Instagram Insights ────────┘     └── nothing measures this ──┘
```

The account can currently prove interest and **cannot prove conversion**. A
proposal is written up in `ANALYTICS_PLAN.md` § *Attribution*. **No production
code was touched** — it is a backlog item requiring a migration, tests and a
deliberate deploy.

---

## Live Instagram state — observed 18 Aug 2026, 12:00

| Field | Value |
|---|---|
| Handle | `@treniko_fitness` |
| Display name | TRENIKO \| Personal Trainer Software |
| Followers | **2** · Following **0** · Posts **2** |
| Bio | Run your coaching business — not spreadsheets. / Clients · Sessions · Payments · Progress / ↓ Free for early adopters |
| Link | `www.treniko.com` — **unchanged** |
| Category | Product/service |
| Highlights | **0** |
| Restrictions | **none visible** |
| Reach / impressions / profile visits / clicks | **NOT YET MEASURED** |

The display name has been applied since session 2 recorded it as "not applied" —
someone set it from the mobile app. `PROFILE.md` is stale on that one row.

**Nothing on the profile was modified in session 4.** Bio, link, name, category
and photo were read only.

---

## Open decisions for the founder

1. **Swap P05 and P10?** P10 scores highest of the five Reels (8.5 vs 7.7) and is
   currently second out. The first Reel on an account with no history does the
   most work seeding distribution. Both are manual, so the swap costs only a
   decision. **Not changed** — the brief said keep the established dates.
2. **P14 time: 12:30 or 12:00?** Four existing files and the Reel's own caption
   header say **12:30**; the session-4 brief said 12:00. **12:30 kept.** Nothing
   is scheduled either way. If you change it, change all five files.
3. **P18 caption first line.** Weakest hook of the five (6.8). A stronger opening
   line is proposed in `PUBLISHING_QUEUE.md` § 1. The video is unchanged.
4. ~~**Facebook Page** — nothing created.~~ **Done in session 6.** The Page
   exists, is branded, and unlocks Facebook scheduling.
   `META_SETUP_PLAN.md` recommended waiting until 7–14 Sep; the session-6 brief
   asked for it now, so it was created now. `FACEBOOK_STRATEGY.md` is honest
   about what that does and does not buy.
5. **Instagram DM access in the Page inbox** was turned **off** during setup —
   the flow defaults it on. It widens who can read a new account's DMs for no
   benefit anyone asked for. One toggle to reverse if the shared inbox is ever
   wanted.

---

## The gap after 14 Sep — now written, not yet built

**Cycle 2 exists as concepts:** `CONTENT_BATCH_CYCLE_2.md`, 40 pieces covering
**Tue 15 Sep → Sat 17 Oct 2026**. Copy is final; **no asset has been rendered.**

Instagram's scheduling horizon is roughly 29 days, so cycle 2 cannot be scheduled
until early September regardless.

**Treat that file as a strong starting point, not a commitment.** Rewrite from
the day-14 and day-21 review data before building assets — keep what the reach
numbers support and cut what they do not.

Two things carried into it, both already applied:

1. **Reel cadence.** `STRATEGY.md` asks for two Reels a week; cycle 1 ran one.
   Cycle 2 runs **two**, taking the Reel share from 24% to 50%. Reels are the
   only realistic reach engine for an account at 0% non-follower reach.
2. **Do not reuse** the "POV:" opener (P14) or the "what X should actually look
   like" pattern (P18). Both scored lowest on hook strength. **Neither appears
   in cycle 2** — checked against all 21 cycle-1 pieces.

---

## Guardrails held — all six sessions

English only · no invented statistics, testimonials, customers, revenue or user
counts · no fabricated product features · no fabricated UI · no customer data ·
no copyrighted music · no ads, no boosts, no payment method, no ad account,
**€0 spent** · no TikTok, LinkedIn or YouTube account created · no personal
Facebook account or non-TRENIKO Meta asset touched · no Instagram password
typed and no authentication step routed around ·
nothing published to a personal account · **nothing already scheduled was
cancelled, rescheduled, duplicated or rewritten** · no production application
code touched · no production data touched · every claim of "scheduled" or
"published" in these files was read back off Instagram itself.
