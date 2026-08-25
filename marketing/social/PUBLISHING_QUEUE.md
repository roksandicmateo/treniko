# TRENIKO — master publishing queue

**Written:** 18 Aug 2026, session 4 · timezone **Europe/Zagreb**
**Account:** @treniko_fitness — check the handle before every action.

Everything in this file is **manual publishing from the Instagram mobile app**.
The 14 remaining feed posts are already scheduled inside Instagram and need
nothing from you — they are listed at the bottom only so you can confirm nothing
has drifted.

Nothing in this file has been published or scheduled by an automated session.
Every row says READY, and READY means *not yet on Instagram*.

---

## Why these are manual — established twice, do not retest

**Reels.** Instagram's *Schedule content* composer does accept video (its file
input advertises `video/mp4` and `video/quicktime`) and the upload begins. It
then stalls forever on the preview step, because Instagram builds that preview
by loading the video into an HTML `<video>` element.

Session 4 re-tested this directly and independently: a video the browser
**generated itself** in-page, via canvas → MediaRecorder → blob, never left
`readyState 0` — it timed out after 8 s with no error code at all. The MP4s are
sound; ffmpeg decodes all five end to end with zero errors. Video decoding is
simply not available to the page in this automated browser.

> **Not proven** that Instagram web can schedule a Reel.
> **Not proven** that it cannot.
> **Proven** that it cannot be driven from an automated browser session.

Do not spend a third session retrying it. Publishing from the phone works.

### Meta Business Suite — UPDATED session 6, 18 Aug 2026

> **The session-5 finding below is now out of date.** A TRENIKO Facebook Page
> exists. Business Suite can schedule **Facebook** content today; **Instagram is
> still blocked**, on one remaining step. Full detail: `SOCIAL_AUDIT.md`.

| | |
|---|---|
| Facebook Page **Treniko** | ✅ created, branded, CTA set — `facebook.com/profile.php?id=61593112186107` |
| Business Suite sees it | ✅ asset id `1300314106493001` |
| Schedule **Facebook** posts / Reels / Stories in Planner | ✅ **works now** — verified |
| Instagram ↔ Page connection | ❌ **NOT DONE** — the desktop OAuth popup is unreachable from an automated browser |
| Schedule **Instagram** anything | ❌ blocked on the line above |

**So the Reel bottleneck is not fixed yet, and the five Reels below are still
manual.** The fix is one two-minute action in the Instagram mobile app —
`MANUAL_QUEUE.md` § M1. Once it is done, P14, P18 and P21 can be scheduled in
Business Suite instead of published by hand.

> ⚠️ **Wrong-account hazard — still live, read before connecting anything.**
> The "Connect Instagram" button also sits on *FC Barcelona Fans*, *La Liga*,
> *Manchester United Balkan Fans*, *Lighters Hrvatska*, *Zdrava Navada* and
> *Zašto je Bog stvorio Real?*. Linking @treniko_fitness to one of those would
> put TRENIKO Reels and Stories in a football fan page's publishing queue.
> **Connect only to the Page named `Treniko`, and verify the handle reads
> `treniko_fitness` before scheduling anything.**

<details>
<summary>Superseded session-5 finding, kept as history</summary>

Business Suite was inspected on 18 Aug and could not manage @treniko_fitness.
It held 6 business assets, all Facebook Pages, none of them TRENIKO; the asset
search for `treniko` returned "No results"; and every Page showed a "Connect
Instagram" prompt, which is the mechanism — Business Suite reaches an Instagram
Business account *through a linked Facebook Page*. No TRENIKO Page existed, so
there was nothing to link. Nothing was connected, created or published during
that investigation.

</details>

**Stories.** Instagram web has no Story creation at all — the Create menu offers
only Post / Live video / Ad. There is nothing to retry.

---

## 1. Reels — 5 ready

All five: **1080 × 1920**, 9:16, **14.9 s**, H.264 High / yuv420p, 30 fps, 447
frames, silent AAC track, `+faststart`, ~1.4–1.6 MB. Re-verified in session 4 —
`ffprobe` metadata plus a **full decode of every file: zero errors**.

| ID | Post on | Time | MP4 | Caption | Cover |
|---|---|---|---|---|---|
| **P05** | **Sat 22 Aug 2026** | **19:00** | `30-day/reels/reel-01/reel-01.mp4` | `reel-01/caption.md` | `reel-01/cover.png` |
| **P10** | **Sat 29 Aug 2026** | **11:30** | `30-day/reels/reel-02/reel-02.mp4` | `reel-02/caption.md` | `reel-02/cover.png` |
| **P14** | **Fri 4 Sep 2026** | **12:30** | `30-day/reels/reel-03/reel-03.mp4` | `reel-03/caption.md` | `reel-03/cover.png` |
| **P18** | **Thu 10 Sep 2026** | **12:00** | `30-day/reels/reel-04/reel-04.mp4` | `reel-04/caption.md` | `reel-04/cover.png` |
| **P21** | **Mon 14 Sep 2026** | **18:30** | `30-day/reels/reel-05/reel-05.mp4` | `reel-05/caption.md` | `reel-05/cover.png` |

**Hashtags (all five, already in the caption files):** `#personaltrainer #ptbusiness`
Two, deliberately. Hashtag stuffing is on the *Never* list in `STRATEGY.md`.

### Exact steps — per Reel, under a minute

1. **Get the MP4 onto the phone.** Do all five in one go: send `reel-01.mp4` …
   `reel-05.mp4` to yourself (Drive, WhatsApp to self, email) and save each to
   the camera roll.
2. Instagram app → **+** → **Reel** → pick the video from the camera roll.
3. **Do not trim.** It is already 14.9 s and already 9:16. Instagram will offer
   to adjust — decline. **Next.**
4. **Cover:** tap *Cover* → *Add from camera roll* → pick `cover.png`. Optional —
   the auto-cover is the same opening frame — but it is cleaner with it.
5. **Caption:** open the matching `caption.md`, copy everything **below the `#`
   heading line** (the heading is an internal note, not part of the post), paste.
6. **Leave audio alone.** There is no music and the Reel is written to be read in
   silence. If you want a licensed Instagram track, choose it deliberately —
   never import audio from anywhere else.
7. **Share.**

A Reel posted an hour either side of its slot is fine. What matters is that it
does not collide with the feed post scheduled the same day.

### One optional change worth considering

**P18's caption first line** currently repeats the on-screen text and is the
weakest hook of the five (6.8/10 — see the scoring in
`CONTENT_CALENDAR_30_DAYS.md`). Replacing only the first line, using a claim
already in the caption body:

> ~~What running a PT business should actually look like.~~
> **Eight tabs open, and you still cannot answer who has paid.**

The video is unchanged. Do it at post time or not at all — the caption file has
been left as-is.

---

## 2. Stories — 14 slots, 11 assets

Every asset is 1080 × 1920 with text clear of the bottom 250 px.

**Three of the fourteen are reshares of your own feed post or Reel** and need no
asset of their own beyond the lead-in card.

| # | Post on | Daypart | Asset | Type | Sticker / action | Ties to |
|---|---|---|---|---|---|---|
| S1 | Tue 18 Aug | after 11:30 | `stories/week-1/story-1-poll.png` | **Poll** | Q: "Where do you track your clients?" · **Spreadsheet** / **Notes or messages** | P02 |
| S2 | Thu 20 Aug | after 18:30 | `stories/week-1/story-2-poll.png` | **Poll** | Q: "What admin task do you hate most?" · **Scheduling** / **Payments** / **Sessions** / **Progress** | P03 |
| S5 | week 1, any day | any | `stories/highlights-product/story-1-what.png` | Highlight seed | none | → PRODUCT highlight |
| S6 | week 1, any day | any | `stories/highlights-product/story-2-who.png` | Highlight seed | none | → PRODUCT highlight |
| S7 | week 1, any day | any | `stories/highlights-product/story-3-benefit.png` | Highlight seed | none | → PRODUCT highlight |
| S3 | Tue 25 Aug | after 18:00 | `stories/week-2/story-3-question.png` | **Question box** | "What would save you the most time every week?" | P07 |
| S4 | Fri 28 Aug | after 18:30 | `stories/week-2/story-4-reshare.png` | Lead-in + reshare | **Link sticker** → `utm_content=story-wk2` | P09 |
| **S8** | **Mon 31 Aug** | after 19:00 | `stories/week-3/story-5-poll.png` | **Poll** | Q: "How do you confirm tomorrow's session?" · **A message** / **Calendar invite** / **They just know** | P11 |
| **S9** | **Wed 2 Sep** | midday | `stories/week-3/story-6-question.png` | **Question box** | "Which admin job would you hand over tomorrow?" | standalone research |
| **S10** | **Sat 5 Sep** | after 18:30 | `stories/week-3/story-7-reshare.png` | Lead-in + reshare | **Link sticker** → `utm_content=story-wk3` | P15 |
| **S11** | **Tue 8 Sep** | after 19:00 | `stories/week-4/story-8-poll.png` | **Poll** | Q: "How do you know who has paid?" · **A spreadsheet** / **The bank app** / **Memory** | P17 |
| **S12** | **Thu 10 Sep** | after 12:00 | `stories/week-4/story-9-reshare.png` | Lead-in + Reel reshare | **Link sticker** → `utm_content=story-wk4` | P18 |
| **S13** | **Fri 11 Sep** | after 18:00 | `stories/week-4/story-10-question.png` | **Question box** | "What would you automate first?" | P19 |
| **S14** | **Mon 14 Sep** | after 18:30 | `stories/week-5/story-11-recap.png` | Recap + link | **Link sticker** → `utm_content=story-wk5` | P21 |

Bold rows are new in session 4. S8–S14 exist because weeks 3–5 previously had no
Story support at all while five feed posts and two Reels went out.

### Exact steps — per Story, about 20 seconds

1. Instagram app → **+** → **Story** → pick the PNG from the camera roll.
2. **If the row says Poll or Question, add the real interactive sticker on top
   and type the exact text from the table.** The options drawn on the image are a
   **visual guide only** — without the real sticker nobody can answer, and the
   answers are the entire point of the Story.
3. If the row says **Link sticker**, add it with the tagged URL below.
4. Share to Story.

### Link-sticker URLs — copy exactly

Link stickers hide the URL, so the UTM length costs nothing.

```
week 2  https://treniko.com/?utm_source=instagram&utm_medium=social&utm_campaign=organic&utm_content=story-wk2
week 3  https://treniko.com/?utm_source=instagram&utm_medium=social&utm_campaign=organic&utm_content=story-wk3
week 4  https://treniko.com/?utm_source=instagram&utm_medium=social&utm_campaign=organic&utm_content=story-wk4
week 5  https://treniko.com/?utm_source=instagram&utm_medium=social&utm_campaign=organic&utm_content=story-wk5
```

⚠️ These only produce attribution once something on `treniko.com` actually reads
UTM parameters. **Nothing does yet** — see `ANALYTICS_PLAN.md`. Tag them anyway:
the click still lands, and the data starts existing the day analytics goes in.

### Story rules

- Two to four Story sequences a week. **Do not post daily just to have something up.**
- Poll and question-box answers are **customer research** — log them the same
  week in `30-day/METRICS_TEMPLATE.md`.
- Never fabricate a response. Never screenshot a reply that identifies someone
  without their written permission.

---

## 3. Highlights — after the Stories are up

A highlight can only be built from a Story that has actually been posted, and
Stories cannot be posted from the web. All of this is mobile-app work.

| Highlight | Create when | Stories in it | Ready? |
|---|---|---|---|
| **PRODUCT** | as soon as S5–S7 are posted | the three `highlights-product/` cards | **Yes — now** |
| **FOR TRAINERS** | as soon as the three `highlights-trainers/` cards are posted | who it is for · who it is **not** for · the first week | **Yes — new in session 4** |
| **FEATURES** | from 24 Aug | Story reshares of P06, P11, P17 once live | from 24 Aug |
| **UPDATES** | only when there is a real release to announce | — | Nothing to announce |
| **FAQ** | only after real questions have been asked | answers from S3, S9, S13 and the P07/P19 comments | Not yet |

`RESULTS` deliberately does not exist and must not be created until real,
attributable customer proof exists in writing.

**Do not create an empty or filler highlight.** One weak Story in a highlight is
worse than no highlight.

Titles (15 characters max): `PRODUCT` · `FOR TRAINERS` · `FEATURES` · `UPDATES` · `FAQ`

---

## 4. Already scheduled inside Instagram — do not touch

Verified live on `instagram.com/scheduled_content/` on 18 Aug 2026 (session 4),
read back off both the August and September monthly views. **14 items, every one
matching its planned date and time.** Nothing was added, changed, cancelled or
duplicated.

| ID | Date | Time | Format |
|---|---|---|---|
| P03 | Thu 20 Aug | 18:30 | Carousel ×3 |
| P04 | Fri 21 Aug | 12:00 | Carousel ×7 |
| P06 | Mon 24 Aug | 11:00 | Carousel ×6 |
| P07 | Tue 25 Aug | 18:00 | Single |
| P08 | Thu 27 Aug | 12:00 | Carousel ×6 |
| P09 | Fri 28 Aug | 18:30 | Single |
| P11 | Mon 31 Aug | 19:00 | Carousel ×4 |
| P12 | Tue 1 Sep | 11:00 | Carousel ×6 |
| P13 | Thu 3 Sep | 18:00 | Single |
| P15 | Sat 5 Sep | 18:30 | Carousel ×5 |
| P16 | Mon 7 Sep | 11:30 | Single |
| P17 | Tue 8 Sep | 19:00 | Carousel ×4 |
| P19 | Fri 11 Sep | 18:00 | Single |
| P20 | Sat 12 Sep | 11:00 | Carousel ×5 |

P02 left this list on 18 Aug by publishing on time, exactly as scheduled —
[/p/DcLS6GJDP8u/](https://instagram.com/p/DcLS6GJDP8u/).

---

## 5. Instagram web UI quirks — read before any web scheduling

These cost real time to discover. They apply to the **static feed** flow only.

1. Enter from the **"Schedule content"** button on `scheduled_content/`, not
   Create → Post. It opens the composer with the Schedule toggle already on.
2. **Always set the crop to 4:5.** Default is 1:1 and it decapitates the
   wordmark. Crop icon bottom-left → `4:5`.
3. The **Next** button moves horizontally between steps. Screenshot and read its
   position before every click — a hardcoded x once hit ✕ and raised "Discard
   post?".
4. The caption box is a **contenteditable**, not a textarea — `form_input`
   fails. Click by ref, then type.
5. A **hashtag autocomplete dropdown** covers the Schedule toggle. Dismiss it by
   clicking the "Create new post" title.
6. Time is a native `<input type="time">` that **ignores typed digits**. Get the
   Hours/Minutes spinbutton refs, click, drive with ArrowUp/Down. It defaults to
   *now* — read the current value first.
7. **Always zoom on the Date + Time block and read it back** before Schedule.
8. The calendar **does not refresh in place**. A newly scheduled post shows as an
   empty cell until a **hard reload**. That is not a failure.
9. Clicking "Schedule content" twice in one batch opens then closes the modal.
   Click once, wait ~7 s, then find the file input.
10. **Scheduling horizon is roughly 29 days.** On 18 Aug the furthest selectable
    date was around 16 Sep. Cycle 2 cannot be scheduled until early September.
