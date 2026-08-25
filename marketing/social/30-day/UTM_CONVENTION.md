# TRENIKO — UTM convention (Instagram + Facebook)

**Settled:** 18 Aug 2026, session 6. Supersedes the `organic_social` /
`launch_30day` form this file previously carried.

Documented and **partially applied**: the Facebook Page CTA button already
carries these parameters. Everything else is tagged on paper only.

---

## The convention

```
https://treniko.com/?utm_source=<network>&utm_medium=social&utm_campaign=<campaign>&utm_content=<content-id>
```

| Parameter | Value | Notes |
|---|---|---|
| `utm_source` | `instagram` · `facebook` | always lowercase, one network per value. Never `ig` or `fb` |
| `utm_medium` | `social` | constant |
| `utm_campaign` | `organic` | this is where the **organic / paid** split lives. Reserve `paid` for any future ad spend — there is none today and none planned |
| `utm_content` | `post-p11` · `reel-p05` · `story-wk3` · `link-in-bio` · `page-cta` | the specific placement. Lowercase, hyphens, never underscores |

### Why this form and not the other one

Two conventions existed side by side in this repository and neither was wrong —
`30-day/UTM_CONVENTION.md` used `utm_medium=organic_social` +
`utm_campaign=launch_30day`, while `ANALYTICS_IMPLEMENTATION.md` used
`utm_medium=social` + `utm_campaign=organic`.

**The second one wins**, for two reasons that are about consequences rather than
taste:

1. It is already live. The Facebook Page CTA button was configured with it, and
   changing a live button to match a document is worse than changing the document.
2. Mixed conventions produce **two rows in every report for one channel** — which
   is precisely the failure that makes attribution data untrustworthy right when
   someone starts relying on it.

Keeping the organic/paid distinction in `campaign` rather than `medium` also
means a future ad campaign changes one value, not two.

**This decision has been propagated.** The four cycle-1 Story URLs in
`PUBLISHING_QUEUE.md` and the five cycle-2 URLs in `CONTENT_BATCH_CYCLE_2.md`
now use this form. Nothing was published under the old form, so nothing is
orphaned.

---

## Where tags are used

| Placement | Tagged? | Why |
|---|---|---|
| Instagram bio link | **No** | Instagram appends its own `utm_source=ig&…&fbclid=…` to outbound bio clicks. Double-tagging risks one set overriding the other, and a long UTM string in the profile's one visible link looks untrustworthy. `referrer_host` catches these instead |
| Instagram Story link stickers | **Yes** | the sticker hides the URL, so length costs nothing |
| Facebook post links | **Yes** | Facebook shows the destination but not the query string |
| Facebook Page CTA button | **Yes — already live** | `utm_content=page-cta` |
| Link in a DM or comment reply | **Yes** | |
| Anything in an Instagram caption | **No** | captions are not clickable, so a UTM there only makes the text uglier |
| Anything in a Facebook post body | **Yes** | Facebook post links *are* clickable — this is the main reason Facebook-native posts exist at all (`FACEBOOK_STRATEGY.md`) |

---

## Content IDs in use

| Placement | `utm_content` |
|---|---|
| Feed post | `post-p03` … `post-p21`, `post-c01` … `post-c10` |
| Reel | `reel-p05` … `reel-p21`, `reel-r01` … `reel-r10` |
| Story, cycle 1 | `story-wk2` · `story-wk3` · `story-wk4` · `story-wk5` |
| Story, cycle 2 | `story-c2-wk1` … `story-c2-wk4` · `story-c2-recap` |
| Instagram bio link | `link-in-bio` — reserved, **not currently applied** |
| Facebook Page CTA | `page-cta` — **live** |

---

## Before this is worth anything

**Nothing on `treniko.com` reads UTM parameters.** Verified by reading the
repository, not assumed: no GA4, Plausible, Umami, PostHog, Matomo, Fathom or
Segment; no UTM parsing anywhere in the application; no `utm_*` capture at
registration.

So every tagged link above currently produces exactly zero attribution.

**Tag them anyway.** The click still lands, the URLs are already correct, and the
data starts existing the day analytics ships — rather than starting from zero
then. The proposal is `ANALYTICS_PLAN.md` § *Attribution* and the implementation
design is `ANALYTICS_IMPLEMENTATION.md` (migration 034).

**No production application code has been changed for any of this.** That remains
a separate, deliberate deploy.
