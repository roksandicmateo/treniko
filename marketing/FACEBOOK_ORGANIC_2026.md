# TRENIKO — Facebook, Page only

**Written:** 25 Aug 2026 · **€0** · No boosts, no ads, no paid reach.

**The boundary this document respects:** the official **TRENIKO Page** may act.
The founder's **personal profile** may not. Where an opportunity requires a
personal profile, it is marked `BLOCKED — PERSONAL PROFILE REQUIRED` and left
alone.

---

## 1. Current state — audited live

| Field | Now | Verdict |
|---|---|---|
| Name | **Treniko** | ✅ Fine |
| Category | **Softverska tvrtka** (Software company) | ✅ Accurate |
| Description | *"Training management software for personal trainers. Manage clients, sessions, payments and progress in one place — less admin, more coaching."* | ⚠️ Accurate but **English-only in a Croatia-first market** |
| Followers | **1** | Expected |
| Reviews | **0** (*"Još nije ocijenjeno"*) | ✅ Correct — no fake reviews, and none will be created |
| Website link | Present | ✅ Verify it carries the UTM |
| Address / phone | None | ✅ **Correct, and must stay that way** — TRENIKO has no premises |
| Scheduled content | 7 feed posts + 4 Reels | ✅ Queued |
| Vanity URL | Still the numeric `profile.php?id=…` | ⚠️ See § 2 |

**I did not edit anything.** The browser session authenticates as the founder's
personal profile, the Page editor sits directly beside *Kreiraj oglase* and
*Boost*, and changing a live business presence is worth the owner's eyes first.
Exact text is below and queued in `MANUAL_QUEUE.md` W2.

---

## 2. Fixes worth making — all free, all manual

### 2.1 Croatian description

The market is Croatia-first and the description is English-only. Add:

> Softver za vođenje treninga za osobne trenere. Klijenti, treninzi, paketi i
> plaćanja na jednom mjestu — manje administracije, više treninga.

### 2.2 Action button

Should be **Otvori web-stranicu**, pointing at:

```
https://treniko.com/?utm_source=facebook&utm_medium=social&utm_campaign=organic&utm_content=page-cta
```

### 2.3 Claim the username

The Page is still on a numeric URL. A username (`@treniko` or `@trenikoapp` if
taken) makes the Page linkable, searchable and quotable. Free, one form.

⚠️ Facebook historically gated usernames behind a follower minimum. **If it is
unavailable, that is expected at 1 follower — try again later, do not chase
followers artificially to unlock it.**

### 2.4 Pin a post

A Page with one follower converts through its pinned post, not its feed. Pin the
free tracker post — it asks for nothing and is the strongest single asset.

### 2.5 What must NOT be added

- **No address.** TRENIKO has no premises. Inventing one to satisfy Facebook's
  "Page completeness" nudge is fabricated business information and can get a
  Page restricted.
- **No phone number** that is not real and answered.
- **No reviews solicited from non-users.**
- **No "Boost".** The button is everywhere in that interface; decline all of it.

---

## 3. What a Page can actually do organically

Verified as Page-level capabilities, not personal-profile ones:

| Capability | Page can? | Useful for TRENIKO? |
|---|---|---|
| Publish text, link, image and video posts | ✅ | ✅ Core |
| Publish Reels | ✅ | ✅ Highest reach format |
| Publish Stories | ✅ | ⚠️ Low value at 1 follower |
| Cross-post from Instagram | ✅ | ✅ Free, and halves the work |
| Comment **as the Page** on other Pages' posts | ✅ | ✅ See § 4 |
| Like/follow other Pages as the Page | ✅ | ✅ Builds a feed to interact with |
| Receive and answer Messenger messages | ✅ | ✅ Answer everything |
| Pinned post, username, action button | ✅ | ✅ § 2 |
| **Join or post in Groups** | ❌ **Mostly not** | **BLOCKED — PERSONAL PROFILE REQUIRED** |
| Comment in Groups as a Page | ⚠️ Some groups only | Check per group; assume no |
| Invite people to like the Page | ⚠️ Personal-profile action | **BLOCKED — PERSONAL PROFILE REQUIRED**. Also low value |

**The honest constraint:** Facebook Groups are where Croatian trainers actually
are, and **Groups are largely a personal-profile surface**. That is the single
biggest limitation of a Page-only strategy, it cannot be engineered around, and
it will not be worked around here.

---

## 4. Page-to-Page: the one genuinely underused lever

A Page can comment on another Page's public posts **as the Page**. That is
visible to that Page's audience, it is free, and almost nobody does it well.

**Where it is appropriate** — Pages whose audience is trainers:

| Target type | Example | What to contribute |
|---|---|---|
| Croatian fitness education providers | HFS Academy, Fitnes učilište, Flexyfit | A genuinely useful reply when they post about starting out as a trainer |
| Croatian gyms and studios | Local Varaždin/Zagreb Pages | Only where a post invites discussion |
| Trainer-educator Pages | Croatian coaches teaching the business side | The most natural fit |
| Fitness business content Pages | International | Lower value, wrong market |

**Rules, and they are the whole thing:**

- Comment because you have something to say. If the comment would be worth
  posting with TRENIKO removed, post it.
- **Never** a link in a first comment on someone else's Page.
- **Never** the same comment twice.
- **Never** on a post about a client's results or someone's personal news.
- 2–3 comments a week, not twenty. A Page that appears everywhere is a spam Page.

**Realistic expectation:** this does not produce a trainer directly. It makes the
Page look inhabited rather than abandoned, which matters when someone checks it
after seeing a link.

---

## 5. Thirty-day, Page-only

Assumes ~20 minutes a day. Nothing here costs anything.

**Week 1 — make the Page worth landing on**
- Day 1: § 2 fixes — Croatian description, action button + UTM, try the username
- Day 2: pin the free tracker post
- Day 3: follow 10 relevant Croatian Pages as the Page
- Days 4–7: publish 2 queued posts; answer anything that arrives

**Week 2 — start contributing**
- 2–3 Page-to-Page comments, genuinely useful, no links
- Publish 1 Reel (cross-posted from Instagram)
- Publish 1 link post → a guide, with UTM

**Week 3 — the free tools**
- Post the free tracker with a real explanation, not a link drop
- Post the pricing calculator the same way, later in the week
- 2–3 more comments

**Week 4 — review**
- Check the admin funnel for `utm_source=facebook`
- If it is zero, **that is the answer, and it is fine**: at 1 follower a Page is
  a credibility surface, not an acquisition channel
- Keep the fixes, drop the cadence to whatever is sustainable

**The 80/20 rule throughout:** at least four in five pieces useful with no
product mention.

---

## 6. UTM convention

Every outbound link from the Page:

```
?utm_source=facebook&utm_medium=social&utm_campaign=organic&utm_content=<placement>
```

`<placement>`: `page-cta` (the button — already live, leave it) · `pinned-post` ·
`post-tracker` · `post-calculator` · `reel-countdown` · `comment` (only where a
link is genuinely appropriate).

Everything lands in the admin funnel by source and campaign.

---

## 7. Honest assessment

**The Facebook Page will probably not produce one of the first ten trainers.**

One follower, no Group access without a personal profile, and no paid reach. The
fixes in § 2 are worth twenty minutes because they make the Page a credible
destination for someone who arrives from elsewhere — not because the Page itself
is a channel yet.

**Where the Page genuinely earns its place:**

1. **Credibility.** A trainer who gets a DM will look you up. An empty numeric-URL
   Page with an English description reads worse than no Page.
2. **Free cross-posting.** Everything made for Instagram can be published here at
   no extra cost.
3. **Messenger.** It is a real inbox on a channel Croatian users actually use.

Rank it **below** messaging trainers you know, local gyms, and the education
providers — and do not let Page housekeeping substitute for those, because it
feels productive and is not.
