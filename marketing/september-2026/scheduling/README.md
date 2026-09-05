# Scheduling — September 2026 (15–30 Sep)

**Status: NOTHING IN THIS FOLDER HAS BEEN SCHEDULED OR PUBLISHED.**

Everything is built, captioned and timed. Not one item was placed on a platform
during this sprint, for one reason:

> **The Claude browser extension was not connected.** `tabs_context_mcp` returned
> *"Browser extension is not connected"* on every attempt. Instagram scheduling
> and Meta Business Suite are both browser-only for this setup — there is no API
> path in use here — so no post could be scheduled, and, just as importantly, no
> already-scheduled post could be **verified**.

Nothing was faked and nothing was recorded as scheduled that is not. The
manifest is `schedule-manifest.csv`; every new row says READY or MANUAL.

The Canva connector *was* available and was used for one thing only: a folder,
`TRENIKO — September 2026 social`
(<https://www.canva.com/folder/FAHUT59ACno>), to hold the assets once they are
uploaded from disk. Canva's MCP can only ingest images from **public** URLs, and
these assets are not published anywhere public, so nothing was uploaded. Upload
them by hand from `marketing/september-2026/` if you want them editable in Canva.

---

## What to do, in order

### 0. Verify the first half of the month first (5 minutes)

The 5–14 Sep posts were scheduled in August and last read back on **24 August**.
Before adding anything new, confirm they are still there:

1. <https://www.instagram.com/scheduled_content/> — confirm P15, P16, P17, P19,
   P20 with their dates and times. **Hard-reload**; the calendar does not refresh
   in place.
2. Business Suite Planner → confirm the P18 (10 Sep) and P21 (14 Sep) Reels and
   the Facebook feed posts on 5, 8 and 12 Sep.

If something has drifted, fix that before scheduling anything from this sprint.

### 1. Instagram feed — schedule natively inside Instagram

Eight posts: F01, F02, F03, F04, F05, F06, F07, F08.

Instagram's own scheduler reaches about **29 days ahead**, so on 5 September the
whole window to 30 September is inside it. Do the eight in one sitting.

Per post:

1. Start from the **"Schedule content"** button on
   `instagram.com/scheduled_content/` — not Create → Post. It opens the composer
   with the Schedule toggle already on.
2. Upload `feed/<slug>/slide-1.png` … in slide order.
3. **Set the crop to 4:5.** The default is 1:1 and it decapitates the wordmark.
4. Paste the **CAPTION — Instagram** section from the matching file in
   `../captions/`. The caption box is a `contenteditable`, so type into it; a
   form-fill will not register.
5. Dismiss the hashtag autocomplete by clicking the "Create new post" title — it
   covers the Schedule toggle.
6. Set date and time from the manifest. The time field is a native
   `<input type="time">` that ignores typed digits: drive the hour and minute
   spinners with arrow keys, and **read the value back** — it defaults to *now*.
7. Zoom in on the date + time block and read it back before pressing Schedule.
8. Hard-reload the calendar to confirm it appears. A newly scheduled post shows
   as an empty cell until you do.
9. **Hashtags go in the first comment**, not the caption. Instagram cannot
   schedule a first comment, so keep `../captions/` open on publish day, or paste
   the hashtag line into the caption's last line if you would rather not babysit
   it.

### 2. Facebook feed — schedule in Meta Business Suite

Same eight posts, the **CAPTION — Facebook** section, assets from
`feed/_facebook/<slug>/`, times from the manifest (30–60 minutes after the
Instagram slot).

> ⚠️ **Wrong-account hazard, and it has nearly fired before.** This Meta account
> holds six unrelated Pages, and a deep link to the Planner has silently
> redirected to *FC Barcelona Fans* with a composer pointed at it. **Confirm the
> asset selector reads `Treniko, treniko_fitness` before typing anything.**

### 3. Stories — split by sticker

| Sequence | How |
|---|---|
| S02, S05, S06, S10 | **Schedulable** in Business Suite → Create story → Share to Instagram → media → *Add link* per card → Schedule |
| S01, S03, S04, S07, S08, S09 | **Phone only.** Business Suite's Story composer has no poll, question or slider sticker, and the answers are the whole point |

Sticker text for every sequence is in `../captions/STORIES-2026-09.md`.

### 4. Record what actually happened

After scheduling, change the STATUS column in `schedule-manifest.csv` from READY
to `SCHEDULED <date read back off the platform>`. Do not mark anything scheduled
that you did not read back off the platform's own calendar.

---

## Known platform quirks, learned the expensive way

1. Instagram's scheduled-content calendar **does not refresh in place**. Hard
   reload before concluding anything is missing.
2. The **Next** button moves horizontally as the composer re-lays out between
   steps. Screenshot before every click; a hardcoded position once hit the ✕.
3. Clicking "Schedule content" twice in one batch opens then closes the modal.
   Click once, wait ~7 seconds.
4. Business Suite showed the timezone as `Europe/Zagreb` on one item and
   `Europe/Vienna` on others. Same offset, same DST — the clock time is identical.
5. Posts scheduled **inside Instagram do not appear in Business Suite** and vice
   versa. Two systems, two calendars; check both.
6. Instagram web's Reel scheduling could not be driven from an automated browser
   (the preview never leaves `readyState 0`). Business Suite uploads server-side
   and works. Not relevant to this sprint — there are no new Reels — but do not
   spend another session rediscovering it.
