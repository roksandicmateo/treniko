# TRENIKO — pointing social at the content that now exists

**Written:** 25 Aug 2026 · **Nothing scheduled has been changed.**

## Why this is not another content batch

Cycle 1 (`CONTENT_CALENDAR_30_DAYS.md`) runs to 14 Sep and 14 posts are live in
Instagram's scheduler. Cycle 2 (`CONTENT_BATCH_CYCLE_2.md`) has 40 pieces
written to 17 Oct. Writing a cycle 3 today would produce a third document
covering the same pain points, and the honest assessment is that **the content
pipeline is not the bottleneck.**

The bottleneck is that every one of those 54 pieces was written before the
website had anything to link to. There are now fourteen public URLs — eleven of
them written this week — and the social calendar does not point at a single one.

So this file does one thing: it maps content that already exists on both sides
to each other, and adds the small number of pieces the **free tracker** needs,
because that asset has no social coverage at all and is the strongest thing
TRENIKO can give away.

---

## 1. The link-in-bio problem

Instagram allows one link. There are now fourteen destinations. The instinct is
to rotate the link per post; that is a mistake, because the bio link is the only
one that persists after a post scrolls away.

**Set the bio link to the free tracker and leave it there:**

```
https://treniko.com/free-personal-trainer-client-tracker?utm_source=instagram&utm_medium=social&utm_campaign=organic&utm_content=link-in-bio
```

Reasoning, in order of weight:

1. **It asks for nothing.** No account, no email, no card. A profile visitor
   who is not ready to sign up still leaves with something, and a trainer who
   downloads a client tracker has self-identified more precisely than any
   targeting could.
2. **The page sells honestly on its own.** It says what a spreadsheet cannot
   do and links onward to the product. That work is already done; the link just
   has to reach it.
3. **It is stable.** A bio link that changes weekly cannot build any
   recognition.

The homepage keeps `utm_content=page-cta` on the Facebook Page button, which is
already live. Do not change that one.

---

## 2. Where the existing scheduled slots should point

Cycle 2 has six "Story · Link · Website" slots with no destination chosen. They
have destinations now. **Nothing else in the calendar changes** — same dates,
same copy, same assets.

| Slot | Date | Send it to | Why that page |
|---|---|---|---|
| ST04 | Sun 20 Sep | `/guides/new-client-first-week` | The slot follows R02, "onboarding a new client, start to finish". Same subject, longer form |
| ST08 | Sat 26 Sep | `/free-personal-trainer-client-tracker` | Follows R04 on the week's schedule. Anyone who watched it is thinking about their own week |
| ST12 | Sat 3 Oct | `/guides/pricing-personal-training-packages` | C06 that week is *"price your packages so they're simple to explain"*. The guide is the argument in full |
| ST16 | — | `/guides/cancellation-policy` | Pair with any cancellation or no-show piece in the second half of the cycle |
| ST20 | — | `/guides/session-packages` | The closest page to the account's single most-repeated hook |
| Any Reel reshare | — | bio link | Do not put a different URL in a Story that reshares a Reel; it competes with the bio |

UTM form for every Story link — the convention in `UTM_CONVENTION.md`, unchanged:

```
?utm_source=instagram&utm_medium=social&utm_campaign=organic&utm_content=story-<id>
```

⚠️ Instagram rewrites outbound links through `l.instagram.com`, so
`referrer_host` will show that rather than Instagram proper. The UTM tags are
what actually attributes the visit — a Story link without them is recorded as
direct and the slot is wasted.

---

## 3. The free tracker has no social coverage. It should.

Six pieces, unscheduled, to be dropped into gaps rather than displacing anything.
**All copy is final and needs no rewriting.** Slide text is in the format
`_tooling/` already renders.

The rule these follow: **the post has to be useful to someone who never clicks.**
A post whose entire value is behind a link is an advertisement.

---

### T1 · Carousel ×5 · Pillar: Tips

**Hook (slide 1):** "The four columns that stop package arguments"

| Slide | Copy |
|---|---|
| 1 | The four columns that stop package arguments |
| 2 | **Sessions bought.** Typed once, when they buy. Never edited again |
| 3 | **Sessions used.** Updated when a session *happens* — not when it's booked |
| 4 | **Sessions remaining.** A formula. Never type in this column |
| 5 | **Package expires.** "Ten sessions" and "ten sessions within four months" are different products |

**Caption**

> Three of these are facts you already know. The fourth is the one that ends
> arguments.
>
> Sessions remaining should never be a number you type. The moment it is, it can
> disagree with the two numbers above it — and when it does, you and your client
> are both being honest and both have a different total.
>
> Make it subtract. That's it. That's the whole trick.
>
> Free template with the formula already in it — link in bio, no email needed.

---

### T2 · Single · Pillar: Pain

**On-image copy:** "How many sessions has she got left? Ten seconds. Go."

**Caption**

> If you had to check, that's not a memory problem. That's the number living in
> three places.
>
> Calendar knows what was booked. Your messages know what got moved. The
> spreadsheet knows what was paid. None of them know all three.
>
> Free tracker in bio if you want one place that does.

---

### T3 · Reel · Pillar: Product · ~15s

| Frame | On screen | Voice / caption |
|---|---|---|
| 1 | A row being typed: name, 10, 6 | "Ten bought. Six used." |
| 2 | The remaining cell filling in: **4** | "Four left. You didn't type that." |
| 3 | The 6 changing to 7 → remaining becomes 3 | "Update one number. The other one follows." |
| 4 | Text only: *Free. No email. Link in bio* | — |

**Caption**

> The only column in a client tracker that should never be typed by hand.
>
> Free spreadsheet, link in bio. Works in Excel and Google Sheets. No sign-up.

---

### T4 · Carousel ×4 · Pillar: Tips — the weekly check

| Slide | Copy |
|---|---|
| 1 | Ten minutes a week. Most of client retention |
| 2 | Anyone with **2 sessions or fewer left** — say something this week. Not during their last session |
| 3 | Anyone with an **outstanding payment** — one message. Not a mental note |
| 4 | Anyone who **hasn't trained in 3 weeks** and hasn't said why |

**Caption**

> Nobody loses a client in a week. They lose them over about six, and every one
> of those weeks had a signal in it.
>
> These three questions take ten minutes and they're the closest thing to a
> retention strategy that fits on a Sunday evening.
>
> The hard part isn't asking them. It's that answering them means opening three
> apps. Free template in bio has all three in one sheet.

---

### T5 · Single · Pillar: Relatable

**On-image copy:** "Spreadsheets are fine. Until the same fact lives in two of them."

**Caption**

> This isn't an anti-spreadsheet post. For a lot of trainers a sheet is genuinely
> the whole solution — it's free, it's yours, and nobody can change its pricing.
>
> It stops working at one specific point, and it isn't a client count: it's the
> first time the calendar and the sheet disagree about what happened, and you
> have to work out which one is lying.
>
> We wrote the honest version of that comparison, including where the sheet
> wins. Link in bio.

---

### T6 · Story · Poll

**Question:** "How do you track sessions left on a package?"
**Options:** `Spreadsheet` / `In my head`

Then a follow-up Story with the tracker link. This one is research as much as
distribution — the answer split tells you which half of the audience the product
is even for, and it costs one tap to find out.

---

## 4. Facebook

Same copy, no changes needed, with two adjustments:

- **Links go in the post body,** not in a bio. Facebook does not penalise
  outbound links the way the folklore claims, and the Page has one follower —
  there is no reach to protect yet.
- `utm_source=facebook`, everything else identical.

---

## 5. What this deliberately does not do

- **No new pain-point content.** 54 pieces already exist covering the same
  ground. Adding more before any of it has published would be writing instead of
  distributing.
- **No change to a scheduled post.** Fourteen are live in Instagram's scheduler.
  Nothing here touches them.
- **No urgency, scarcity or social proof.** There are no customer numbers to
  quote, so none are quoted. TRENIKO has two Instagram followers; every piece
  above works at that size because none of it depends on an audience existing.
- **No claim the tracker is better than the product.** It genuinely is not, and
  the page says so at the end rather than pretending the spreadsheet is enough
  forever.
