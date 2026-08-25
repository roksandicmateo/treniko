# TRENIKO — market, search and distribution research

**Researched:** 25 Aug 2026 · **Budget spent: €0** · **Tools used: public web only**

No keyword tool was bought and none was used. Every number below is either
copied from a page I actually loaded (and cited) or absent. Where a claim is
plausible but unverified it says **unverified** — that label is not decoration,
it is the difference between this document being useful and being fiction.

Three things I could not check, stated up front so nothing downstream pretends
otherwise:

- **Search volume for every keyword in § 4 is unknown.** Google Keyword Planner
  needs an Ads account, Ahrefs and Semrush cost money. The ranking below is by
  *intent quality and winnability*, not by volume.
- **Reddit is not readable by my fetcher** (`reddit.com` is blocked to the
  crawler). Reddit findings in § 3 come from third-party pages quoting trainers,
  not from threads I read. Treat them as weaker evidence.
- **StartupBlink and EU-Startups both returned 403** to an automated fetch, so
  their submission terms are `COULD NOT VERIFY`, not "free".

---

## 1. Competitive landscape

### 1.1 Who actually occupies this category

| Product | Position | What it optimises for | Where it leaves room |
|---|---|---|---|
| **ABC Trainerize** | Category leader for online coaching | Program delivery, branded client app, nutrition, wearables | Heavy. Session-*package* tracking is a bolt-on — their own [idea forum has an open request to add session tracking to packages](https://ideas.trainerize.com/forums/167887-coach-trainer-trainerize/suggestions/31368610-add-session-tracking-when-creating-packages-in-tra) |
| **TrueCoach** | Programming-first, solo/small | Fast workout builder, clean UX | Programming tool more than a business tool |
| **PTminder** | Independent trainers + boutique studios | All-in-one business management | Studio-shaped: rooms, staff, memberships |
| **FitSW** | Broad SMB fitness | Session credits, workouts, payments | Content is vendor documentation (see § 1.3) |
| **Everfit** | Free Starter tier | Online coaching at zero entry cost | Free tier is the acquisition wedge — TRENIKO's is too |
| **Hevy Coach** | New, fast, cheap | Logging and programming | Not a client-business system |

**The structural observation that matters:** almost every product in this
category is built around *programming and delivering training*. The
administrative half — who paid, for how many sessions, how many are left, when
does it expire — is treated as secondary almost everywhere. Trainerize's own
users are asking for it. That is where TRENIKO's copy already points, and the
research says keep pointing there.

**Two comparison sites that matter commercially**, because trainers land on them
when they are ready to buy: Software Advice and Capterra/GetApp. Both list this
category. Both have free vendor listings. See § 6.

### 1.2 Competitor content strategy — what the SERP is made of

For the informational long-tails TRENIKO targets, the pages that rank are
overwhelmingly **vendor blogs describing their own feature**, plus **affiliate
listicles** (PTPioneer, TrainerAcademy, Guideflow, and a long tail of "best X in
2026" pages).

I fetched one directly to check rather than assume —
[FitSW's session-tracking article](https://www.fitsw.com/blog/personal-training-client-session-tracking/):

- ~800–900 words
- Headings are feature names: "Session Management Page", "Adding Sessions to Client"
- Roughly **60% product promotion, 40% useful**, and the useful part is
  instructions for *their* UI
- Published 2022, unchanged

**That is a beatable page.** Not because TRENIKO is more authoritative — it is
emphatically not — but because a trainer typing *"how do I track how many
sessions a client has left"* does not want a tour of one vendor's settings
screen. The winnable position is: platform-agnostic, works if you use nothing at
all, honest about when software is the wrong answer.

### 1.3 The affiliate-listicle wall

"Best personal trainer software 2026" and every close variant are owned by
affiliate content with years of history. **Do not target these.** A domain with
zero backlinks and no Search Console history will not displace them, and trying
produces exactly the thin comparison pages that get a young site classified as
spam. This is in § 5 (what not to target) for a reason.

---

## 2. The free-template market — the clearest gap found

Searching *personal trainer client tracker spreadsheet template free*:

| What ranks | Type |
|---|---|
| **Etsy** — many listings, dominating the SERP | **Paid**, €3–15 |
| Spreadsheet Daddy, SpreadsheetPoint | Free — but **workout/program templates**, not client-business templates |
| EZbook, thePTDC | Free, closer to the mark; thePTDC's is the strongest incumbent |
| Gumroad sellers | Mixed free/paid, mostly Notion |

**The gap:** the free results are mostly *workout* templates. The *client,
package and payment* trackers are mostly *paid* (Etsy). A genuinely free,
no-email-wall client/session/package tracker sits in a thin part of the market.

TRENIKO already ships one at `/free-personal-trainer-client-tracker` — but
**as CSV only**, and the searcher's query says "Excel" or "Google Sheets". A CSV
loses every formula, so the thing that makes the tracker useful (sessions
counting down by themselves) does not survive the download. **Shipping a real
XLSX with working formulas is the single highest-leverage fix identified by this
research**, and it is done in the same pass as this document.

---

## 3. Recurring problems trainers actually describe

Sourced from third-party pages that quote or paraphrase trainers — Gym Ledger,
FitSW, Tally, Trainerize's own idea forum, and a university PT-department
tracking procedure. **Not** from Reddit threads I read; see the caveat at the top.

| # | Problem | Evidence | TRENIKO page |
|---|---|---|---|
| 1 | **"A client swears they had three sessions left."** The dispute nobody wins | Gym Ledger, quoted in search results | `/guides/session-packages` ✅ |
| 2 | **A package quietly runs out and the sessions keep happening for free** | Gym Ledger | `/guides/session-packages` ✅ |
| 3 | **The renewal conversation is missed.** At ~2 sessions remaining it needs to happen, or the client drifts | Gym Ledger | ⚠️ under-served — belongs in a package guide |
| 4 | **Session data lives in two systems.** Trainers keep a Google Sheet as a *backup verification* against the gym's software | UGA PT-department procedure doc | `/guides/software-vs-spreadsheets` ✅ |
| 5 | **"PT is the highest-margin thing a gym sells and the worst tracked"** | Gym Ledger | The whole positioning |
| 6 | **Late cancellations and no-shows** — does it burn a session? | Trainer forums; unresolved policy question | ❌ **no page yet** |
| 7 | **Pricing and structuring packages** | Recurring across trainer blogs | ❌ **no page yet** |
| 8 | **Onboarding a new client** — what to collect, in what order | Recurring | ❌ **no page yet** |
| 9 | **Session tracking wanted inside package products** | [Trainerize idea forum](https://ideas.trainerize.com/forums/167887-coach-trainer-trainerize/suggestions/31368610-add-session-tracking-when-creating-packages-in-tra) — users asking the market leader for it | Confirms the wedge |

Items 6, 7 and 8 are unserved by TRENIKO and each is a real question with a
non-obvious answer. Those became the pages built in this pass.

---

## 4. Keyword hypotheses

**Volume unknown for every row.** Ranked by *intent × winnability*, which is the
only axis I can honestly assess. "Winnable" means: the current SERP is vendor
documentation or thin affiliate content rather than established editorial.

### Tier A — build now (informational, specific, winnable)

| Query hypothesis | Intent | SERP today | Page |
|---|---|---|---|
| how to track personal training sessions | Problem-aware, pre-purchase | Vendor docs | `/guides/session-packages` ✅ live |
| how many sessions does my client have left | Acute pain, exact-phrase | Vendor docs | covered ✅ |
| personal trainer cancellation policy | Policy, high engagement | Trainer blogs, thin | **`/guides/cancellation-policy` — built this pass** |
| do personal trainers charge for no-shows | Same cluster | Forum answers | **`/guides/no-show-clients` — built this pass** |
| how to price personal training packages | Business decision | Coaching blogs | **`/guides/pricing-personal-training-packages` — built this pass** |
| personal trainer new client onboarding checklist | Workflow | Scattered | **`/guides/new-client-first-week` — built this pass** |
| personal trainer client tracker spreadsheet | **Highest — self-identifies the ICP** | Etsy (paid) | `/free-personal-trainer-client-tracker` ✅ live, **now with XLSX** |

### Tier B — commercial, worth one page, will take time

| Query hypothesis | Note |
|---|---|
| personal trainer client management software | Commercial. **`/personal-trainer-client-management-software` — built this pass** |
| personal trainer software for solo trainers | Same intent, narrower. Handled *inside* the pages above, not as its own page — see § 5 |
| software for independent personal trainers | Ditto |

### Tier C — after Search Console has real query data

Nothing here gets built on a guess. Once GSC is connected (§ 7), the impression
data replaces this whole table.

---

## 5. What NOT to target yet

| Target | Why not |
|---|---|
| "best personal trainer software" / "top 10 …" | Owned by affiliate content with years of history. Unwinnable at zero authority, and the attempt produces thin comparison pages |
| "[competitor] alternative" pages | Legitimate later, but at zero authority they read as thin and invite a comparison TRENIKO currently loses on features |
| Programmatic pages ("PT software for [city]", "for [niche]") | **Explicitly rejected.** See § 8 |
| Croatian-language pages | Not a research question — a founder decision about who the first 20 users are. Still open; unchanged from ORGANIC_GROWTH_PLAN § 4 |
| Anything with "free" in a *commercial* sense ("free personal trainer software") | TRENIKO *is* free right now, but competing for that phrase attracts users who leave the moment pricing exists. Revisit when pricing is decided |

---

## 6. Distribution and backlink opportunities

Every row's "Free?" column reflects what I could actually verify. Three rows say
`COULD NOT VERIFY` because the site 403'd an automated fetch — that is the
honest answer, not "free".

### 6.1 Directories

| # | Site | Free? | Relevance | Method | Class |
|---|---|---|---|---|---|
| 1 | SaaSHub | ✅ verified free (prior pass) | High — ranks for "X alternatives" | Account + form | **B** |
| 2 | AlternativeTo | Free per docs, unverified | High | Account | **B** |
| 3 | Capterra / GetApp | Free listing exists; upsells hard | **Highest commercial intent** | Vendor account | **B** |
| 4 | Software Advice | Same operator as Capterra | High | Same account | **B** |
| 5 | SourceForge | Reported free, DR high — unverified | Medium (not fitness) | Account | **B** |
| 6 | Crunchbase | Free basic tier | Medium — entity signal | Account | **B** |
| 7 | Indie Hackers | Free | Medium — founders, not trainers | Account | **B** |
| 8 | Product Hunt | Free | High reach, **one-shot** | Account | **HOLD** — spending the one-time launch with no users is waste |
| 9 | StartupBlink | `COULD NOT VERIFY` (403) | Low-medium | Unknown | **B** |
| 10 | EU-Startups directory | `COULD NOT VERIFY` (403) — **believed paid**, do not assume otherwise | Low | Unknown | **B, verify cost first** |
| 11 | G2 | Free listing exists | High intent, but review-gated | Account | **B** — needs real reviews to be worth anything, and reviews must be real |

**Rejected outright:** every "260+ / 300+ SaaS directories" list found in
research. They are link farms with no editorial content. Mass submission is the
precise pattern that gets a young domain discounted, and it is the *opposite* of
what §§ 1–3 say will work.

### 6.2 Communities

Classification per the brief: **A** = post directly · **B** = needs the
founder's account · **C** = needs moderator approval · **D** = not appropriate.

| Community | Rule (verified previously) | Class |
|---|---|---|
| r/personaltraining | Rule 1 bans soliciting services | **D for promotion**, B for genuine participation with no link |
| r/SaaS | Product mention allowed when genuinely helpful; blog posts must carry value in the post | **B** |
| Indie Hackers | Build/milestone posts expected | **B** |
| Croatian trainer Facebook groups | **Rules not read** — each differs | **C**, and read the rules first |
| r/webdev, r/vuejs-adjacent front-end subs | Technical write-up (the prerender work) is genuinely novel | **B** |

**Nothing here is class A.** Every legitimate channel needs an account with real
history, which is the founder's identity to hold. That is not a blocker I can
engineer around and I will not create accounts to get around it.

### 6.3 Partnership / contribution opportunities

| Opportunity | Why | Class |
|---|---|---|
| thePTDC (Personal Trainer Development Center) | Publishes trainer business content, accepts contributions | **C** — pitch, not submit |
| Croatian fitness education providers / PT course providers | Their graduates are the exact ICP starting out | **B** — a real email from the founder |
| Small trainer-educator creators (IG/YouTube, <10k) | Reachable, and a free tracker is a genuinely giftable thing | **B** |
| "Free resources for personal trainers" roundup pages | The tracker is a legitimate entry | **C** |

---

## 7. Google Search Console

**Still not connected.** Verified 25 Aug 2026: no verification token in the HTML
head, no `google-site-verification` DNS record path testable from here.

This is the single most consequential gap in the whole programme. Everything in
§ 4 Tier C is guesswork until it exists, and it takes about ten minutes of the
founder's time. Exact steps are in `MANUAL_QUEUE.md` under URGENT.

---

## 8. Programmatic SEO — assessed and rejected

Considered: `/personal-trainer-software/[niche]` and `/[city]` variants.

**Not justified, and not implemented.** Three reasons:

1. **No unique content per page exists.** "PT software for online coaches" vs
   "…for studio trainers" differ by a paragraph. That is a doorway-page pattern
   with better manners, and Google names it explicitly.
2. **Zero domain authority.** Programmatic SEO is a scale play that works when
   a domain already ranks. Ours ranks for nothing measurable.
3. **The crawl budget cost is real.** Nine good URLs get crawled. Two hundred
   near-identical ones get sampled and the good ones get less attention.

Revisit only if Search Console shows a page ranking well enough that a
*genuinely distinct* variant of it has an audience. The `for solo trainers` /
`for independent trainers` intent is served inside existing pages instead.

---

## 9. Opportunities ranked by effort vs expected impact

| # | Opportunity | Effort | Expected impact | Time to result | Owner |
|---|---|---|---|---|---|
| 1 | **Connect Search Console** | 10 min | **Very high** — unblocks all measurement | Immediate | **Founder** |
| 2 | **XLSX tracker with live formulas** | Done this pass | **High** — matches actual query wording; CSV did not | Weeks | Done ✅ |
| 3 | **Five new guide pages on unserved questions** (§ 3 items 3, 6, 7, 8) | Done this pass | High — winnable SERPs | 2–4 months | Done ✅ |
| 4 | Fix soft-404s and cache headers | Done this pass | Medium — crawl quality | Weeks | Done ✅ |
| 5 | Capterra + Software Advice free listings | 40 min | **High** — buyer-intent traffic | 1–2 months | **Founder** |
| 6 | SaaSHub + AlternativeTo listings | 20 min | Medium | 1–3 months | **Founder** |
| 7 | Indie Hackers build post (prerender write-up) | 1 hr writing | Medium — real readers, real link | Days | **Founder** (draft ready) |
| 8 | Croatian trainer FB groups — read rules, then participate | Ongoing | **High for first 20 users** | Weeks | **Founder** |
| 9 | Outreach to 5 small trainer-educators with the tracker | 2 hrs | Medium-high | Weeks | **Founder** (template ready) |
| 10 | thePTDC contribution pitch | 2 hrs | Medium, high if accepted | Months | **Founder** |
| 11 | Product Hunt | 3 hrs | High spike, **one-shot** | — | **HOLD until real users** |
| 12 | Croatian-language content | Large | Unknown | Months | **Decision, not a task** |

**The ordering is not arbitrary.** 1 gates measurement. 2–4 are engineering and
are finished. 5–10 need an identity I do not have and should not fabricate.

---

## 10. What this research changed

1. **XLSX, not CSV.** The query wording says Excel. A CSV cannot carry the
   countdown formulas that make the tracker worth downloading.
2. **Four new guide topics chosen from evidence, not from a topic list.**
   Cancellations, no-shows, pricing and onboarding all appear in § 3 as real
   recurring problems with no TRENIKO page. The other candidates in the brief —
   "personal trainer business organization", "admin checklist" — were dropped:
   they are the same page as existing ones with different words on it.
3. **One commercial page, not three.** "client management software", "for solo
   trainers" and "for independent trainers" are one intent. Three pages would be
   three thin pages.
4. **Programmatic SEO rejected in writing** rather than quietly skipped.
5. **The "300 directories" lists rejected in writing**, with the reason.
