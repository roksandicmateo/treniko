# TRENIKO — manual queue

**Updated:** 25 Aug 2026 · **Everything here is free.** Nothing asks for a card,
and nothing should be paid for.

Only work that **cannot be done without you** — an account, an inbox, a phone, a
DNS record, or a judgement about your own business. Anything an agent could do
has been done instead of listed here.

**Status vocabulary:** `TODO` means nobody has started. `DONE` means it is live
and was checked. Nothing is marked done for having been queued.

There is a separate queue for Instagram/Facebook publishing taps:
`marketing/social/MANUAL_QUEUE.md`.

---

# URGENT — today

## U1 · Message 10 trainers you already know · ~1 hour

**The single highest-probability route to trainer number one, and the only item
here I cannot do any part of.**

Script: `marketing/FIRST_10_USERS_EXECUTION_2026.md` § 4.6. Personalise the first
line; the rest stands. Log each one in
`marketing/outreach/OUTREACH_TRACKER.csv`.

**Expected result:** three replies is a good week. One trainer who adds a real
client is a very good week.

---

## U2 · Google Search Console · ~10 minutes

Still not connected — verified again today: no verification meta tag, no Google
TXT record (only Zoho SPF and Brevo), no verification file.

1. <https://search.google.com/search-console> → **Add property → Domain** →
   `treniko.com`
2. Copy the `google-site-verification=…` string
3. **Cloudflare** (your nameservers are `perla.ns.cloudflare.com` /
   `rustam.ns.cloudflare.com`) → `treniko.com` → **DNS → Records → Add record**
   → type `TXT`, name `@`, content = that string
   ⚠️ **Add, do not edit.** The SPF and Brevo TXT records must survive —
   overwriting the SPF one breaks outbound email.
4. **Verify** → **Sitemaps** → submit `sitemap.xml`

**Expected result:** verified; 15 URLs discovered. Nothing useful to read for
2–4 weeks — an empty report at day three means nothing.

---

## U3 · Instagram bio, name field, and follow 20 trainers · ~10 minutes

Instagram app → **Edit profile**.

**Name field** (searchable inside Instagram — this is where keywords belong):

```
TRENIKO · Softver za trenere
```

**Bio:**

```
Vođenje klijenata, paketa i termina — na jednom mjestu.
Za osobne trenere koji sami vode svoj posao.
Znaj točno koliko je treninga ostalo na svakom paketu.
↓ Besplatna tablica za praćenje klijenata
```

**Link:**

```
https://treniko.com/free-personal-trainer-client-tracker?utm_source=instagram&utm_medium=social&utm_campaign=organic&utm_content=link-in-bio
```

**Then follow ~20 Croatian trainers who match the profile.** The account
currently follows **0**, which means it has no feed, no interaction surface, and
reads as abandoned. Following is free, organic, and is the first genuine
touchpoint before any DM.

**Expected result:** visits appear under `instagram` in the admin funnel.

---

# THIS WEEK

## W0 · Facebook Page → Page messaging · **new, and it needs no personal profile**

The one channel found that routes around the Groups wall entirely: the TRENIKO
**Page** can message another business **Page** directly. Your personal profile is
not involved at any point.

1. Page → **Settings → Privacy → Messages** → enable Page-to-Page messaging
2. Find Croatian trainers who run a business Page, and small Varaždin/Zagreb
   gyms. If a Page has no *Send message* button, messaging is off — move on
3. Send **five a day, maximum**, personalising the first line every time

Message text: `marketing/NEW_CHANNELS_2026-08.md` § 1.

⚠️ Five a day, personalised. Identical repeated Page messages are treated as
spam by Meta, and that is a Page restriction you cannot appeal quickly.

---

## W0b · Email 10 gyms in Varaždin and Zagreb · ~45 minutes

Published business addresses, personalised, one question at the centre: *do your
trainers book their own clients and handle their own payments?* Even a "no,
reception does it" is a useful answer.

Text: `NEW_CHANNELS_2026-08.md` § 2. Small independent gyms only — not chains.

---

## W0c · Pitch Netokracija · ~15 minutes

`info@netokracija.com`. Editorial coverage is free; advertising is the paid
product. **Pitch the story, never buy the placement.**

The angle is not a launch announcement — it is why the free tools came before
the product. Text: `NEW_CHANNELS_2026-08.md` § 3.

---



## W1 · Email 3 trainer education providers · ~30 minutes

HFS Academy · Fitnes učilište · Flexyfit Academy. Their students are newly
independent trainers with no incumbent tool to switch away from.

Script: `FIRST_10_USERS_EXECUTION_2026.md` § 4.15. It offers the two free
resources and **asks for nothing** — no backlink, no affiliate, no commission.

---

## W2 · Facebook Page — three fixes · ~15 minutes

Audited live today: name **Treniko**, category **Softverska tvrtka**, 1 follower,
0 reviews, description accurate and in English.

I deliberately did **not** edit it. That session is authenticated as your
personal profile, the Page editor sits beside "Kreiraj oglase" and "Boost", and
changing your live business presence is worth your eyes first.

1. **Add a Croatian description.** The market is Croatia-first; the description
   is English-only. Paste:

   > Softver za vođenje treninga za osobne trenere. Klijenti, treninzi, paketi i
   > plaćanja na jednom mjestu — manje administracije, više treninga.

2. **Check the action button** is *Otvori web-stranicu*, pointing at:
   `https://treniko.com/?utm_source=facebook&utm_medium=social&utm_campaign=organic&utm_content=page-cta`

3. **Pin a post** — the free tracker one. A Page with one follower converts
   through its pinned post, not its feed.

⚠️ **Do not** add an address or phone number. TRENIKO has no premises, and
inventing one is the kind of detail that gets a Page restricted.
⚠️ **Decline every "Boost" / "Oglašavaj" prompt.** They are everywhere in that UI.

---

## W3 · Reddit — account, and comments only · ~20 minutes

**Read `marketing/REDDIT_2026.md` first.** The headline finding changes the plan:

> **r/personaltraining (94,865 members) forbids TRENIKO entirely.** Rule 2 bans
> soliciting feedback, market research and recruiting testers for software.
> Rule 4 bans promotion "through posts, comments, **or DMs**."

The most relevant community is closed, including DMs. Do not post there, and do
not message trainers you find there.

**Where you can:** `r/Croatia` (438k, self-promo 2×/month, unlimited in the daily
thread), `r/EntrepreneurRideAlong`, `r/SaaS` (1 mention per 60 days, disclosed),
`r/smallbusiness` (weekly promo thread only).

**This week:** use an existing account if you have one with history. Comment a
few times in r/Croatia on anything you genuinely have something to say about.
**Post nothing yet.** Content is written and ready in `REDDIT_2026.md` § 4.

---

## W4 · Capterra + GetApp + Software Advice · ~1 hour

One vendor account covers all three. The highest buyer intent available free.

Copy: `marketing/DISTRIBUTION_EXECUTION_2026.md` § 5.
Link: `https://treniko.com/?utm_source=capterra&utm_medium=referral&utm_campaign=organic&utm_content=listing`

⚠️ Capterra pushes pay-per-click hard. **The free listing is the entire point —
decline every upsell.** If a card is requested at any step, stop.
⚠️ Do not solicit reviews from anyone who is not a real user.

**Needs W5 first.**

---

## W5 · Product screenshots · ~30 minutes

The one directory asset I cannot produce. 3–5 images at ~1280×800 from an account
you own: client list, one client record, the calendar, a package showing its
countdown, the payments view.

⚠️ Do not use invented client names that could belong to a real person, and do
not screenshot a real trainer's account.

---

# LATER

| | What | Why it waits |
|---|---|---|
| **L1** | **SaaSHub** submission — verified free, account required | Lower intent than W4 |
| **L2** | **AlternativeTo** listing | Believed free; login-gated, so unverified |
| **L3** | **Cloudflare AI crawlers** — allow `ChatGPT-User`, `Claude-User`, `OAI-SearchBot`; keep `GPTBot`/`ClaudeBot` blocked if you want training excluded. Security → Bots. Reasoning: `DECISIONS_2026-08.md` § 1 | robots.txt now makes the flip safe, so this is no longer urgent |
| **L4** | **Reddit posts** from `REDDIT_2026.md` § 4 | Only after W3 gives the account history |
| **L5** | **Crunchbase** free tier | Entity signal only. Minimal traffic |
| **L6** | **thePTDC** contribution pitch | Months to land, high value if it does |

---

# BLOCKED — requires payment

Recorded rather than worked around. **No payment flow was entered anywhere.**

| Item | Status |
|---|---|
| EU-Startups directory listing | **Blocked — believed paid.** Verify the cost; skip if it charges |
| Any "featured" or "promoted" directory placement | **Blocked — requires payment** |
| Instagram / Facebook post boosting | **Blocked — requires payment.** Not doing it |
| Reddit promoted posts (r/Fitness30plus's own rules point you at these) | **Blocked — requires payment** |
| Paid SEO tools for keyword volume | **Blocked — requires payment.** Search Console is the free substitute |

---

# BLOCKED — personal account or profile required

You said explicitly: the **Treniko Page** may act, your **personal profile** may
not. These respect that rather than working around it.

| Item | Status |
|---|---|
| **Croatian trainer Facebook groups** | **BLOCKED — PERSONAL PROFILE REQUIRED.** Facebook does not let a Page join or post in most Groups; joining is a personal-profile action. If you choose to join personally that is your decision — I will not do it or automate it |
| **Facebook Page commenting inside Groups** | **BLOCKED — PERSONAL PROFILE REQUIRED** in most Groups. A few allow commenting as a Page; check per group |
| **Instagram DMs to trainers** | Requires your account. Scripts ready; **no DM sent** |
| **Reddit posting** | Requires an account with history. Content ready; **no account created, nothing posted** |
| **LinkedIn** | Your name is on it. Your call whether it is worth using at all |

---

# HOLD — deliberately not yet

## Product Hunt

**Do not launch.** A launch is one-shot and the conditions are not met.

| Condition | Now |
|---|---|
| Real users who would comment | **0 acquired trainers** |
| Anything honest to say about traction | Nothing |
| An audience to notify on launch day | 2 Instagram followers, 1 Page follower |
| Product screenshots | Not yet — W5 |

**Launch when:** roughly 10 active trainers, several of whom would genuinely
comment; screenshots exist; and there is one true sentence about traction that is
not "we just launched". Until then it converts the largest free attention event
available into nothing.

## Referral loop

**Do not build.** No client-facing surface exists — no client login, no portal,
no share token — so every worthwhile mechanism would mean building one first.
Revisit at ~5 active trainers, and ask them rather than guessing.

---

# DONE

Only what is live and was checked.

| | What | Verified by |
|---|---|---|
| ✅ | Security headers + enforcing CSP on every static response | `npm run check:headers` |
| ✅ | Activation counts — they read 0 forever because of RLS | Migration 036; a probe went 0→1 in production and back |
| ✅ | Funnel by source: Visit → Registration → Verified → First client → First package → First booking | 10 tests against the shipped SQL |
| ✅ | Sample-size protection — no rate under 30, plus a plain-language warning | Live on the dashboard |
| ✅ | Free pricing calculator | Arithmetic checked by hand |
| ✅ | Download tracking on the free tracker | Verified end to end in production |
| ✅ | Referrer breakdown — organic search no longer counted as direct | Query verified in production |
| ✅ | robots.txt AI policy, and a check on the **served** file | Found Cloudflare rewriting it at the edge |
| ✅ | Free/no-card line on the registration form, three languages | Live |
| ✅ | pm2 log rotation | `logrotate -d` |

---

# What was NOT put here

Because none of it needed you:

- Twelve content pages, the tracker, the calculator, sitemap, robots, internal linking
- All analytics, attribution and funnel work
- `check-seo.mjs` and `check-headers.mjs`, both gating the build
- Research: `REDDIT_2026.md`, `CROATIA_CHANNELS_2026.md`,
  `DISTRIBUTION_EXECUTION_2026.md`, `FIRST_10_USERS_EXECUTION_2026.md`,
  `DECISIONS_2026-08.md`
- `SEARCH_CONSOLE_GROWTH_2026.md` — deliberately empty until U2 is done
