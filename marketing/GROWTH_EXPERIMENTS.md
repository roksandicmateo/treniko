# TRENIKO — free growth experiments, ranked

**Written:** 25 Aug 2026 · **Every experiment here costs €0.**

Eighteen experiments. Each one names how it would be measured, because an
experiment with no measurement is an activity.

Two constraints shape the whole list and are worth stating rather than
discovering:

1. **Nothing can be measured properly until Search Console exists.** The
   first-party counter sees a visit after it arrives. It cannot see an
   impression that never became a click, and at this stage that is most of the
   information. `MANUAL_QUEUE.md` U1.
2. **Sample sizes will be too small to compute a rate for months.** Two signups
   out of forty views is not a 5% conversion rate, it is two signups. The admin
   dashboard already suppresses the aggregate rate for this reason; the same
   discipline applies here.

**Scoring.** Impact and effort are 1–5. *Time to result* is when a signal would
be readable, not when the work is done. Risk is what it could cost if it goes
badly.

---

## Tier 1 — done this session

| # | Experiment | Impact | Effort | Time to result | Risk | Measured by |
|---|---|---|---|---|---|---|
| E1 | **Five guide pages on unanswered questions** | 5 | 4 | 2–4 months | None | GSC impressions per URL; `byPath` in admin |
| E2 | **XLSX tracker replacing CSV-only** | 4 | 2 | Weeks | None | Downloads; `/free-personal-trainer-client-tracker` views |
| E3 | **Homepage resource band** (was footer-only linking) | 3 | 1 | Weeks | Low — sits below the CTA, so it cannot intercept a signup | `byPath` on guide URLs with `(direct)` source |
| E4 | **Soft-404 `noindex`** | 3 | 1 | 1–2 months | None | GSC "Crawled — currently not indexed" count |
| E5 | **`check-seo.mjs` gating the build** | 3 | 2 | Immediate | None | Build fails or it does not |

**Status: shipped and verified in production at `06101ec`.** E1–E4 are live;
E5 runs on every build.

---

## Tier 2 — highest value still available, all blocked on an account

Ordered by expected return per minute of your time. Full instructions for each
are in `MANUAL_QUEUE.md`.

| # | Experiment | Impact | Effort | Time to result | Risk | Measured by |
|---|---|---|---|---|---|---|
| E6 | **Google Search Console** | 5 | 1 | Immediate | None | Its own existence. Unblocks everything below |
| E7 | **Capterra / Software Advice / GetApp free listing** | 5 | 3 | 1–2 months | Low — they will try to sell PPC. Decline | `utm_source=capterra` in admin |
| E8 | **Bing Webmaster Tools** | 2 | 1 | Weeks | None | Its own dashboard; also feeds DuckDuckGo and some AI engines |
| E9 | **SaaSHub listing** | 3 | 2 | 1–3 months | Low | `utm_source=saashub` |
| E10 | **AlternativeTo listing** | 3 | 2 | 1–3 months | Low | `utm_source=alternativeto` |
| E11 | **Croatian trainer Facebook groups** | **5** | 4 | Weeks | **Medium** — a badly judged post burns the group permanently | Signups with no UTM but a Croatian referrer; honestly, mostly by asking |
| E12 | **Indie Hackers technical write-up** | 3 | 3 | Days | Low | `utm_source=indiehackers`; referral traffic spike |
| E13 | **Set the bio link to the free tracker** | 3 | 1 | Weeks | None | `utm_content=link-in-bio` |

**E11 is the highest-impact item on this entire page** and the one I can help
with least. The first ten users of a product like this come from a room where
trainers already talk to each other, not from Google. Google is the compounding
channel; it is not the first one.

---

## Tier 3 — worth doing, lower or slower return

| # | Experiment | Impact | Effort | Time to result | Risk | Measured by |
|---|---|---|---|---|---|---|
| E14 | **thePTDC contribution pitch** | 4 if accepted | 4 | Months | Low | Referral traffic; a real editorial backlink |
| E15 | **Outreach to five small trainer-educators** | 3 | 3 | Weeks | Low, if there is no ask attached | Replies; referral traffic |
| E16 | **Crunchbase listing** | 1 | 2 | Months | None | Brand/entity signal only. Do not expect traffic |
| E17 | **A second free tool** — a package-price or session-cost calculator, as a static page | 3 | 3 | Months | None | Its own page views |
| E18 | **Croatian-language content** | Unknown | 5 | Months | **Medium** — it doubles the maintenance surface permanently | Cannot be estimated before E6 and E11 |

---

## Explicitly rejected, with the reason

Recording these matters as much as the list above: without a reason written
down, a rejected idea comes back every quarter.

| Idea | Why not |
|---|---|
| **Product Hunt launch now** | One-shot. Spending it with no users and nothing to comment on converts the largest free attention event available into nothing. Hold |
| **Programmatic SEO** (`/software-for-[niche]`, `/[city]`) | No genuinely unique content exists per page, and at zero domain authority it is a doorway-page pattern that spends crawl budget on near-duplicates. Reasoned out fully in `RESEARCH_2026.md` § 8 |
| **"Best personal trainer software 2026" pages** | Owned by affiliate content with years of history. Unwinnable now, and the attempt produces thin comparison pages |
| **"Submit to 300 directories"** | Link farms. Real downside, no upside — the mass-submission pattern is what gets a young domain discounted |
| **Google Analytics or Meta Pixel** | The first-party counter already answers the questions being asked, without a consent banner obligation or a third party holding the data. Adding either would be a downgrade dressed as instrumentation |
| **Email gate on the free tracker** | Would buy a list of addresses rather than users, and would make the page worse for exactly the person it is for |
| **Asking anyone for a review** before there are real users | A review from a non-user is fabricated, whoever writes it |

---

## What to do in what order

1. **E6** — ten minutes, and every measurement below depends on it.
2. **E11** — start reading group rules this week. It is slow to start and it is
   the likeliest source of the first real user.
3. **E7** — one long session, highest commercial intent available for free.
4. **E13** — one tap, and it makes every existing scheduled post point at
   something.
5. **Then wait.** E1's pages need two to four months before there is anything to
   read in Search Console. Writing more pages before that data arrives is
   guessing twice instead of once — and the roadmap in `CONTENT_ROADMAP.md`
   already says the same thing.
