# TRENIKO — Instagram profile record

Account: **@treniko_fitness** · profile name "Treniko" · Business (professional) account.
Verified as the official brand account: TRENIKO logo, product bio, `www.treniko.com`
in the link field, business email on file. The founder's personal account is
`karlo.kurtanjek` — a separate account, never used for brand publishing.

## Audit — before

| Field | Before | Assessment |
|---|---|---|
| Profile picture | Dark circle with a red "TRENIKO" wordmark | Off-brand. Red is not in the palette, the wordmark was illegible at avatar size, dark ground clashed with the light product |
| Name | `Treniko` | No category signal. Wastes the single most searchable field on Instagram |
| Bio | "Fitness business platform for real trainers. / Clients. Plans. Progress. Payments. / Built to simplify coaching. / Free for early adopters" | 132 chars, so the fourth line — the actual offer — sat behind "…more" and was never read. "Fitness business platform" reads as a gym brand, not software |
| Website | `www.treniko.com` | Correct already |
| Category | **Health/beauty** | Wrong. Miscategorises a SaaS product as a beauty business to Instagram's recommendation system |
| Category label | Hidden | — |
| Business email | `info@treniko.com` | Correct already, no personal data exposed |
| Phone / WhatsApp | Empty | Correct — nothing personal published |
| Posts | 1 (Day 1) | Good post, correct 4:5, on-brand |
| Highlights | None | — |

## Changes applied

| Field | After | How |
|---|---|---|
| Profile picture | `marketing/brand/treniko-avatar.png` — white geometric T on `#0ea5e9`, full bleed | Instagram web, Edit profile → Change photo |
| Bio | see below (113 chars, fully visible, no "…more") | Instagram web, Edit profile → Submit |
| Category | **Product/service** | Settings → Professional account → Category |

### Live bio

```
Run your coaching business — not spreadsheets.
Clients · Sessions · Payments · Progress
↓ Free for early adopters
```

113 characters. Instagram truncates the profile bio at roughly 125 characters,
so this is deliberately short enough that **every line renders**, including the
call to action directly above the link. An earlier four-line draft that also
carried "Less admin. More coaching." was tested live and pushed the CTA behind
"…more"; the tagline was dropped rather than lose the CTA. It still appears on
the Day 1 artwork and in captions.

"Free for early adopters" is not invented — it was already the account's own
public claim, previously hidden by truncation. It is preserved deliberately
because it is a concrete reason to click, and it is the founder's own offer.

## Not applied — Instagram web limitations, not choices

| Item | Why | Where to do it |
|---|---|---|
| **Display name** → `TRENIKO \| Personal Trainer Software` | Instagram's web Edit profile page has **no Name field** at all | Instagram mobile app → Edit profile → Name |
| **Website link** | Field is present but read-only on web: "Editing your links is only available on mobile." Value is already correct, so nothing needs changing — verified `https://treniko.com` returns HTTP 200, title "Treniko — Training Management for Personal Trainers" | Mobile app, only if it ever needs changing |
| **Category → "Software company"** | Only reachable through the category **search box**; the eight suggested categories on web do not include it. Product/service was applied as the best available option and is on the approved list | Mobile app → Professional account → Category → search "Software" |
| **Pin Day 1 post** | The post's "More options" menu on web offers Delete, Edit, Hide like count, Turn off commenting, About this account, Share to, Copy link, Embed — **no Pin option**. Pinning is mobile-only | Mobile app → post → ⋯ → Pin to your profile |
| **Highlight covers upload** | Creating a highlight requires an existing Story, and Stories cannot be published from Instagram web | Mobile app, once Story content exists |

### Recommended display name

`TRENIKO | Personal Trainer Software` — 35 characters, within Instagram's
64-character limit and short enough not to wrap on mobile.

Chosen over `TRENIKO | Coaching Software` because Instagram indexes the name
field for search, and "personal trainer software" is the higher-intent query for
the target audience; "coaching software" also collides with life- and
business-coaching tools. Searchable intent beats clever wording here.

### Category label

Left hidden. Turn "Display category label" on **after** the category is changed
to "Software company" in the mobile app — "Product/service" is too vague to be
worth the line of profile real estate, but "Software company" earns it.
