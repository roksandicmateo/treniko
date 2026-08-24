# TRENIKO — organic growth plan

**Written:** 24 Aug 2026 · **Budget: €0** · **Production:** `8bb86a9`

This plan covers zero-cost acquisition only. No ads, no paid directories, no
purchased links, no paid tools. Where something costs money, it is named and
skipped rather than quietly omitted.

Two honesty rules run through the whole document, because they are what make it
worth acting on:

1. **No number appears here that was not measured.** There are no traffic
   estimates, no keyword volumes and no conversion projections, because TRENIKO
   has no keyword tool and no traffic history. Anything unverified is labelled
   *unvalidated*.
2. **Nothing claims to be done that was not done.** Actions requiring an account
   that only the founder can open are in § 14, not in the completed list.

---

## 1. Current state — verified 24 Aug 2026

| | |
|---|---|
| Production commit | `8bb86a9` |
| Public indexable URLs | **8** (was 3) |
| Google Search Console | ❌ **not connected** — no verification record exists |
| Indexed in Google | **Unknown.** Cannot be claimed without Search Console |
| Backlinks | **0 verified.** None have been built |
| Page-view analytics | ✅ live, first-party, cookieless (migration 035) |
| Signup attribution | ✅ live, first-touch (migration 034) |
| Instagram | @treniko_fitness · 10 posts published · 2 followers |
| Facebook | Page *Treniko* · 1 follower · 7 feed posts + 4 Reels scheduled |
| Spend to date | **€0** |

### What the site now serves

| URL | Type | Words of crawlable text |
|---|---|---|
| `/` | SPA | **0 in raw HTML** — see § 3.1 |
| `/personal-trainer-software` | static | ~1,090 |
| `/guides` | static | ~445 |
| `/guides/client-management` | static | ~1,050 |
| `/guides/session-packages` | static | ~915 |
| `/guides/software-vs-spreadsheets` | static | ~955 |
| `/privacy`, `/terms` | SPA | legal |

---

## 2. ICP — who this is actually for

**Independent personal trainers who are also the business.** They take the
bookings, chase the payments, and remember whose package is running out.

| | |
|---|---|
| Size | Roughly 10–40 active clients. Below ~8, a notebook genuinely wins |
| Setting | Own studio, rented gym floor space, outdoors, or hybrid online |
| Geography | Croatia first, EU/English-speaking second |
| Current tools | Phone contacts, a calendar, WhatsApp, and a spreadsheet |
| Trigger to switch | The first time they cannot answer *"how many sessions has she got left, and has she paid?"* without opening two apps |
| **Not** the ICP | Gyms with a front desk, class-booking businesses, online-only coaches selling programmes, anyone needing membership billing |

Being explicit about who this is *not* for matters more than usual here,
because the generic "fitness software" market is crowded with gym-management
systems. TRENIKO is not one, and pretending otherwise attracts traffic that
will never convert.

---

## 3. SEO strategy

### 3.1 The biggest technical constraint, stated plainly

**The homepage ships zero body content.** The SPA serves an empty
`<div id="root">`; all copy is rendered by JavaScript.

Google does execute JavaScript, but on a second pass with a rendering budget a
brand-new domain does not command — and Bing, DuckDuckGo, most AI crawlers and
most link-preview bots do not execute it at all.

**This is why the new content pages are static HTML**, not React routes. They
ship their text in the response body and are served off disk by nginx before
the SPA fallback is reached.

**The homepage itself is still CSR, and that is the single highest-value
remaining technical fix.** It is *not* done, because doing it safely needs care:
the `Reveal` component starts its children at `opacity-0`, so a naive
server-render would emit a page whose text is invisible — which Google may treat
as hidden text. The correct sequence is: make `Reveal` default to visible and
animate from there, then prerender at build time with `react-dom/server` (already
a dependency — no new packages), then hydrate. Estimated half a day, no new
infrastructure. See § 15.

### 3.2 What has been fixed

| Item | Before | After |
|---|---|---|
| `www.treniko.com` | 200, duplicate of apex | **301 → apex** |
| Unknown `.php`/`.env`/`.zip` paths | 200 + SPA shell, `index, follow` | **404** |
| `/guides` | would 301 to `/guides/` | **200 at the canonical URL** |
| Structured data | SoftwareApplication, Organization | **+ WebSite, BreadcrumbList, Article, WebPage, CollectionPage** |
| Sitemap | 3 URLs | **8 URLs** |
| Internal links | none | homepage footer → all 5 content pages, and back |

### 3.3 Already correct, left alone

HTTPS with HTTP→HTTPS 301 · canonical tags · robots.txt allowing public and
disallowing every private route · sitemap containing no private URL · full Open
Graph and Twitter card metadata · `noindex, nofollow` on every authenticated
route · TTFB ~0.24s · 137 KB brotli JS · hashed assets `immutable`, shell
`no-cache` · no image alt-text debt (all inline SVG).

---

## 4. Keyword map

> **Volumes are deliberately absent.** TRENIKO has no keyword tool and buying
> one costs money. Every priority below is reasoned from intent and competition
> shape, and is **unvalidated** until Search Console reports real impressions.
> That is exactly what § 13 is for — Search Console will replace this guesswork
> with observed queries within weeks.

### English — commercial intent

| Keyword | Intent | Target page | Realistic? |
|---|---|---|---|
| personal trainer software | Commercial | `/personal-trainer-software` | Hard — established players. Long game |
| personal trainer client management software | Commercial, long-tail | `/personal-trainer-software` | **Better** — more specific, less contested |
| software for independent personal trainers | Commercial, long-tail | `/personal-trainer-software` | **Best of the commercial set** |
| personal trainer session tracking software | Commercial | `/guides/session-packages` | Plausible |
| personal trainer software vs spreadsheet | Comparison | `/guides/software-vs-spreadsheets` | **High — almost no competition** |

### English — informational (where a new domain can actually win)

| Keyword | Target page |
|---|---|
| how to manage personal training clients | `/guides/client-management` |
| what should a personal trainer track for each client | `/guides/client-management` |
| how to track personal training packages / remaining sessions | `/guides/session-packages` |
| personal trainer no-show policy / cancellation policy | `/guides/session-packages` (covered) |
| do I need software as a personal trainer | `/guides/software-vs-spreadsheets` |

**Informational is the priority.** A new domain with no authority will not
outrank incumbents for *"personal trainer software"* this year. It can rank for
a specific question nobody has written a good answer to — and the person asking
*"how do I track remaining sessions"* is closer to the product than the person
typing a generic category term.

### Croatian — an open decision, not a recommendation

Croatian terms (*aplikacija za osobne trenere*, *program za osobne trenere*,
*vođenje klijenata osobni trener*) almost certainly have **low volume and
near-zero competition** — the classic profile of a cheap win, and the audience
is exactly the ICP.

**But it conflicts with a standing decision.** `marketing/social/STRATEGY.md`
puts *"any language other than English in public copy"* on the *Never* list, and
sessions 4–8 reaffirmed it. That rule was written about the social feed, where
mixing languages reads as two different accounts; a Croatian page on a Croatian
URL is arguably a different thing, and the product already ships EN/HR/DE.

**No Croatian page has been created.** This needs a deliberate call — see § 14.

---

## 5. Content roadmap

**Shipped (5 pages).** See § 1.

**Next 3, in priority order** — each is a question a trainer actually asks, and
each maps to a keyword above with no good existing answer:

1. **"Personal trainer cancellation and no-show policy: what to actually
   write"** — currently a section of `/guides/session-packages`; it deserves its
   own page and is a genuinely searched problem.
2. **"What to charge for personal training packages"** — high intent, and
   answerable honestly without inventing market rates by giving a *method*
   rather than numbers.
3. **"Getting a new personal training client started: a first-week checklist"** —
   pairs with the free resource in § 12.

**Rules that apply to all of them:** useful without registering, no invented
statistics, no fabricated customers, and willing to say when TRENIKO is the
wrong answer. A page that is only worth reading if you sign up is a doorway page
with better manners.

**Do not mass-generate.** Three good pages beat thirty templated ones, and
thirty templated ones are a Google penalty waiting to happen.

---

## 6. Search Console setup — **blocked, needs the founder**

Verified 24 Aug 2026: **no `google-site-verification` TXT record**, no HTML
verification file, no meta tag. Search Console is not connected.

It cannot be connected autonomously — it needs a Google account login, which is
not something to guess at or work around. **Exact steps in § 14.1.**

Until it exists, three things are simply unknown and must not be claimed:
whether Google has indexed anything, what queries the site appears for, and
whether there are crawl errors.

---

## 7. Directory strategy

**Every listing below requires an account the founder must open.** None have
been submitted — see § 14.2 for ready-to-paste copy.

Quality over quantity, deliberately. The "300+ SaaS directories" lists that
circulate are largely link farms; submitting to them is the exact black-hat
pattern to avoid, and Google discounts them anyway.

### Tier 1 — genuinely worth doing

| Platform | URL | Free? | Why | Risk |
|---|---|---|---|---|
| **AlternativeTo** | alternativeto.net | ✅ | Buyers really do search *"alternative to X"*. Long-tail traffic from people already comparison-shopping | Low |
| **SaaSHub** | saashub.com | ✅ | Clean, ranks for *"[product] alternatives"*, dofollow | Low |
| **Indie Hackers** | indiehackers.com | ✅ | Product listing + the build story. Engagement comes from posting a milestone, not the listing itself | Low |
| **Crunchbase** | crunchbase.com | ✅ basic | Entity/brand signal. Free tier is enough | Low |
| **Capterra / GetApp** | capterra.com | ✅ free listing | Where software buyers actually look. Paid tiers exist — **do not buy one** | Low, but decline every upsell |

### Tier 2 — fitness-specific, higher relevance than any generic directory

Worth research time before submitting: personal-trainer resource sites and
fitness-business blogs that maintain tool lists. A single mention on a site
personal trainers read is worth more than ten generic SaaS directories.

### Explicitly skipped

Anything charging a "listing fee" or "expedited review". Anything that is a wall
of outbound links with no editorial content. Any list that accepted every
submission. **These carry risk and no benefit.**

---

## 8. Community strategy

**Rules were read before recommending anything.** Two verified directly:

| Community | Rule found | Verdict |
|---|---|---|
| **r/personaltraining** | Rule 1: *"do not solicit your services here"* — violating posts removed | ❌ **No promotion. Ever.** Genuine peer participation only, no links |
| **r/SaaS** | Rule 2: no direct sales; mention your SaaS only when *"relevant and actually helpful"*. Rule 4: blog posts must carry the value in the Reddit post itself | ✅ **A substantive build/lessons post is allowed** |

Broader finding worth internalising: across founder-frequented subreddits,
**most ban self-promotion outright**, and the reliably safe path is a designated
weekly thread plus real participation.

### The approach that works

1. **Participate for weeks before mentioning the product.** In r/personaltraining
   the account should be useful about training-business problems and never link
   anything. That is not a tactic to be gamed — it is the price of admission,
   and a founder who cannot pay it will get banned and deserve it.
2. **Answer the question the guides answer.** When someone asks how to track
   remaining sessions, the useful reply is the actual answer, in the comment.
   A link is at best a footnote and often a rule violation.
3. **Facebook groups for Croatian trainers** are likely a better fit than Reddit
   for the initial ICP — but each has its own admin and its own rules, and each
   must be read before posting. **Not yet researched.**

### Never

Fake accounts · fake conversations · the same text posted in several places ·
link-dropping · engagement pods · astroturfed "has anyone tried TRENIKO?"

---

## 9. Social strategy

Already running and unchanged by this plan: Instagram + Facebook, organic only,
English, €0. See `marketing/social/SESSION_CHECKPOINT.md`.

### Channel assessment for this ICP

| Channel | Audience fit | Verdict |
|---|---|---|
| **Instagram** | ★★★★★ — where trainers actually are | ✅ Running. Primary channel |
| **Facebook** | ★★★☆☆ — groups matter more than the Page | ✅ Running. Groups are the real opportunity |
| **YouTube** | ★★★★☆ — long-tail search, "how I run my PT business" | ⚠️ High effort. **Not now** |
| **LinkedIn** | ★★☆☆☆ — gym chains and B2B, not independents | ❌ Skip |
| **X** | ★★☆☆☆ — indie-maker audience, not trainers | ⚠️ Only for a build-in-public launch |
| **TikTok** | ★★★☆☆ — big fitness audience, mostly consumers | ❌ Not for B2B software |
| **Threads** | ★★☆☆☆ | ❌ Skip |

**Do not open accounts everywhere.** Two channels maintained properly beat six
abandoned ones, and an abandoned profile is worse than none — it is public
evidence the product may be dead.

---

## 10. Outreach strategy

Zero-cost, and quality over volume. The goal is **the first ten real trainers
and their feedback**, not reach.

- **Personalised, individual messages.** Reference their actual business.
- **Croatian trainers first** — same country, same language, and the founder can
  meet them.
- **Lead with a question, not a pitch.** *"How do you currently track who has
  sessions left?"* starts a conversation; a feature list ends one.
- **Ten a week, by hand.** Not a hundred.

**Never:** purchased lists · scraped personal data · automated DMs · false
identity · pretending to be a customer.

---

## 11. Backlink strategy

Target: **a small number of relevant, earned links.** Not hundreds.

Realistic sources, in order:
1. The Tier 1 directories in § 7.
2. Indie Hackers / r/SaaS build story — a genuinely useful post earns links.
3. The free resource in § 12 — the only thing here that earns links *passively*.
4. Croatian startup and entrepreneurship communities.
5. Fitness-business blogs, if the guides are good enough to cite.

**Never:** bought links · PBNs · link exchanges · comment spam · directory
blasts. These are the ones that get a domain permanently discounted, and the
damage is not reversible on a €0 budget.

---

## 12. Free-resource strategy

**One resource, done well.** Recommended:

> **A personal trainer client + session tracker (spreadsheet template).**

Deliberately counter-intuitive: it is the thing TRENIKO replaces. That is
exactly why it works —

- it matches a real, specific search (*personal trainer client spreadsheet
  template*) that people already look for;
- everyone who downloads it has self-identified as the ICP and as someone
  currently doing this by hand;
- it is honest — the template genuinely helps, and the trainers who outgrow it
  are precisely the ones the product fits;
- it is the kind of thing other people link to.

Cost: €0. Effort: half a day. **Not built yet.**

---

## 13. Measurement strategy

Everything is already instrumented. The infrastructure exists; what is missing
is traffic to measure.

| Step | Measured? | By |
|---|---|---|
| Social reach / profile visits | ✅ | Instagram Insights (manual) |
| **Page views, per page** | ✅ | `page_view` (migration 035) |
| **Views by source / campaign** | ✅ | admin Acquisition panel |
| **Registrations** | ✅ | `tenants.created_at` |
| **Registrations by source** | ✅ | `signup_attribution` (migration 034) |
| **Views → signups, per channel** | ✅ | admin Acquisition panel |
| Google impressions, clicks, queries | ❌ | **needs Search Console** |
| Unique visitors | ❌ | No identifier is stored, deliberately |
| Paid conversion | ❌ n/a | No payment processor exists |

### UTM convention — do not invent a second one

```
https://treniko.com/?utm_source=<network>&utm_medium=<medium>&utm_campaign=organic&utm_content=<placement>
```

| Placement | Exact string |
|---|---|
| Reddit r/SaaS post | `utm_source=reddit&utm_medium=social&utm_campaign=organic&utm_content=saas-build-story` |
| Indie Hackers | `utm_source=indiehackers&utm_medium=social&utm_campaign=organic&utm_content=launch-post` |
| AlternativeTo | `utm_source=alternativeto&utm_medium=referral&utm_campaign=organic&utm_content=listing` |
| SaaSHub | `utm_source=saashub&utm_medium=referral&utm_campaign=organic&utm_content=listing` |
| Capterra | `utm_source=capterra&utm_medium=referral&utm_campaign=organic&utm_content=listing` |
| Crunchbase | `utm_source=crunchbase&utm_medium=referral&utm_campaign=organic&utm_content=listing` |

`utm_medium=social` for communities, `referral` for directories, and
`utm_campaign=organic` always — `paid` is reserved and there is nothing paid.

**The static content pages forward incoming UTM tags** to their app links, so a
visitor arriving from Reddit onto a guide still has their source recorded at
signup. Verified live.

---

## 14. Manual actions — only the founder can do these

### 14.1 Google Search Console — **highest priority**

Domain property is preferable (covers http/https/www/subdomains at once). DNS
is at Cloudflare.

1. `search.google.com/search-console` → **Add property** → **Domain** →
   `treniko.com`.
2. Google shows a TXT record like `google-site-verification=<token>`.
3. Cloudflare → treniko.com → **DNS** → **Add record** → Type `TXT`, Name `@`,
   Content = the whole string. **Do not remove the existing `brevo-code` or
   `v=spf1` TXT records** — they are email delivery and removing them breaks it.
4. Back in Search Console → **Verify**.
5. **Sitemaps** → submit `sitemap.xml`.
6. **URL Inspection** → `https://treniko.com/` → *Request indexing*. Repeat for
   `/personal-trainer-software`. **Do not spam this** — a few URLs, once.

*If you would rather not touch DNS:* choose **URL prefix** property instead,
pick the **HTML file** method, and send me the file — I will deploy it in
minutes (`nginx` already serves such a file correctly).

**Then tell me it is verified** and I will read coverage, queries and errors and
act on them.

### 14.2 Directory submissions

Each needs an account. Ready-to-paste copy:

**Name:** TRENIKO
**Tagline:** Training management software for independent personal trainers
**Category:** Business / Fitness / SaaS
**URL:** use the tagged link from § 13 for each platform

> **Short (≤160 chars):** TRENIKO keeps clients, sessions, packages, payments
> and progress in one workspace, for personal trainers who run the business
> themselves.

> **Long:** TRENIKO is training management software for independent personal
> trainers — the people who coach *and* run the business. It holds one record
> per client with goals, notes and full history; one-to-one and group sessions
> marked completed, cancelled or no-show; session packages that count down
> automatically and warn before a client runs out; payments recorded against the
> sessions they cover; progress measurements over time; and training plans built
> from your own exercise library. It is not a gym system with the gym removed —
> there is no membership billing, no front desk and no class-booking portal.
> Free while TRENIKO is early: there is no payment processor in the product, so
> there is nothing to pay and no card to enter.

**Decline every paid upsell.** Capterra in particular pushes pay-per-click
placement — the free listing is the whole point.

### 14.3 The Croatian-language decision

Croatian SEO pages are probably a cheap win, and they contradict the standing
English-only rule. **Your call.** Say the word and I will build
`/aplikacija-za-osobne-trenere` on the same static-page machinery.

### 14.4 Reddit

The browser is logged in as a personal account. **Nothing has been posted, and
nothing will be without you asking.** r/personaltraining forbids solicitation;
r/SaaS allows a substantive build post. If you want the r/SaaS post drafted, I
will write it — but it should be posted by you, from an account with real
history.

---

## 15. Prioritised roadmap

Scored on impact, effort, cost (all €0) and time-to-result.

### 30 days

| # | Action | Impact | Effort | Owner |
|---|---|---|---|---|
| 1 | **Connect Search Console, submit sitemap** | ★★★★★ | 15 min | **Founder** (§ 14.1) |
| 2 | **Prerender the homepage** (§ 3.1) | ★★★★★ | half a day | Me |
| 3 | Submit Tier 1 directories | ★★★☆☆ | 2 hrs | **Founder** (§ 14.2) |
| 4 | Build the spreadsheet template (§ 12) | ★★★★☆ | half a day | Me + founder |
| 5 | Begin genuine Reddit participation, no links | ★★★☆☆ | 20 min/day | **Founder** |
| 6 | Keep the Instagram/Facebook schedule running | ★★★☆☆ | ongoing | Running |

### 60 days

| # | Action | Impact |
|---|---|---|
| 7 | Read Search Console queries; improve the pages already getting impressions | ★★★★★ |
| 8 | Publish content pieces 6–8 (§ 5), chosen from *observed* queries not guesses | ★★★★☆ |
| 9 | Croatian pages, if § 14.3 is approved | ★★★★☆ |
| 10 | Research Croatian trainer Facebook groups; read every group's rules | ★★★☆☆ |
| 11 | Indie Hackers / r/SaaS build story | ★★★☆☆ |
| 12 | Ten personalised outreach messages a week | ★★★★☆ |

### 90 days

| # | Action | Impact |
|---|---|---|
| 13 | Product Hunt launch — **only once there are real users**, since a launch with nothing to show spends a one-time card for nothing | ★★★★☆ |
| 14 | Ask the first real trainers for a testimonial **in writing**, then add genuine social proof | ★★★★★ |
| 15 | Second free resource, driven by what actually ranked | ★★★☆☆ |
| 16 | Reassess: double down on what produced signups, cut what did not | ★★★★★ |

### The order matters

Items 1 and 2 come first because **everything after them is guesswork until they
are done.** Search Console replaces the unvalidated keyword map in § 4 with
observed queries; prerendering makes the homepage legible to crawlers that do
not run JavaScript. Publishing more content before either is finished means
optimising blind — which the brief rightly forbids.

---

## 16. What success looks like at 90 days

Not traffic. Not rankings. **The first ten real trainers, and knowing which
channel produced them** — which, for the first time, the analytics can now
actually answer.

Everything above is €0. If any step starts asking for a card, it is the wrong
step.
