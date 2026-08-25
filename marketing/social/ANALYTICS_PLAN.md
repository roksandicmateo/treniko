# TRENIKO — analytics and measurement plan

**Written:** 18 Aug 2026, session 4.
**Baseline:** almost everything below is **NOT YET MEASURED**. That is the
honest starting state and it is written that way deliberately — every number in
this file is either observed or explicitly absent. None is estimated.

---

## The funnel

```
REACH → PROFILE VISIT → WEBSITE CLICK → REGISTRATION → ACTIVATION → RETENTION
└──────────── Instagram Insights ────────────┘ ╳ └──── nothing measures this ────┘
```

**There is a hard break in the middle of the funnel.** Instagram can tell you
how many people clicked through to `treniko.com`. Nothing on the other side
records that they arrived, who they were, or whether they signed up.

Verified in session 4 by reading the repository, not by assumption:

| Check | Result |
|---|---|
| Any analytics script (GA4, Plausible, Umami, PostHog, Matomo, Fathom, Segment) in `frontend/` | **None** |
| Any UTM parsing anywhere in the app | **None** |
| Any `referrer` / `source` / `utm_*` column or capture at registration | **None** |

So today the account can prove *interest* and cannot prove *conversion*. Growth
decisions for at least the first cycle must be made on Instagram-side metrics
alone, and that limitation should be stated out loud rather than papered over.

---

## What is measured today

**Instagram Insights only**, on a Business account, from the app
(Professional dashboard → Insights) or the web at `instagram.com/insights`.

Insights is retention-limited — most breakdowns go back about 90 days and some
only 30. **Record weekly rather than relying on Instagram to remember.**

### Account baseline — observed 18 Aug 2026, 12:00 Europe/Zagreb

| Field | Value |
|---|---|
| Handle | `@treniko_fitness` |
| Display name | TRENIKO \| Personal Trainer Software |
| Followers | **2** |
| Following | **0** |
| Posts | **2** (P01, P02) |
| Bio | Run your coaching business — not spreadsheets. / Clients · Sessions · Payments · Progress / ↓ Free for early adopters |
| Link | `www.treniko.com` |
| Category | Product/service |
| Highlights | **0** |
| Account restrictions visible | **None** |
| Reach, impressions, profile visits, website clicks | **NOT YET MEASURED** |

Two followers and two posts. Everything below is instrumentation for a system
that does not have data yet — which is the right time to build it, and the wrong
time to draw conclusions.

---

## Weekly measurement — every Monday

Log into `30-day/METRICS_TEMPLATE.md`. Never leave a cell blank: write
`not measured` or `n/a` so a gap is visibly a gap rather than a forgotten row.

### Instagram — account level

| Metric | Source | Baseline |
|---|---|---|
| Followers | Insights → Total followers | 2 |
| Follows gained / lost this week | Insights → Follows | not measured |
| Accounts reached | Insights → Reach | not measured |
| Impressions | Insights → Impressions | not measured |
| **Non-follower reach %** | Insights → Reach → Followers vs non-followers | not measured |
| Profile visits | Insights → Profile activity | not measured |
| **Website clicks** | Insights → Profile activity → external link taps | not measured |

Non-follower reach is the single most important account-level number at this
stage. It is the only one that says whether Instagram is showing the account to
people who do not already know it.

### Instagram — per post and per Reel

| Metric | Applies to | Baseline |
|---|---|---|
| Reach | all | not measured |
| Likes / Comments | all | not measured |
| **Saves** | carousels, educational | not measured |
| **Shares** | pain, relatable | not measured |
| Profile visits from this post | all | not measured |
| Reel plays | Reels | not measured |
| **Average watch time / retention** | Reels | not measured |
| Poll votes / question replies | Stories | not measured |

Judge each pillar on the metric it is designed to produce, not on likes:

| Pillar | Judge on |
|---|---|
| Trainer pain / relatable | **Shares** — did a trainer send it to another trainer |
| Practical business tips | **Saves** |
| Product-led | **Profile visits → website clicks** |
| Conversation / research | **Comments and replies**, plus the quality of what they say |
| Brand / CTA | **Website clicks** |

A pain post with 4 likes and 9 shares beat a product post with 40 likes and 0
clicks. Read them that way.

### Business — currently unmeasurable

| Metric | Definition | Status |
|---|---|---|
| Sessions on treniko.com from Instagram | landing with `utm_source=instagram` | **NOT MEASURABLE — no analytics** |
| Registration starts | `/register` reached | **NOT MEASURABLE** |
| Registrations completed | new row in `users` | countable in the DB, **not attributable to a source** |
| Activated trainers | added ≥1 client | countable in the DB, not attributable |
| First client created | first `clients` row for a tenant | countable in the DB, not attributable |
| First session created | first `training_sessions` row | countable in the DB, not attributable |
| Retention | still creating sessions in week 4 | countable in the DB, not attributable |

The last five are derivable from the production database today with a read-only
query, but **only as totals** — nothing links a signup back to a Reel. Counting
them from the day the first Reel goes out is still worth doing: a step change
after 22 Aug is weak evidence, and weak evidence beats none.

---

## What "successful content" means here

Not followers. An account can buy 10,000 followers and sell nothing.

**Tier 1 — the piece did its job**
- Non-follower reach above the account's own trailing average
- Shares (pain / relatable) or saves (educational) above trailing average
- At least one comment from someone who is visibly a personal trainer

**Tier 2 — the piece moved someone**
- Measurable profile visits attributable to it
- Website clicks in the same window

**Tier 3 — the piece produced a trainer**
- A registration that can be traced to it. **Not currently possible.** Tier 3
  stays theoretical until the attribution work below is done.

**A piece that reaches a large non-trainer audience has failed**, however well it
performs. Qualified attention only. If a Reel goes wide with general-fitness
viewers, that is a signal to change the hook, not to celebrate.

---

## Review checkpoints

| Checkpoint | Date | Question to answer |
|---|---|---|
| Day 7 | Mon 24 Aug | Did anything reach non-followers at all? |
| Day 14 | Mon 31 Aug | Which of the first two Reels outperformed, and on which metric? |
| Day 21 | Mon 7 Sep | Which pillar earns shares? Which earns clicks? **Write cycle 2 from this.** |
| Day 30 | Wed 16 Sep | Re-score the hooks in `CONTENT_CALENDAR_30_DAYS.md` against real reach. |

Do not rewrite the calendar before data exists. Two data points are not a trend,
and an account with 2 followers will produce noisy numbers for several weeks.

---

## Attribution — recommendation only, nothing implemented

**No production code was modified, and none should be as part of a marketing
task.** This is a proposal for the product backlog.

### Step 1 — make UTMs land somewhere (required first)

Tagging links that nothing reads produces no attribution, only uglier URLs. So
the first step is a destination, not a tag.

Lightest option that fits the existing stack: a privacy-respecting, cookieless
analytics script (Plausible, Umami, Fathom) added to `frontend/index.html`.
Records sessions, referrers and UTM parameters with no consent banner required
in the EU, which matters for a GDPR-conscious product that already ships a DPA
flow.

### Step 2 — carry the source through registration

To close the funnel properly the source has to survive from landing to signup:

1. On first landing, read `utm_source` / `utm_medium` / `utm_campaign` /
   `utm_content` and keep them in `sessionStorage`.
2. Include them in the `POST /api/auth/register` body.
3. Persist on the tenant or user row — a new nullable `signup_source` /
   `signup_campaign` column, added by a normal migration.

That is a small, additive change. It touches the registration path, so it needs
its own migration, its own tests and a deliberate deploy — **not** a marketing
session. Raise it as a backlog item.

Privacy note: UTM values are campaign labels, not personal data. Do not put
anything identifying a person into a URL parameter.

### Step 3 — the bio link stays clean

**Recommendation: do not UTM the bio link.**

- Instagram already appends its own tracking to outbound bio clicks
  (`utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=…`). Adding
  ours on top risks one overriding or duplicating the other.
- Instagram Insights already reports profile visits → website clicks directly.
- A long parameter string in the one visible link on the profile looks
  untrustworthy and costs more clicks than the attribution is worth at 2
  followers.

The bio link field is also **editable only from the Instagram mobile app** — the
web Edit profile page shows it read-only ("Editing your links is only available
on mobile"). Established in session 2; not re-verified in session 4, because the
recommendation is to leave it exactly as it is.

Current value `www.treniko.com` is correct and **was not changed**.

### Where UTMs are worth using now

| Placement | Tagged? | Why |
|---|---|---|
| Bio link | **No** | see above |
| **Story link stickers** | **Yes** | the sticker hides the URL, so length is free — exact strings in `PUBLISHING_QUEUE.md` |
| Link sent in a DM or comment reply | Yes | |
| Anything in a caption | No | captions are not clickable on Instagram; a UTM there only makes the text uglier |

Full convention: `30-day/UTM_CONVENTION.md`.

---

## Rules for this file

- **Never fabricate a number.** `not measured` is a valid and useful entry.
- Never report a platform metric that was not read off the platform.
- Screenshot Insights weekly — Instagram's retention windows are shorter than
  this campaign.
- Record what was *published when*, so a spike can be matched to a cause. A
  metric with no timeline beside it explains nothing.
