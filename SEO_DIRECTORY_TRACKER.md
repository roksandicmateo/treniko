# TRENIKO — directory & community tracker

**Started:** 24 Aug 2026 · **Budget: €0** · Nothing here has been paid for.

Working document. Update the status column when something is actually submitted
or goes live — **not** when it is planned.

Two rules, because this file is only useful if it is true:

1. **"Submitted" means submitted.** Not queued, not drafted. If it needs a login
   only the founder has, the status is `NEEDS FOUNDER`.
2. **"Verified free" means I loaded the page and checked.** Where I could not,
   the row says so rather than repeating what a listicle claimed.

---

## 1. Why almost nothing here is submitted yet

Every directory below requires an account, created with an email address and
confirmed from that inbox. That is the founder's identity, not something to
create on their behalf — so the work done here is research and paste-ready copy,
and the submitting is a short manual session.

The "300+ SaaS directories" lists that circulate were **deliberately not used**.
They are largely link farms: pages of outbound links with no editorial content,
accepting everything. Google discounts them, and mass-submitting is the exact
pattern that gets a young domain treated as spam. Ten relevant listings beat
three hundred junk ones, and the junk ones carry real downside.

---

## 2. Directories

| # | Site | URL | Free? | Relevance | Account | Link type | Status | Date | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **SaaSHub** | saashub.com/submit | ✅ **verified free** — page states "free marketing tool", no paid tier shown | High — ranks for "[product] alternatives" | Required | Believed dofollow, unverified | `NEEDS FOUNDER` | — | Best first submission. Verify the product after submitting to unlock the management page |
| 2 | **AlternativeTo** | alternativeto.net | Free per public docs — **could not verify**, submission path requires login | High — buyers search "alternative to X" | Required | Believed nofollow, unverified | `NEEDS FOUNDER` | — | List as an alternative to established PT/gym software. Traffic value > link value |
| 3 | **Indie Hackers** | indiehackers.com | Free | Medium — founders, not trainers | Required | Profile link | `NEEDS FOUNDER` | — | The listing does little on its own; a build/milestone post is what gets read |
| 4 | **Crunchbase** | crunchbase.com | Free basic tier | Medium — entity/brand signal | Required | Believed nofollow | `NEEDS FOUNDER` | — | Free tier is sufficient. **Decline the paid upgrade prompts** |
| 5 | **Capterra / GetApp** | capterra.com/vendors | Free listing exists | **Highest commercial intent** — buyers compare here | Required | Referral traffic | `NEEDS FOUNDER` | — | ⚠️ Pushes pay-per-click hard. The free listing is the whole point — **decline every upsell** |
| 6 | **Product Hunt** | producthunt.com | Free | High reach, one-shot | Required | Referral spike | `HOLD` | — | **Do not launch yet.** A launch with no users spends a one-time card for nothing. Revisit once there are real trainers to point at |
| 7 | **Croatian startup directories** | — | — | Medium | — | — | `NOT RESEARCHED` | — | Worth a session. Local relevance beats generic SaaS directories for the initial ICP |
| 8 | **Fitness-software resource pages** | — | — | **Highest relevance** | — | — | `NOT RESEARCHED` | — | One mention on a site personal trainers read is worth more than ten SaaS directories |

### Explicitly rejected

| Site type | Why |
|---|---|
| Any "submit to 300 directories" service | Link farm. Real downside, no upside |
| Anything charging a listing or "expedited review" fee | €0 budget, and paid links violate Google's guidelines |
| Directories with no editorial content | Google discounts them; association is a negative signal |

---

## 3. Paste-ready listing copy

**Name:** TRENIKO
**Tagline:** Training management software for independent personal trainers
**Category:** Business / Fitness / SaaS
**Pricing:** Free (no payment processor exists in the product)

**Short (≤160 chars)**

> TRENIKO keeps clients, sessions, packages, payments and progress in one
> workspace, for personal trainers who run the business themselves.

**Long**

> TRENIKO is training management software for independent personal trainers —
> the people who coach *and* run the business. One record per client with goals,
> notes and full history. One-to-one and group sessions marked completed,
> cancelled or no-show. Session packages that count down automatically and warn
> before a client runs out. Payments recorded against the sessions they cover.
> Progress measurements over time. Training plans built from your own exercise
> library.
>
> It is not a gym system with the gym removed: no membership billing, no front
> desk, no class-booking portal to configure. Free while TRENIKO is early —
> there is no payment processor in the product, so there is nothing to pay and
> no card to enter.

**URLs to submit** — tagged so the admin Acquisition panel can attribute them:

```
saashub        https://treniko.com/?utm_source=saashub&utm_medium=referral&utm_campaign=organic&utm_content=listing
alternativeto  https://treniko.com/?utm_source=alternativeto&utm_medium=referral&utm_campaign=organic&utm_content=listing
indiehackers   https://treniko.com/?utm_source=indiehackers&utm_medium=referral&utm_campaign=organic&utm_content=listing
crunchbase     https://treniko.com/?utm_source=crunchbase&utm_medium=referral&utm_campaign=organic&utm_content=listing
capterra       https://treniko.com/?utm_source=capterra&utm_medium=referral&utm_campaign=organic&utm_content=listing
producthunt    https://treniko.com/?utm_source=producthunt&utm_medium=referral&utm_campaign=organic&utm_content=launch
```

Some directories strip query strings. Where that happens, use the bare
`https://treniko.com/` — a listing without attribution still beats no listing,
and `referrer_host` will catch most of it anyway.

---

## 4. Community angles

**Rules were read before anything was recommended.** Verified directly:

| Community | Rule | Verdict |
|---|---|---|
| **r/personaltraining** | Rule 1: *"do not solicit your services here"* — violating posts removed | ❌ **Never promote.** Participation only, no links, ever |
| **r/SaaS** | Rule 2: no direct sales; mention your product only when *"relevant and actually helpful"*. Rule 4: a blog post must carry its value in the Reddit post itself | ✅ A substantive build post is allowed |

Wider pattern worth internalising: across founder-frequented subreddits, most
ban self-promotion outright, and the reliably safe route is a designated weekly
thread plus genuine participation.

### Ten angles, and where each belongs

Each answers a real question. Where the answer is the whole post and the link is
absent, that is the point — not a tactic.

| # | Angle | Where | Link? | Why it is useful |
|---|---|---|---|---|
| 1 | "How do you decide whether a late cancellation uses a session?" | r/personaltraining | ❌ **No** | A genuine policy question trainers disagree on. Ask it, answer others, link nothing |
| 2 | "What do you actually track for each client?" | r/personaltraining | ❌ No | Pure discussion. Our answer is the guide's content, given in the comment |
| 3 | Free spreadsheet template, shared as a resource | r/personaltraining weekly thread **if one exists** | ⚠️ Only if the thread permits | Genuinely free, no email wall — but check the rule first, and accept "no" |
| 4 | "I built session-package tracking; here is what I got wrong twice" | r/SaaS | ✅ Allowed | Real lessons, substance in the post body per Rule 4 |
| 5 | "Prerendering one page of a Vite SPA without adding a framework" | r/SaaS, r/webdev | ✅ Allowed | Actually novel, and TRENIKO is incidental context |
| 6 | "Counting page views first-party without cookies" | r/SaaS, Indie Hackers | ✅ Allowed | A real technical write-up others can reuse |
| 7 | Build/milestone update | Indie Hackers | ✅ Expected there | The listing does nothing; the milestone post is what gets read |
| 8 | Croatian trainer Facebook groups | — | ⚠️ **Rules not yet read** | Likely the best fit for the initial ICP. **Read each group's rules first** |
| 9 | Answering "what software do you use?" threads | Anywhere it is asked organically | ⚠️ Only if the sub permits | Mention it once, honestly, including who it is *not* for |
| 10 | Croatian entrepreneur communities | — | `NOT RESEARCHED` | Worth a session |

### Never

Fake accounts · fake conversations · posting as a customer · the same text in
several places · link-dropping · engagement pods · astroturfed "has anyone tried
TRENIKO?" threads.

### Status

**Nothing has been posted anywhere.** The browser is logged into a personal
Reddit account; it was used to read rules only. Any posting should be done by
the founder, from an account with real history — a first-ever post that is a
product link gets removed and deserves to.

---

## 5. Backlinks actually acquired

**Zero.** None have been built, and none will be claimed here until a live URL
can be pasted into this table.

| Source | URL | Type | Date | Verified |
|---|---|---|---|---|
| — | — | — | — | — |
