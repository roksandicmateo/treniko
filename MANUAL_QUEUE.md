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

### U1 — Google Search Console · ~10 minutes · **do this before anything else**

**Status:** `TODO` · Verified absent 25 Aug 2026: no `google-site-verification`
meta tag in the homepage head, and no verification TXT record on the domain
(only the Zoho SPF record exists).

**Why it is first, and why nothing else substitutes for it.** Right now nobody
can answer whether Google has indexed a single one of the fourteen public URLs.
The first-party analytics counts visits *after* they arrive; it cannot see an
impression that never became a click, which is the entire question at this
stage. Every content decision from here is a guess until this exists — and it
is ten minutes.

**Steps**

1. Go to <https://search.google.com/search-console> and sign in with the Google
   account that should own this long-term. Pick deliberately: moving the
   property later is annoying.
2. **Add property → Domain** (the left-hand box, not "URL prefix"). The domain
   property covers `http`, `https`, `www` and every subdomain in one record,
   which matters because `www.treniko.com` and `http://` both redirect here.
3. Google shows a TXT record like `google-site-verification=<random-string>`.
4. Add it at your DNS provider: type `TXT`, name `@` (or blank, or `treniko.com`
   — the provider decides), value exactly the string Google gave.
   ⚠️ **Do not remove or overwrite the existing SPF record**
   (`v=spf1 include:zoho.eu ~all`). A domain can hold several TXT records; add,
   do not replace. Deleting the SPF record breaks outbound email.
5. Wait for propagation — usually minutes, occasionally an hour — then press
   **Verify**.
6. Once verified: **Sitemaps** in the left sidebar → submit `sitemap.xml` →
   Submit. It should report 14 discovered URLs.
7. **URL Inspection** on `https://treniko.com/` → *Request indexing*. Do the
   same for `/free-personal-trainer-client-tracker` and
   `/personal-trainer-software`. Three is enough; the sitemap handles the rest,
   and hammering the button does not help.

**Then tell me**, and the next session reads real queries and impressions and
rewrites the content roadmap against them instead of against hypotheses.

---

### U2 — nginx: security headers, and a real 404 · ~15 minutes · needs root

**Status:** `TODO` · **This one is technical and I could not do it.** Reading
`/etc/nginx/sites-enabled/treniko` over SSH was refused by the sandbox's
permission classifier, so I could neither inspect nor safely edit the config.
Everything else on the server was deployed normally. Either run the steps below,
or grant the Bash permission and I will do it next session.

**What is wrong.** Measured against production on 25 Aug 2026:

| Problem | Evidence | Consequence |
|---|---|---|
| No `Strict-Transport-Security` | `curl -I https://treniko.com/` returns no HSTS header | A first visit over `http://` can be intercepted before the redirect fires. This is a login-bearing app |
| No `X-Content-Type-Options` | absent | Browsers may MIME-sniff a response into something executable |
| No `Referrer-Policy` | absent | Full URLs leak to third parties in the `Referer` header |
| No frame protection | no CSP `frame-ancestors`, no `X-Frame-Options` | The app can be framed |
| No `Cache-Control` on content pages | `/guides` returns only `Last-Modified` | Cloudflare will not cache them, and browsers fall back to heuristics |
| Extensionless unknown paths return 200 | `/nope` → 200, `/nope.html` → 404 | A soft 404. **Partly fixed already** — commit `06101ec` makes the SPA fallback `noindex, nofollow`, so this no longer creates indexable URLs. A real 404 is still the correct answer |

**The config.** Inside the `server { listen 443 ssl; ... }` block:

```nginx
    # Sent on every response. HSTS is the important one: this app takes
    # passwords, and without it a first http:// visit is interceptable before
    # the redirect runs. Start with a short max-age, raise it once you are
    # confident nothing on the domain needs plain http.
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options    "nosniff" always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
    add_header X-Frame-Options           "SAMEORIGIN" always;

    # The static content pages change when they are regenerated, not on a
    # timer. Revalidation keeps them correct without refetching the body.
    location ~* ^/(guides|personal-trainer-software|personal-trainer-client-management-software|free-personal-trainer-client-tracker) {
        add_header Cache-Control "public, max-age=0, must-revalidate" always;
        try_files $uri $uri/index.html $uri/ =404;
    }
```

⚠️ **`add_header` does not inherit.** If any `location` block in the file
already has its own `add_header`, it discards every one from the server block
and they must be repeated inside it. That is nginx's actual behaviour and it is
the usual reason "I added the header and it is not there".

**Verify before and after, do not assume:**

```bash
nginx -t                       # must say "syntax is ok" — do not reload otherwise
systemctl reload nginx         # reload, not restart: no dropped connections
curl -sI https://treniko.com/ | grep -iE 'strict-transport|x-content-type|referrer'
curl -sI https://treniko.com/guides | grep -i cache-control
```

If anything looks wrong, `git`-less rollback is just removing the added lines
and reloading again. Nothing here touches the application.

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

## Done

*Nothing yet.* This section stays empty until an item above is actually live and
has been checked. It is not a plan tracker.

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
