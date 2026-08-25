# TRENIKO — the first 10 real trainers

**Written:** 25 Aug 2026 · **€0** · Executable by one person.

## The starting position, measured today

Pulled from production, not estimated:

| | |
|---|---|
| Tenant rows | 9 |
| **Real accounts** (tenant with a user) | **4** |
| Email verified | 3 |
| **Accounts that have added a client** | **3** |
| Accounts that have created a package | 1 |
| Accounts that have booked a session | 1 |
| Page views, all time | 43 — essentially all QA traffic from these sessions |
| Visits from a search engine | **0** |
| Signups with attribution | **0** — all four accounts predate the attribution table |

**Corrected 25 Aug 2026.** This section previously read "nobody has ever used
TRENIKO — none of them added a single client". That was wrong, and the reason
matters more than the number: the activation counts were reading through
row-level security with no tenant context, so `clients`, `packages` and the
session tables were invisible to the query and returned 0 for every account
regardless of reality. Migration 036 fixed it.

The true picture: **three of the four accounts added a client, and one went all
the way through to a booked session.** All four are development accounts from
May, so this is not evidence of product-market fit — but it is evidence that the
core flow works end to end, which the broken metric had been denying.

The number that is genuinely still zero is **trainers acquired**: no account
came from a measured source, and none is a real personal trainer running a
business.

Every plan below is written for a product with **zero acquired trainers and zero
organic traffic**, because that is what exists. The activation panel on the
admin dashboard now makes both numbers visible permanently — and, since
migration 036, correctly.

---

## Where the rest of this lives

This file holds the ICP, the objections, the activation definition and the
feedback questions — the *thinking*. Three companions hold the *doing*:

- `FIRST_10_USERS_EXECUTION_2026.md` — outreach scripts, the pipeline, the
  Instagram bio, the 7- and 30-day plans, stop conditions
- **`ACQUISITION_BACKLOG_2026.md` — the ranked top 10, and what not to do.**
  Start there if you only read one
- `CROATIA_ACQUISITION_2026.md`, `REDDIT_DISTRIBUTION_2026.md`,
  `INSTAGRAM_ORGANIC_2026.md`, `FACEBOOK_ORGANIC_2026.md` — per-channel research

---

## Who the first ten are

**Not "personal trainers".** That is a market, not a person you can find on a
Tuesday.

The trainer most likely to adopt TRENIKO:

| | |
|---|---|
| **Books their own clients** | If a gym receptionist does it, the pain is not theirs |
| **Takes their own money** | Sells blocks of sessions directly — the package problem only exists if you sell packages |
| **Roughly 8–30 active clients** | Below 8 a notebook genuinely wins and they will correctly not care. Above 30 they have usually already bought something |
| **Currently uses a phone, a calendar, WhatsApp and a spreadsheet** | Four places, and they already know it |
| **Has been doing it 1–5 years** | Long enough for the admin to hurt, not so long that they have built a system they are attached to |
| **Croatia first** | Not for language reasons — because you can reach them personally, and the first ten have to come from somewhere you can actually stand |

**Who to deliberately skip:** online-only coaches (they need programme delivery,
which TRENIKO does not do), gym employees (not their problem), studio owners
(they need rooms and staff), and anyone with fewer than five clients.

---

## The problem to lead with

One sentence, and it is not "manage your clients":

> **"How many sessions has she got left, and has she paid for them?"**

Every trainer selling packages has been asked this and had to check two places
to answer. It is specific, it is universal among the target, and it is
answerable in a demo in four seconds.

**Do not lead with:** "all-in-one platform", "streamline your business",
"save time". Those describe every product in the category and commit to nothing.

### Likely objections, and the honest answer to each

| Objection | Answer |
|---|---|
| *"I already use a spreadsheet."* | "Keep it. Genuinely — for a lot of trainers it never stops being enough. It starts costing you when the calendar and the sheet disagree about what happened." Then send `/guides/software-vs-spreadsheets`, which says exactly that |
| *"I don't have time to set it up."* | "There is no setup. Add one real client and book one real session — that is the whole trial, and it takes about two minutes" |
| *"How much is it?"* | "Free. There is no payment processor in the product, so there is nothing to pay and no card to enter. That will change eventually and I will tell you before it does" |
| *"What happens to my clients' data?"* | Point at `/privacy`. Export and account deletion both work today — that is a real answer, and most competitors cannot give it as directly |
| *"Is it finished?"* | "No. That is why I am asking you and not selling to you." This is an advantage at this stage; do not hide it |
| *"Does it do [programming / nutrition / online coaching]?"* | "No, and it is not going to. It is for the business side." Losing someone here is a success — they were never going to stay |

---

## The activation event

**A real user is an account that has added a client and booked a session.**

Not a signup. Not a verified email. Both of those have happened four times and
three times respectively, in development accounts, and neither is a trainer.

Measured on the admin dashboard: `Added a client` → `Booked a session` →
`Created a package`. Ten accounts with zero clients is not ten users; it is ten
people who were curious once.

**Target:** 10 accounts, of which **at least 5 have added a client and booked a
session**, and at least 2 are still doing it four weeks later.

---

## What to ask the first users

Ask about their **week**, not about the product. The five questions worth
having, in rough order of value:

1. *"Walk me through the last time a client asked how many sessions they had
   left. What did you actually do?"*
2. *"What did you have to keep doing outside TRENIKO?"* — this one finds the
   missing feature faster than any roadmap
3. *"Where did you get stuck, or have to guess what a button did?"*
4. *"What would make you stop using it?"*
5. *"Would you have found this on your own? Where would you have looked?"* —
   the only distribution research that is worth anything at this stage

**Do not ask** "do you like it" or "would you recommend it". Both get a polite
yes and teach nothing.

---

## The plan

### I can do — needs your identity, and only you can

Ranked by probability of producing user number one.

| # | Action | Effort | When |
|---|---|---|---|
| **1** | **Message every trainer you already know.** Not a pitch — *"I built the thing I kept complaining about. Would you look at it and tell me where it's wrong?"* Three replies is a good week | 1 hour | **This week** |
| **2** | **Connect Search Console.** One DNS record in Cloudflare. Produces no user today; starts the clock on the channel that eventually does | 10 min | **This week** |
| **3** | **Set the Instagram bio link** to the free tracker. 54 written social pieces currently point at nothing | 1 tap | **This week** |
| **4** | **Join 3 Croatian trainer Facebook groups.** Read the pinned rules. Post nothing for two weeks | 20 min + weeks | **This week** |
| **5** | **Ask two gym owners** you know whether their floor trainers handle their own bookings. If yes, ask for an introduction. Do not ask them to promote anything | 30 min | Week 2 |
| **6** | **Capterra + GetApp + Software Advice** free vendor listing. One account, three sites. Decline every PPC upsell | 1 hour | Week 2–3 |
| **7** | **SaaSHub** — verified free, needs an account. Its Submit tool then posts to other directories from one place | 20 min | Week 3 |
| **8** | **Post the prerender write-up** to Indie Hackers or r/SaaS. Draft is finished in `DISTRIBUTION_2026.md` § 5. Wrong audience for users, right audience for a first real backlink | 30 min | Week 3–4 |
| **9** | **Send the tracker + calculator to five small trainer-educators.** A gift, with no ask attached. Do not ask for a post in the first message | 2 hours | Week 4 |

### Claude can prepare — done, or ready

| Item | State |
|---|---|
| Free client & session tracker (XLSX + CSV, working formulas) | ✅ Live |
| **Free pricing calculator** | ✅ **Live today** — `/personal-trainer-pricing-calculator` |
| Twelve content pages covering the trainer-admin cluster | ✅ Live |
| Paste-ready directory copy — name, short, long, category, pricing, tagged URLs | ✅ `DISTRIBUTION_2026.md` § 4 |
| Two finished community posts | ✅ `DISTRIBUTION_2026.md` § 5 |
| Six social pieces for the tracker | ✅ `social/RESOURCE_DISTRIBUTION.md` |
| Story-slot → page mapping for the scheduled calendar | ✅ Same file |
| Objection handling, ICP, activation definition | ✅ This document |
| First-conversation message | ✅ Below |
| Search Console procedure, Cloudflare-specific | ✅ `SEARCH_CONSOLE_GROWTH_2026.md` |

### Claude can execute — done this session

| Item | State |
|---|---|
| Activation funnel on the admin dashboard — the number that says whether a real user exists | ✅ Deployed |
| Signup count corrected: accounts, not tenant rows (was overstating by 125%) | ✅ Deployed |
| Download tracking on the tracker | ✅ Deployed, verified end to end |
| Untagged traffic split by referrer, so organic search stops being counted as direct | ✅ Deployed |
| Free/no-card reassurance on the registration form | ✅ Deployed |
| Pricing calculator, wired into sitemap, nav, footer and two guides | ✅ Deployed |

---

## The first message, ready to send

For someone you already know. Adjust the first line so it is true.

> Hey — you know how you've mentioned the admin side being a pain? I ended up
> building something for it.
>
> It's for the part nobody talks about: which client has how many sessions left
> on their block, whether they've paid, and who's about to run out.
>
> It's free and there's nothing to pay for — no card, no payment thing in it at
> all. I'm not trying to sell you anything; I want to know where it falls over
> with someone who actually trains people.
>
> If you're up for it: add one real client and book one session. Two minutes.
> Then tell me what annoyed you.
>
> treniko.com

**Why it is shaped like that:** it names a specific problem rather than a
category, it removes the money question before it is asked, it asks for two
minutes rather than a trial, and it asks for criticism — which people give far
more readily than praise, and which is worth more.

**Do not** send this to a list. Ten of these, sent one at a time to people whose
names you know, will outperform any broadcast this account is capable of.

---

## What will not work, and why it is listed

- **Waiting for SEO.** Twelve pages are live and correct; that is a
  two-to-four-month asset. It will not produce user number one and it was never
  going to.
- **Posting the product in r/personaltraining.** Rule 1 bans soliciting. It will
  be removed and it should be.
- **Instagram, at two followers.** The content is written and scheduled and it
  is worth continuing, but it is not an acquisition channel yet.
- **Product Hunt now.** One-shot, and spending it with nothing to point at and
  nobody to comment converts the largest free attention event available into
  nothing.
- **Cold-emailing trainers from a scraped list.** Spam, banned by the
  constraints, and it would poison the one channel that works.

---

## How to tell whether it is working

Weekly, on the admin dashboard, in this order:

1. **Accounts that added a client.** If this is not moving, nothing else
   matters — and no traffic number below it is worth optimising.
2. Accounts, and where they came from
3. Tracker and calculator page views, and downloads
4. Search Console impressions — from about month two

**Success at 30 days** is not ten users. It is **two trainers who added a real
client**, and a list of the things they told you were wrong.
