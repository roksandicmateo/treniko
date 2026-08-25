# TRENIKO — social audit

**Read off the live platforms:** 18 Aug 2026, session 6 · timezone **Europe/Zagreb**
**Accounts in scope:** Instagram `@treniko_fitness` · Facebook Page **Treniko**

Everything below was observed, not inferred. Where a field could not be read
from a desktop browser it says so rather than guessing.

---

## 1. Instagram — @treniko_fitness

| Field | Value | Changed this session? |
|---|---|---|
| Username | `treniko_fitness` | no |
| Display name | `TRENIKO \| Personal Trainer Software` | no |
| Bio | Run your coaching business — not spreadsheets. / Clients · Sessions · Payments · Progress / ↓ Free for early adopters | no — **113 / 150 chars** |
| Link | `www.treniko.com` (untagged, deliberate) | no |
| Category | Product/service | no |
| Avatar | TRENIKO geometric T, white on `#0ea5e9` | no |
| Account type | **Business** (Settings offers "Switch to creator" / "Switch to personal", which only a Business account shows) | no |
| Followers | **2** | — |
| Following | **0** | — |
| Posts | **2** — P01, P02 | — |
| Scheduled | **14** — P03 … P20, previously verified live | **not touched** |
| Reels published | **0** | — |
| Stories live | **0** | — |
| Highlights | **0** | — |
| Pinned | P01 sits first in a reverse-chronological grid, which means it is pinned. No pin badge was legible at desktop zoom | — |
| Restrictions / warnings | **none visible** | — |
| Insights | non-follower reach **0%** — see `CONTENT_BASELINE.md`. Not re-read this session | — |

**Nothing on the Instagram profile was modified.** The bio is good and sits
inside the character limit; changing it only to have changed it would cost the
one thing the profile has going for it.

### What Instagram web still cannot do

Re-confirmed this session, not re-tested from scratch:

| Action | Web? | Why |
|---|---|---|
| Edit bio / name / website | yes | already correct, left alone |
| Edit the multi-link list | **no** | Instagram states plainly: *"Editing your links is only available on mobile."* |
| Create a Story | **no** | Create menu offers Post / Live video / Ad only |
| Create a Highlight | **no** | a Highlight can only be built from a Story that has been posted |
| Upload a Reel | **no** | proven twice: video never leaves `readyState 0` in an automated browser |
| Link a Facebook Page from the Instagram side | **no** | Settings → *Business tools and controls* offers only account-type switching |

Everything in that "no" column is in `MANUAL_QUEUE.md`, with the exact taps.

---

## 2. Facebook — before this session

There was **no TRENIKO Facebook Page**. Business Suite held six Pages, none of
them related to TRENIKO:

Lighters Hrvatska · Manchester United Balkan Fans · FC Barcelona Fans ·
La Liga · Zdrava Navada · Zašto je Bog stvorio Real?

**None of them was opened, edited, posted to, or connected to anything.** They
are listed here only so that the next person can recognise them as *not ours*
and leave them alone.

---

## 3. Facebook — after this session

| Field | Value |
|---|---|
| Page | **Treniko** |
| URL | `https://www.facebook.com/profile.php?id=61593112186107` |
| Page ID | `1300314106493001` |
| Category | Softverska tvrtka (**Software company**) |
| Description | Training management software for personal trainers. Manage clients, sessions, payments and progress in one place — less admin, more coaching. |
| Website | `https://treniko.com` |
| Email | `info@treniko.com` |
| Profile picture | `marketing/brand/treniko-avatar.png` |
| Cover | `marketing/social/facebook/fb-cover.png` (1640 × 856) |
| CTA button | **Learn More** → `https://treniko.com/?utm_source=facebook&utm_medium=social&utm_campaign=organic&utm_content=page-cta` |
| Username / vanity URL | **not set — Facebook does not offer one yet** (see below) |
| Followers | **0** |
| Posts | **0** |
| Instagram connection | **NOT CONNECTED** (see below) |

### The name is "Treniko", not "TRENIKO"

Facebook rejected the all-caps form outright:

> *Naziv stranice "TRENIKO" nije valjan. Predlažemo naziv stranice "Treniko".*

This is a platform naming rule, not a choice. "Treniko" was accepted, and it
matches the `treniko.com` page title, so the deviation is harmless. The
wordmark in the cover image and the avatar still read **TRENIKO**, which is
where the brand actually lives.

### What was deliberately skipped

| Prompt | Skipped because |
|---|---|
| WhatsApp business number | there is no business number to give |
| Invite friends to follow the Page | it would spam a personal network with a product they did not ask for |
| Street address, phone, opening hours | TRENIKO has none of these; inventing them is exactly the kind of filler the brief forbids |
| Ad account, payment method, boost | **€0 spend.** Non-negotiable |

### Instagram DM access in the Page inbox — turned OFF

The connect flow defaults *"Enable access to Instagram messages in your inbox"*
to **on**. It was switched **off**: it widens who can read the Instagram DMs of
a brand-new account for no benefit anyone has asked for, and it is one toggle to
reverse later if the inbox is ever genuinely wanted.

---

## 4. Instagram ↔ Facebook connection — BLOCKED, manual

**Status: not connected. This is the one item in the brief that could not be
finished, and it is a hard block rather than a shortcut not taken.**

What was tried, from two independent entry points:

1. Business Suite home → *Connect Instagram*
2. Business Suite → Settings → Profiles → Treniko → *Poveži Instagram*

Both open the same dialog, whose only real option is **"Log into Instagram"**.
Clicking it advances to the Instagram messaging-settings step, and *Continue*
fires a `POST /api/graphql/` that returns **200** — and then nothing. The flow
needs an Instagram OAuth **popup window**, which never becomes a reachable tab.
Four attempts, two entry points, same outcome.

To be explicit about what was *not* done: no Instagram password was typed
anywhere, and no attempt was made to route around the authentication step.

**Consequence, and it is the important one:** Business Suite reaches Instagram
*through* a linked Facebook Page. Until this connection exists:

| | |
|---|---|
| Schedule **Facebook** posts, Reels and Stories in Planner | ✅ **available now** — verified, the Planner loads and offers *Schedule a post or story* |
| Schedule **Instagram** feed posts, Reels or Stories | ❌ still unavailable |
| Cross-post Instagram → Facebook automatically | ❌ still unavailable |
| Instagram Insights inside Business Suite | ❌ still unavailable |

So the Reel bottleneck is **not** solved yet. Five Reels remain manual
phone-publishing. The fix is one two-minute action on a phone —
`MANUAL_QUEUE.md` § M1.

### The wrong-account hazard still stands

The *Connect Instagram* button also sits on **FC Barcelona Fans**, **La Liga**
and the other four unrelated Pages. Connecting `@treniko_fitness` to one of
those would drop TRENIKO Reels into a football fan page's queue. **Before
confirming any connection, read the Page name and check it says `Treniko`, and
read the Instagram handle and check it says `treniko_fitness`.**

---

## 5. Facebook Page username — not available yet

`facebook.com/username` returns *"Content isn't available right now"* for this
Page, and no username field appears anywhere in Page settings or the About tab.
This is expected: Facebook withholds vanity URLs from Pages with no followers
and no content. It is not a permissions problem and there is nothing to fix.

**Re-check it once the Page has a handful of followers and a few posts.**
Preferred handle, in order: `treniko` · `trenikoapp` · `getTreniko`.
Queued as `MANUAL_QUEUE.md` § M6.

---

## 6. Honest summary

**Good:** the Instagram profile is correct and needs nothing. The Facebook Page
now exists, is properly branded, and its Planner can schedule Facebook content
today.

**Bad:** the account has 2 followers and **0% non-follower reach**. Nothing has
entered distribution. The single highest-value action available to anyone is
still publishing a Reel from a phone — not another document.

**Unfinished:** the Instagram ↔ Facebook link. It gates Instagram scheduling,
cross-posting and unified insights, and it cannot be done from this browser.
