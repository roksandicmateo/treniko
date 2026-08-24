# TRENIKO — organic content roadmap

**Written:** 24 Aug 2026 · **Budget: €0**

Twenty-four pages, ordered by what a brand-new domain can realistically win.

> **No search volumes appear in this document.** TRENIKO has no keyword tool and
> buying one costs money, so every priority below is reasoned from *intent* and
> *competition shape*, and is **unvalidated**. Search Console will replace this
> with observed queries within weeks of verification — at which point tiers 2
> and 3 should be re-sorted against real impressions rather than this guesswork.
> That is not a caveat to skim; it is the difference between a roadmap and a
> wish list.

---

## Already live (7)

| URL | Intent |
|---|---|
| `/` | Brand / product |
| `/personal-trainer-software` | Commercial |
| `/free-personal-trainer-client-tracker` | Free resource — highest-intent |
| `/guides` | Hub |
| `/guides/client-management` | Informational |
| `/guides/session-packages` | Informational |
| `/guides/software-vs-spreadsheets` | Comparison |

---

## How these are ordered

Informational and problem-shaped pages come first, not because they convert
better — they convert worse — but because they are **winnable**. A domain with
no authority will not rank for *"personal trainer software"* this year. It can
rank for a specific question nobody has answered well, and the trainer asking
*"do I charge for a late cancellation?"* is closer to needing the product than
the one typing a category name.

Every page must earn its place on its own: **useful to a trainer who never signs
up.** A page that only pays off if you register is a doorway page with better
manners, and Google has been good at spotting those for a decade.

---

## Tier 1 — write these next (5)

Highest confidence. Each is a question trainers actually ask, with no good
existing answer, and each links naturally to something we already have.

### 1. `/guides/cancellation-policy`
- **Intent:** Problem / informational — *"personal trainer cancellation policy"*, *"do PTs charge for no-shows"*
- **Audience:** Any trainer who has been burned once
- **Primary:** What to write, and how to say it when someone buys
- **Secondary:** Late cancellation vs no-show, illness, trainer-cancelled sessions
- **CTA:** Free tracker (the policy goes in its Notes column)
- **Links:** → `/guides/session-packages`, `/free-personal-trainer-client-tracker`
- **Why:** Currently a table inside another page. It is a whole question on its own, it is emotionally charged, and it is the one policy every trainer eventually needs

### 2. `/guides/pricing-personal-training-packages`
- **Intent:** Commercial-adjacent — *"how much to charge for PT packages"*
- **Audience:** Trainers setting or raising prices
- **Primary:** A *method* for arriving at a number
- **Secondary:** Package vs per-session, discounting blocks, raising prices on existing clients
- **CTA:** Free tracker
- **Links:** → `/guides/session-packages`
- **Why:** High intent and widely searched. **Must give a method, never invented market rates** — fabricating "the average PT charges €X" is the exact failure mode here

### 3. `/guides/new-client-first-week`
- **Intent:** Informational — *"personal trainer client onboarding"*
- **Audience:** Trainers whose first week is improvised
- **Primary:** A checklist from enquiry to second session
- **Secondary:** Intake questions, consent, what to record on day one
- **CTA:** Free tracker
- **Links:** → `/guides/client-management`
- **Why:** Pairs directly with the template and is a natural second free resource later

### 4. `/guides/no-show-clients`
- **Intent:** Problem — *"client keeps not showing up"*
- **Audience:** Trainers with one specific painful client
- **Primary:** What to do, in order, before firing them
- **Secondary:** Spotting the pattern early, the conversation, when to let them go
- **CTA:** Soft — TRENIKO records no-shows as distinct from cancellations
- **Links:** → `/guides/cancellation-policy`, `/guides/session-packages`
- **Why:** Sharp, emotional, specific. Exactly the shape a new domain can rank for

### 5. `/personal-trainer-client-management-software`
- **Intent:** **Commercial** — the long-tail of the head term
- **Audience:** Actively shopping
- **Primary:** What client management specifically means in this category
- **Secondary:** What to check, migration, export
- **CTA:** Register
- **Links:** → `/personal-trainer-software`, `/guides/client-management`
- **Why:** More specific and far less contested than the head term. Distinct enough from `/personal-trainer-software` to not be a duplicate — **if it starts saying the same things, merge them rather than keeping both**

---

## Tier 2 — after Search Console has data (9)

Re-sort these against observed impressions before writing any of them.

| # | URL | Intent | Why |
|---|---|---|---|
| 6 | `/guides/group-sessions` | Informational | Group training has different admin; nothing we have covers it |
| 7 | `/guides/tracking-client-progress` | Informational | What to measure, how often, what to ignore |
| 8 | `/guides/getting-paid-on-time` | Problem | Chasing payments — universal, rarely written about honestly |
| 9 | `/guides/online-vs-in-person-admin` | Informational | Hybrid coaching changed the admin; underserved |
| 10 | `/guides/client-retention` | Informational | The weekly-check habit, expanded |
| 11 | `/guides/going-independent-from-a-gym` | Informational | High emotion, high search, natural fit for the ICP |
| 12 | `/guides/gdpr-for-personal-trainers` | Informational | EU trainers hold health data and mostly do not know their obligations. **Must not give legal advice** — explain the shape and say when to ask a professional |
| 13 | `/personal-trainer-scheduling-software` | Commercial | Long-tail commercial. Only if it can say something `/personal-trainer-software` does not |
| 14 | `/guides/exercise-library` | Informational | Building and reusing programmes |

---

## Tier 3 — depends on decisions not yet made (10)

| # | URL | Intent | Blocked on |
|---|---|---|---|
| 15–19 | Croatian equivalents of the tier-1 pages | Commercial + informational | **The language decision.** Croatian terms are almost certainly low-volume and near-zero-competition — a cheap win — but it contradicts the standing English-only rule for public copy. See `ORGANIC_GROWTH_PLAN.md` § 14.3 |
| 20 | `/guides/switching-from-spreadsheets` | Commercial | Better written once a real trainer has actually done it |
| 21 | `/free-personal-trainer-onboarding-checklist` | Free resource | Second lead magnet — only after the first shows it attracts anyone |
| 22 | `/guides/what-to-do-when-a-client-quits` | Problem | Good topic, lower priority |
| 23 | `/guides/managing-40-clients` | Informational | Needs a real trainer's input to be credible |
| 24 | `/compare/treniko-vs-spreadsheet` | Commercial | ⚠️ Comparison pages naming **competitors** are deliberately excluded: they require claims about other products that we cannot verify and would have to keep accurate |

---

## Rules for every page

1. **Useful without registering.** No exceptions.
2. **No invented statistics, customers, testimonials or ratings** — in the copy
   or in the structured data. The test suite enforces the second part.
3. **Say when TRENIKO is the wrong answer.** It filters traffic to people the
   product can help, and it is the reason anything else on the page is believed.
4. **English only**, unless the tier-3 language decision changes that.
5. **One primary intent per page.** Two intents means two pages, or one page
   that ranks for neither.
6. **Internal links both ways.** A page nothing links to is a page Google finds
   last and users never find at all.
7. **Static HTML** via `scripts/generate-content-pages.mjs` — the content pages
   must not depend on a crawler executing JavaScript.

## Cadence

**One page a week, at most.** Twenty-four good pages take six months, and that
is fine. Publishing thirty in a fortnight produces thin content, dilutes the
crawl budget of a domain that has very little, and is the single most common way
a young site teaches Google to ignore it.

**Stop at tier 1 until Search Console has data.** Writing tiers 2 and 3 against
this guesswork rather than against observed queries would be optimising blind —
and there is no reason to, since the data is two weeks away once the DNS record
is added.
