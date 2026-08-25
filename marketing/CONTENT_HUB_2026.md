# TRENIKO — the resource hub, and what belongs in it

**Written:** 25 Aug 2026 · Supersedes the topic list in `CONTENT_ROADMAP.md`,
which was written before the current twelve pages existed.

The brief asked for 10–20 topics ranked by intent × relevance × difficulty ×
usefulness, with a reason each page deserves to exist. What follows is that list
— and the most important column is the one that says **"already covered, do not
write this."** Six of the twenty candidates are in that column. A hub gets worse
when a topic is covered twice.

---

## 1. What already exists

Twelve public pages, eleven of them content.

| URL | Intent | Words |
|---|---|---|
| `/` | Brand / product | 1,723 |
| `/personal-trainer-software` | Commercial, broad | ~1,090 |
| `/personal-trainer-client-management-software` | Commercial, narrow | ~1,000 |
| `/free-personal-trainer-client-tracker` | **Tool / highest-intent** | ~900 |
| `/guides` | Hub | ~450 |
| `/guides/client-management` | Informational | ~1,050 |
| `/guides/session-packages` | Informational | ~915 |
| `/guides/software-vs-spreadsheets` | Comparison | ~955 |
| `/guides/cancellation-policy` | Policy | ~1,330 |
| `/guides/no-show-clients` | Policy | ~1,200 |
| `/guides/pricing-personal-training-packages` | Business decision | ~1,250 |
| `/guides/new-client-first-week` | Workflow | ~1,050 |

**That is already a real hub.** The correct instinct at this point is not to
double it. It is to leave it alone for two to three months, connect Search
Console, and let real query data decide the next five pages.

---

## 2. The twenty candidates

Ranked by intent × relevance × winnability × usefulness. **Winnable** means the
current SERP is vendor documentation or thin affiliate content rather than
established editorial — assessed by looking at it, not by a difficulty score
nobody paid for.

### Already covered — do not write these

| Candidate from the brief | Where it already lives |
|---|---|
| client management | `/guides/client-management` |
| session tracking | `/guides/session-packages` |
| package tracking | `/guides/session-packages` |
| personal training packages | `/guides/pricing-personal-training-packages` |
| no-show clients | `/guides/no-show-clients` |
| cancellation policy | `/guides/cancellation-policy` |
| tracking remaining sessions | `/guides/session-packages` |
| client onboarding | `/guides/new-client-first-week` |
| spreadsheet problems | `/guides/software-vs-spreadsheets` |
| personal trainer software | `/personal-trainer-software` |
| client management software for PTs | `/personal-trainer-client-management-software` |

Eleven of the sixteen topics named in the brief are already served. Writing any
of them again produces two pages competing with each other for one query, and
the site loses both.

### Worth writing — in this order, and not all at once

| # | Page | Why it deserves to exist | Intent | Winnable | Effort |
|---|---|---|---|---|---|
| **1** | `/guides/client-retention` | The gap the existing pages circle without landing on. Cancellations, no-shows and packages are all *symptoms*; the question "why do clients stop, and what is the earliest signal" is the one underneath them, and nothing currently answers it. Also the only topic here a trainer would send to another trainer | Informational, high | Medium — trainer blogs cover it, mostly with platitudes | High |
| **2** | `/guides/managing-many-clients` | A genuine threshold question — *"what breaks between 10 clients and 30"*. Distinct from client-management, which is about one client. This is about the system failing at scale, which is precisely when someone starts looking for software | Problem-aware, pre-purchase | Good — mostly unserved | Medium |
| **3** | `/guides/recurring-sessions` | Standing weekly slots are how almost every trainer actually schedules, and every guide on this site references them without explaining how to run them. Concrete and unglamorous, which is why nobody has written it well | Workflow | **Good** — near-empty SERP | Medium |
| **4** | `/guides/trainer-admin-checklist` | A weekly/monthly operating checklist. Earns its place only because it becomes a *second downloadable*, which is the format that travels in communities. As a page alone it would be thin | Tool-adjacent | Medium | Medium |
| **5** | `/guides/getting-paid-on-time` | Chasing payment is named in three existing pages and explained in none. Awkward, universal, and the thing trainers are least willing to ask about publicly | Informational | Good | Medium |
| 6 | `/guides/going-independent` | Leaving a gym to train independently: what you suddenly own. Broad, high-emotion, and it reaches people *before* they need software — which is both its value and its risk | Top of funnel | Hard — well covered | Large |
| 7 | `/guides/online-vs-in-person` | Hybrid coaching admin. Real, but adjacent to a product that does not do online delivery, so it would attract traffic TRENIKO cannot serve | Informational | Medium | Medium |
| 8 | `/guides/client-intake-form` | What to ask, and the GDPR reason not to ask more. Partly inside `new-client-first-week`; only worth splitting out if query data shows demand | Workflow | Medium | Small |
| 9 | `/personal-trainer-scheduling-software` | Commercial, and a genuinely distinct intent from client management | Commercial | **Hard** — Trainerize ranks here with a dedicated page | Medium |

**Cut, with reasons:**

- *"personal trainer business organization"* and *"trainer admin"* as separate
  pages — these are the same page as #4 with different words on the front.
- *"how personal trainers manage clients"* — the question `/guides/client-management`
  already answers. A second page targeting the interrogative phrasing of a
  covered query is doorway-shaped.
- *"free personal trainer software"* — TRENIKO is free today and pricing is not
  decided. Competing for that phrase now recruits people who leave the moment it
  is.

### The recommendation

**Write #1–#3 over the next two months. Then stop and read Search Console.**

Not #4 and #5 yet — not because they are bad, but because five more pages
written from the same guesses as the last five doubles the guess rather than
testing it. Three is enough to keep the site alive to Google while the data
arrives.

---

## 3. Architecture

The structure the brief asks for already exists. Verified live, not asserted:

```
/                                             (prerendered, 1,723 words)
├── /personal-trainer-software                commercial, broad
│   └── /personal-trainer-client-management-software   commercial, narrow
├── /free-personal-trainer-client-tracker     the tool
└── /guides                                   hub
    ├── /guides/client-management
    ├── /guides/session-packages
    ├── /guides/software-vs-spreadsheets
    ├── /guides/cancellation-policy
    ├── /guides/no-show-clients
    ├── /guides/pricing-personal-training-packages
    └── /guides/new-client-first-week
```

Every page has, and `check-seo.mjs` fails the build if it does not:

- a link to its parent (breadcrumb, visible and in schema)
- links to relevant siblings, in the body where the sentence earns one and in a
  "Read next" block
- a CTA into TRENIKO, phrased as an option rather than a demand
- a self-referential canonical, a sitemap entry, and `index, follow`
- **at least one inbound internal link** — the orphan check, which is the one
  that quietly fails as a site grows

**Zero orphans. Zero broken internal links.** Both asserted on every build.

**No circular link spam.** The homepage links to six pages editorially, not to
all eleven; guides link to two or three siblings each, chosen for relevance;
nothing links to everything.

Where a new page goes:

- A **guide** goes under `/guides/`, gets a card on the hub, and needs at least
  two inbound links from existing guides — otherwise the orphan check fails the
  build, which is the intended forcing function.
- A **commercial** page sits at the root, like the two that exist. Root-level
  URLs are reserved for pages targeting a buying query; there should never be
  many.

---

## 4. Competitors — what they do well, and what to do about it

Re-examined 25 Aug 2026. **Nothing has been copied**; the point is to find the
gap, not the template.

| Competitor | Strong at | Where TRENIKO cannot win | Where TRENIKO can |
|---|---|---|---|
| **ABC Trainerize** | Category-defining. ~98 pages of blog archive, several posts a week, whole content team. Owns broad "fitness business" queries | Anything broad: marketing, Instagram growth, referral systems, industry trends | Their own users are [asking them for session tracking inside packages](https://ideas.trainerize.com/forums/167887-coach-trainer-trainerize/suggestions/31368610-add-session-tracking-when-creating-packages-in-tra). The admin half is a bolt-on for them and the whole product for TRENIKO |
| **TrueCoach** | Programming speed, clean UX | Workout building | It is a programming tool. It does not answer "has she paid" |
| **PTminder** | All-in-one for studios | Studios, staff, rooms | Studio-shaped setup is overhead for a solo trainer — the "time to first client" argument |
| **FitSW** | Ranks for the operational long-tails | — | Its top page is 2022 vendor documentation, ~850 words, ~60% product tour. **Beatable with a platform-agnostic answer** |
| **Everfit** | Free Starter tier | Free-tier competition | Same wedge; differentiate on being a *business* tool, not a coaching-delivery tool |

**Three concrete actions this produces:**

1. **Never write a broad "fitness business" post.** Trainerize publishes several
   a week with a team. That fight is unwinnable and the attempt costs the
   specificity that makes the current pages work.
2. **Keep writing the operational questions their content treats as settings
   screens.** Every page here that ranks will rank because it answers the
   question without requiring the reader to adopt anything.
3. **Product, not content:** the recurring-session workflow (#3 above) is the
   thing every competitor assumes and none explains. If TRENIKO's handling of
   standing weekly slots is good, that page writes itself from the product; if
   it is not, that is the more useful finding.

---

## 5. The rule this file exists to enforce

A page gets written when there is a question with a non-obvious answer that no
page here answers yet.

Not when a keyword is unclaimed. Not to reach a page count. Not because a
competitor has one.

Twelve pages that each deserve to exist will outperform forty that do not, on a
domain with no authority — and the forty carry a real risk the twelve do not.
