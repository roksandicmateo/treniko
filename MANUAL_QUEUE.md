# TRENIKO — manual queue (growth & SEO)

**Updated:** 25 Aug 2026 · **Everything here is free.** Nothing in this file
asks for a card, and nothing should be paid for.

This file holds only work that **cannot be done without you** — an account, an
inbox, a phone, a DNS record, or a judgement about your own business. Anything
an agent could do has been done rather than listed here.

There is a second, separate queue for Instagram and Facebook taps:
`marketing/social/MANUAL_QUEUE.md`. It has not been merged into this one because
its items are a different kind of work — that file is a list of taps on a phone,
this one is accounts and submissions.

**Status vocabulary:** `TODO` means nobody has started. `DONE` means it is live
and was checked. Nothing is marked done on the strength of having been queued.

---

## URGENT

### U1 — Google Search Console · ~10 minutes · **do this first**

**Status:** `TODO` · Verified absent 25 Aug 2026: no `google-site-verification`
meta tag, no verification TXT record (only the Zoho SPF record exists).

**Why nothing substitutes for it.** Nobody can currently say whether Google has
indexed a single one of the fourteen public URLs, or what anyone searches to
reach them. The first-party analytics counts visits *after* they arrive; it
cannot see an impression that never became a click, and at this stage that is
most of the information. Until this exists, every content decision is a guess.

**No claim is made anywhere in this repository about TRENIKO's index status or
ranking.** There is no way to know, and stating one would be invention.

#### The five steps. There are no others.

1. <https://search.google.com/search-console> → sign in with the Google account
   that should own this long-term. Moving the property later is annoying, so
   pick deliberately.

2. **Add property → Domain** (the left box, not "URL prefix"). One record covers
   `http`, `https`, `www` and every subdomain — which matters, because
   `www.treniko.com` and `http://` both 301 to the apex.

3. Add the TXT record Google shows you. **Your DNS is Cloudflare** —
   nameservers are `perla.ns.cloudflare.com` and `rustam.ns.cloudflare.com` —
   so: Cloudflare dashboard → `treniko.com` → **DNS → Records → Add record** →
   type `TXT`, name `@`, content exactly the `google-site-verification=…`
   string.

   ⚠️ **Add, do not replace.** The existing `v=spf1 include:zoho.eu ~all` record
   must stay. A domain holds several TXT records; overwriting the SPF one breaks
   outbound email.

   Then press **Verify** — usually minutes, occasionally an hour.

4. **Sitemaps** → submit `sitemap.xml`. It should report **14** URLs.

5. **URL Inspection** → *Request indexing* for exactly three:
   `/`, `/free-personal-trainer-client-tracker`, `/personal-trainer-software`.
   The sitemap handles the rest and pressing the button more does not help.

#### What to check afterwards, and when

**Do not look for anything in the first week.** A new property is empty and an
empty report at day three means nothing.

| When | Where | What a healthy answer looks like |
|---|---|---|
| ~3 days | Sitemaps | 14 discovered, status Success |
| ~1 week | Pages | Some URLs in *Indexed*; the rest *Discovered* or *Crawled — currently not indexed*, which is normal for a new domain and not an error |
| ~1 month | Performance | First impressions. Clicks probably still zero — impressions are the signal at this stage |
| ~2–3 months | Performance → Queries | **This is the one that changes what gets written.** Real queries replace every hypothesis in `marketing/RESEARCH_2026.md` § 4 |

**Then tell me**, and the next session reads the queries and rewrites the content
roadmap against data instead of guesses.

---

### U2 — Set the Instagram bio link · **one tap**

**Status:** `TODO`

Fifty-four social pieces are written across cycles 1 and 2, fourteen are live in
Instagram's scheduler, and not one of them points at anything on the website —
they were all written before the site had anything to link to. The bio link is
the only persistent path from a profile visit to treniko.com, and it is one tap.

Set it to:

```
https://treniko.com/free-personal-trainer-client-tracker?utm_source=instagram&utm_medium=social&utm_campaign=organic&utm_content=link-in-bio
```

Then leave it there. A bio link that rotates per post builds no recognition, and
this is the page that asks the visitor for nothing — no account, no email, no
card — while still explaining honestly where a spreadsheet stops working.

It is now measurable, which it was not last week: the download click writes its
own row, so tracker views versus downloads is a real number rather than a guess.

Do the same on the Facebook Page button with `utm_source=facebook`. The existing
Page CTA already carries `utm_content=page-cta` — leave that one alone.

The six empty "Story · Link" slots in cycle 2 have destinations chosen in
`marketing/DISTRIBUTION_2026.md` § 6. No dates or copy change.

---

### U3 — Message the trainers you already know · **this week**

**Status:** `TODO` · The single highest-probability route to user number one, and
the only one I cannot do any part of.

Everything built over the last two sessions — twelve pages, the tracker, the
schema, the headers, the analytics — is a compounding asset that pays out over
months. It is not what produces the first user. The first user is a conversation.

Not a pitch. Something closer to:

> I built the thing I kept complaining about — tracking who has how many sessions
> left. Would you look at it and tell me where it is wrong?

Three replies is a successful week. Ask them to break it; that is a real request
and it gets answered more often than a launch announcement.

---

## HIGH VALUE

Ordered by expected return per minute. Every one is free; several will try hard
to sell you something during signup. **Decline every upsell** — the free listing
is the entire point, and paid placement is out of scope by instruction.

### H1 — Bing Webmaster Tools · ~5 minutes

**Status:** `TODO`

Do it in the same sitting as U1, because it will import the whole property from
Search Console in one click and takes almost no extra time.

1. <https://www.bing.com/webmasters> → sign in
2. **Import from Google Search Console** (only offered once U1 is done)
3. Confirm `sitemap.xml` came across

Bing's own share is small; it matters because it also feeds DuckDuckGo and
several AI answer engines that do not run their own crawl.

### H2 — Capterra + Software Advice + GetApp · ~40 minutes

**Status:** `TODO` · Free vendor listing · One account covers all three (same
operator).

The highest commercial-intent placement available for free. Trainers comparing
software land here with a decision already half-made.

- Start at <https://www.capterra.com/vendors/>
- Category: *Fitness / Personal Trainer Software*
- Listing copy is written and ready to paste: `SEO_DIRECTORY_TRACKER.md` § 3
- Link: `https://treniko.com/?utm_source=capterra&utm_medium=referral&utm_campaign=organic&utm_content=listing`

⚠️ Capterra pushes pay-per-click hard during and after signup. **Decline all of
it.** The free listing is complete without it.

⚠️ Do not solicit reviews from people who are not real users, and do not write
one yourself. A fabricated review is both a policy violation and the exact thing
this whole programme has avoided.

### H3 — SaaSHub · ~15 minutes

**Status:** `TODO` · **Verified free** (the submission page states it is a free
marketing tool; no paid tier shown).

<https://www.saashub.com/submit> · Ranks well for "[product] alternatives"
queries, which is how a lot of software gets found.

Copy: `SEO_DIRECTORY_TRACKER.md` § 3.
Link: `https://treniko.com/?utm_source=saashub&utm_medium=referral&utm_campaign=organic&utm_content=listing`

After submitting, claim/verify the product — that unlocks the management page.

### H4 — AlternativeTo · ~15 minutes

**Status:** `TODO` · Free per their documentation; the submission path is behind
a login so I could not verify it directly.

<https://alternativeto.net> · List TRENIKO as an alternative to the established
personal-trainer platforms. The value here is referral traffic more than link
equity — their outbound links are believed `nofollow`.

Be accurate about what TRENIKO does **not** do (no membership billing, no class
booking, no payment processing). An overstated listing gets corrected by users
and reads worse than a modest one.

### H5 — Post the free tracker where it is genuinely welcome · ongoing

**Status:** `TODO` · **Read the rules of each place first. Every time.**

The tracker at `/free-personal-trainer-client-tracker` is the strongest thing to
share, because it is free, useful, has no email wall, and needs no account. It
also honestly says at the end when a spreadsheet stops being enough.

| Where | Rule as verified | What is allowed |
|---|---|---|
| **r/personaltraining** | Rule 1 bans soliciting services | **Never post a link.** Participate, answer questions properly, no URL. This is not a tactic to work around — it is the rule |
| **r/SaaS** | Product mentions allowed when genuinely helpful; a blog link must carry its value in the post itself | A build post is fine. Put the substance in the Reddit post |
| **Croatian trainer Facebook groups** | **Rules not read yet** | Read each group's pinned rules before posting anything. Most ban promotion outright |
| **Indie Hackers** | Build posts are expected there | See H6 |

⚠️ From the earlier session's note, still true: the browser is signed into a
personal Reddit account, and it was used to **read rules only**. A first-ever
post that is a product link gets removed and deserves to. Post from an account
with real history, or build history first.

### H6 — Indie Hackers build post · ~1 hour

**Status:** `TODO` · Free · The listing does nothing on its own; the post is
what gets read.

Two write-ups from this codebase are genuinely novel and would stand up without
TRENIKO being the point:

1. **"Prerendering one page of a Vite SPA without adding a framework."** No
   Next.js, no SSR server, no new hosting — `react-dom/server` at build time
   into a static file, plus the two-file split (`index.html` for `/`,
   `app.html` for everything else) that stops React hydrating a login form onto
   a landing page. See `frontend/src/entry-prerender.jsx`.
2. **"Counting page views first-party, with no cookie and no identifier."**
   Migration 035 and `src/utils/pageView.js`. Includes the part most posts skip:
   what you permanently give up (unique visitors) and why that was the right
   trade.

Both are true, both are reusable by the reader, and TRENIKO is incidental
context rather than the subject. That is what makes them acceptable there.

### H7 — Croatian trainer & fitness communities · ongoing

**Status:** `TODO` · **Needs your judgement, not mine.**

This is likely the fastest route to the first ten real users, and it is the one
thing here I cannot research properly from outside: the groups are private, and
the rules are only visible to members.

For each group: join, read the pinned rules, participate for a while, and only
then consider whether a link is welcome. If the rules say no promotion, the
answer is no promotion — permanently, not until nobody is looking.

---

## OPTIONAL

### O1 — Crunchbase · ~20 minutes
**Status:** `TODO` · Free basic tier is sufficient. Decline the paid prompts.
Entity/brand signal more than traffic. Low urgency.

### O2 — Product Hunt · **HOLD, deliberately**
**Status:** `HOLD` — *not* `TODO`.

A launch is one-shot. Spending it now, with no users to point at and no reviews,
converts the single largest free attention event available into nothing. Revisit
when there are real trainers using it who would plausibly comment.

### O3 — thePTDC contribution pitch · ~2 hours
**Status:** `TODO` · <https://www.theptdc.com> publishes trainer business
content and accepts contributions.

Pitch one article, not a list. The strongest candidate is the cancellation-policy
material — it is a real disagreement among trainers, the page at
`/guides/cancellation-policy` shows the argument can be made without selling
anything, and it would be written for their audience rather than repurposed.

### O4 — Small trainer-educator outreach · ~2 hours
**Status:** `TODO`

Five creators, under ~10k followers, who teach the *business* side of personal
training. Send the tracker as a gift with no ask attached. It is free, it has no
email wall, and it is genuinely useful — which is the only version of this that
works. Do not ask for a post in the first message.

### O5 — Croatian startup directories
**Status:** `NOT VERIFIED` · StartupBlink and the EU-Startups directory both
returned HTTP 403 to an automated fetch, so their terms could not be checked.
**EU-Startups is believed to charge for directory listings** — verify the cost
before submitting anything, and if it is paid, skip it.

---

### O6 — Cloudflare is blocking more than GPTBot · ~5 minutes

**Status:** `TODO` — **a decision, and the framing in the last report was too
narrow.**

Measured today by sending each crawler's user agent at a live page, and
confirmed against the origin directly: **every Google and Bing crawler passes
(200), and the block is Cloudflare's edge, not ours** — the origin serves all of
these 200, and `robots.txt` says nothing about any of them.

| Crawler | Edge | Governs |
|---|---|---|
| Googlebot · Google-Extended · GoogleOther · bingbot | **200** ✅ | Search. **Unaffected** |
| GPTBot · ClaudeBot | 403 | ChatGPT / Claude **training** |
| PerplexityBot | 403 | Perplexity answers |
| **OAI-SearchBot** | **403** | **ChatGPT Search results** |
| **ChatGPT-User · Claude-User** | **403** | **A person asking the assistant to open a link** |

The last three rows are the ones that matter and were previously lumped in with
GPTBot. `ChatGPT-User` fires when a real prospective trainer pastes treniko.com
into ChatGPT and asks whether it is any good — and gets *"I can't access that
site."* There is no upside to that. `OAI-SearchBot` decides whether TRENIKO can
be cited when someone asks an assistant what software a trainer should use,
which is the exact question the twelve content pages answer.

**Recommendation: allow `ChatGPT-User`, `Claude-User`, `OAI-SearchBot` and
`PerplexityBot`. Keep or drop `GPTBot` and `ClaudeBot` as you prefer** — those
are pure training, nothing about discovery depends on them, and wanting your
guides kept out of a model is a coherent position that costs you nothing in
Google.

Cloudflare → `treniko.com` → **Security → Bots** → turn off the blanket
AI-crawler block, then block `GPTBot` and `ClaudeBot` specifically if you want
to. Full reasoning in `marketing/DECISIONS_2026-08.md` § 1.

Re-test afterwards rather than assuming:

```bash
for ua in GPTBot OAI-SearchBot ChatGPT-User PerplexityBot Googlebot; do
  printf "%-16s " "$ua"
  curl -s -o /dev/null -w "%{http_code}
"     -A "Mozilla/5.0 (compatible; $ua/1.0)" https://treniko.com/
done
```

---

### O7 — Product screenshots for directory listings · ~30 minutes

**Status:** `TODO` · The one asset the directory submissions need that I cannot
produce.

Capterra, GetApp, Software Advice, SaaSHub and AlternativeTo all ask for 3–5
screenshots at roughly 1280×800. `og-image.png` exists but it is a share card,
not a product screenshot.

Take them from an account you own, with data you are happy to publish: the
client list, one client record, the calendar, a package showing its countdown,
and the payments view.

⚠️ **Do not use invented client names that could belong to a real person**, and
do not screenshot anything from a real trainer's account.

Everything else those forms ask for is written and paste-ready in
`marketing/DISTRIBUTION_EXECUTION_2026.md` § 5.

---

## Done

Only things that are live and were checked.

| | What | Verified |
|---|---|---|
| ✅ | **Security headers on every static response** — HSTS, nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy, and an enforcing CSP with `script-src 'self'` | `npm run check:headers` passes against production. CSP confirmed enforcing, not merely present: a cross-origin fetch is blocked while the same-origin API call completes |
| ✅ | **`/privacy` and `/terms` no longer noindex** for non-rendering crawlers | Raw HTML now carries `index, follow`, a self-referential canonical and a real title |
| ✅ | **Homepage `Cache-Control`** — it had none, and index.html names the hashed bundles | `no-cache, must-revalidate` on every HTML response |
| ✅ | **Download tracking** on the free tracker | Verified end to end on production; the QA rows were deleted afterwards |
| ✅ | **Referrer breakdown** in the admin panel — organic search was being counted as `(direct)` | Query verified against the production database |
| ✅ | **pm2 log rotation** | `logrotate -d` recognises both files |

**The nginx work that was in U2 is finished.** The config is now in
`deploy/nginx/` so it is reviewable in a diff, with the two things that bite
written down. Backups are in `/root/nginx-backups/`.

**The password-reset error reported last session was not a live bug.** It was
fixed on 16 Aug by migration 032 and is covered by a regression test that
rebuilds the broken historical table. It looked current only because nothing
rotated the pm2 logs — which is now fixed.

---

## What was NOT put in this file

Listed explicitly so the queue can be trusted to be minimal — none of these
needed you, so they were done instead:

- The five new content pages, the sitemap, robots.txt and internal linking
- The `.xlsx` tracker, which is why the CSV-only download no longer breaks on a
  Croatian Excel locale
- `scripts/check-seo.mjs`, now gating the build
- The soft-404 `noindex` fix
- The per-page view breakdown in the admin acquisition dashboard
- The research in `marketing/RESEARCH_2026.md`
- The full technical audit in `marketing/SEO_AUDIT_2026-08.md`
- Topic selection and architecture in `marketing/CONTENT_HUB_2026.md`
- Directory, community, backlink, social and first-users tables in
  `marketing/DISTRIBUTION_2026.md` — including paste-ready listing copy and two
  finished community posts
- The execution list with verified free/paid columns in
  `marketing/DISTRIBUTION_EXECUTION_2026.md`
- The first-ten-users plan in `marketing/FIRST_10_USERS_2026.md`
- Crawler, competitor and do-not-build decisions in
  `marketing/DECISIONS_2026-08.md`
- `marketing/SEARCH_CONSOLE_GROWTH_2026.md` — deliberately empty until U1 is
  done, because inventing findings from no data is worse than having none
