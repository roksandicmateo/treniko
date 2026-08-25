# TRENIKO — Meta / Facebook setup plan

> ## ⚠️ SUPERSEDED — session 6, 18 Aug 2026
>
> **The Facebook Page now exists.** This file is a *plan* that has been partly
> executed, and its "nothing created" status below is out of date.
>
> - Page **Treniko** — `facebook.com/profile.php?id=61593112186107`, asset id
>   `1300314106493001`. Branded, CTA set, **0 followers, 0 posts**
> - Business Suite schedules **Facebook** content today
> - **Instagram is still not connected** — `MANUAL_QUEUE.md` § M1
> - **Still true: €0 spent, no ad account, no payment method**
>
> This file recommended waiting until 7–14 Sep. The session-6 brief asked for the
> Page now, so it was created now. Current state: **`SOCIAL_AUDIT.md`.**
> What goes on the Page: **`FACEBOOK_STRATEGY.md`.**
>
> Kept below as the reasoning that led here — the ownership warnings in
> particular are still worth reading.

**Written:** 18 Aug 2026, session 4.
**Status: NOTHING CREATED. NOTHING CONNECTED. €0 SPENT.**

No Facebook Page exists. No Meta Business Suite asset exists. No Ads Manager
account exists. No payment method has been added anywhere. This file is a plan
for a human to execute deliberately, not a record of work done.

**Why nothing was created:** every step below requires account ownership
decisions and a login that belongs to a person, not to an automated session.
Creating a Page or a Business account binds it to whichever personal profile is
signed in — an irreversible ownership decision with real consequences if it
lands on the wrong account. That is the founder's call, made knowingly.

---

## Should this happen at all yet?

Honestly: **not this week.**

The Instagram account has 2 followers, 2 published posts and no measurement on
the website (see `ANALYTICS_PLAN.md`). A Facebook Page adds a second surface to
keep alive before the first one has proved anything, and an empty, stale Page is
worse for a SaaS brand than no Page.

**The one real reason to do it sooner rather than later** is that a Page is a
prerequisite for several things you will eventually want — Meta's own scheduler,
Ads Manager, and the Instagram Graph API. It costs nothing to hold the name.

**Recommended trigger: do it when the first Reel data is in, around 7–14 Sep**,
and set it up as infrastructure rather than as a channel to feed.

---

## Order of operations

Do these in order. Each depends on the one before it.

### 1. Facebook Page

| Field | Value |
|---|---|
| Page name | **TRENIKO** |
| Username | `@treniko` if free, otherwise `@trenikoapp` — check availability before committing |
| Category | **Software company** (primary). Not "Fitness" and not "Health/beauty" — the same miscategorisation that had to be corrected on Instagram |
| Bio | Run your coaching business — not spreadsheets. Clients · Sessions · Payments · Progress. |
| Website | `https://treniko.com` |
| Email | `info@treniko.com` |
| Profile picture | `marketing/brand/treniko-avatar.png` — same avatar as Instagram |
| Cover image | **Does not exist yet.** Facebook covers are ~1640 × 856 (a very different ratio from anything in `marketing/`). Needs one new asset |
| Phone / address | Leave empty. Nothing personal published |

**Create it from the founder's personal Facebook profile.** Facebook requires a
personal profile as administrator; this is normal and the personal profile is
not shown publicly as the Page owner.

Add a second admin as soon as one exists. A Page with exactly one administrator
is a single point of failure — losing that login loses the Page.

### 2. Meta Business Suite / Business Portfolio

Create a **Business Portfolio** at `business.facebook.com` and move the Page
into it.

Why it matters: assets owned by a Business Portfolio can be transferred,
delegated and recovered. Assets owned directly by a personal profile largely
cannot. Do this **before** connecting Instagram, not after.

| Field | Value |
|---|---|
| Business name | TRENIKO |
| Business email | `info@treniko.com` |
| Website | `https://treniko.com` |

### 3. Connect Instagram ↔ Facebook

From **Instagram app** → Settings → Accounts Centre → add the Facebook Page.
Or from Business Suite → Settings → Instagram accounts → Connect.

What this unlocks:
- Scheduling **and Reel scheduling** from Meta Business Suite — the thing the
  automated browser cannot do (see `PUBLISHING_QUEUE.md`). This is the single
  most valuable item in this whole file.
- Unified inbox for comments and DMs across both surfaces.
- Instagram Insights inside Business Suite, exportable.

⚠️ **Check what cross-posting is turned on.** Connecting the accounts can enable
automatic sharing of Instagram posts to the Page by default. Decide that
deliberately — see the next section.

### 4. Cross-posting policy — decide, do not drift

**Recommendation: do not mirror everything automatically.**

The content is written for Instagram — 4:5 crops, Reel-first hooks, "link in
bio" phrasing that means nothing on Facebook, where links are clickable in the
post itself.

| Content | Cross-post? | Why |
|---|---|---|
| Carousels (educational, pain) | **Yes** | Travel well. Facebook groups for trainers are a real distribution channel |
| Reels | **Yes** | Facebook Reels is a separate reach pool and costs nothing extra |
| Single-image brand/CTA posts | Case by case | Rewrite the CTA — a real link beats "link in bio" |
| Stories | **No** | Facebook Stories has negligible reach for a B2B page |
| Polls / question boxes | **No** | The stickers do not carry across meaningfully |

Where a post is cross-posted, **replace "link in bio" with the actual link.**
Leaving Instagram phrasing on Facebook is the clearest possible signal that
nobody is really running the Page.

### 5. Meta Business Suite scheduling

Once connected, Business Suite can schedule **feed posts, carousels, Stories and
Reels** for Instagram — including the formats Instagram web cannot.

**This is the fix for the Reel bottleneck.** It does not remove the need to
publish the current five manually — those dates start 22 Aug and the connection
will not be in place — but from cycle 2 onwards, Reels could be scheduled rather
than posted by hand.

Re-test it before relying on it. Do not rewrite `PUBLISHING_QUEUE.md` to say
"scheduled" until Business Suite has confirmed a scheduled Reel in its own
interface.

### 6. Ads Manager — set up, do not spend

Create the ad account so it exists and is verified. **Do not create a campaign
and do not add a payment method** until there is something worth paying to
amplify.

The honest sequencing:

1. Publish organically for the full 30 days.
2. Find which pieces earn non-follower reach and shares.
3. Fix the attribution break in `ANALYTICS_PLAN.md` — **paid traffic without
   conversion tracking is money spent to learn nothing.**
4. Only then consider putting budget behind an already-proven organic piece.

Boosting an unproven post to an unmeasured landing page is the most common way
small SaaS brands waste their first advertising money.

**Meta Pixel:** installing it means adding a third-party tracking script to
`treniko.com`. That is a production code change, a GDPR/consent question for an
EU audience, and out of scope for a marketing task. If cookieless analytics
(step 1 of the attribution plan) is chosen instead, a Pixel may never be needed —
and the consent banner it would require is a real conversion cost.

---

## Explicit non-goals for now

- No Facebook **Group**. A group with no members is worse than no group.
- No TikTok, LinkedIn, YouTube or Threads. One channel, done properly.
- No WhatsApp Business API.
- No ad spend, no boosted posts, no payment method on file.
- No Meta Verified subscription.

---

## What is needed from the founder before any of this starts

1. **Confirmation to create a Facebook Page at all**, and on which personal
   profile it should be administered.
2. The `@treniko` username decision, once availability is checked.
3. A Facebook cover image — the one asset in this plan that does not exist.
4. A decision on cross-posting defaults at connection time.

Until those exist, this file stays a plan.
