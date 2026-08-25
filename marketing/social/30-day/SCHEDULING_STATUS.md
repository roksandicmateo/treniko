# TRENIKO — Instagram scheduling status

> **STALE — SESSION 4 (18 Aug 2026).** P02 published on time on 18 Aug, so the
> scheduled count is now **14, not 15**. Everything else below was re-verified
> live on 18 Aug and is correct. Master list: `../PUBLISHING_QUEUE.md`.


Verify at **https://www.instagram.com/scheduled_content/**.
Account: **@treniko_fitness** — verified before every scheduling action.
Last updated: 18 Aug 2026, end of session 3 (Reels).

## Native scheduling capability (Instagram web)

| Format | Native scheduling on web? | Notes |
|---|---|---|
| Single image | ✅ Yes | Confirmed repeatedly |
| Carousel (multi-image) | ✅ Yes | Up to 7 slides confirmed |
| Reels (video) | ⚠️ Not determined | The composer **does** accept video (`accept` lists `video/mp4`, `video/quicktime`) and the upload begins, but the preview step never completes in the automated browser — see `REEL_PUBLISH_QUEUE.md`. Untested by hand |
| Stories | ❌ No | Create menu offers only Post / Live video / Ad. Mobile app only |

**Scheduling horizon:** the date picker greys out anything beyond roughly
**29 days ahead** (on 17 Aug the last selectable day was 15 Sep). P21 (14 Sep) is
inside that window; anything later must wait.

## Scheduled — verified in the Instagram interface (15)

| ID | Date | Time | Format | Slides | Verified |
|---|---|---|---|---|---|
| P02 | Tue 18 Aug 2026 | 11:30 | Carousel | 3 | ✅ |
| P03 | Thu 20 Aug 2026 | 18:30 | Carousel | 3 | ✅ |
| P04 | Fri 21 Aug 2026 | 12:00 | Carousel | 7 | ✅ |
| P06 | Mon 24 Aug 2026 | 11:00 | Carousel | 6 | ✅ |
| P07 | Tue 25 Aug 2026 | 18:00 | Single | 1 | ✅ |
| P08 | Thu 27 Aug 2026 | 12:00 | Carousel | 6 | ✅ |
| P09 | Fri 28 Aug 2026 | 18:30 | Single | 1 | ✅ |
| P11 | Mon 31 Aug 2026 | 19:00 | Carousel | 4 | ✅ session 2 |
| P12 | Tue 1 Sep 2026 | 11:00 | Carousel | 6 | ✅ session 2 |
| P13 | Thu 3 Sep 2026 | 18:00 | Single | 1 | ✅ session 2 |
| P15 | Sat 5 Sep 2026 | 18:30 | Carousel | 5 | ✅ session 2 |
| P16 | Mon 7 Sep 2026 | 11:30 | Single | 1 | ✅ session 2 |
| P17 | Tue 8 Sep 2026 | 19:00 | Carousel | 4 | ✅ session 2 |
| P19 | Fri 11 Sep 2026 | 18:00 | Single | 1 | ✅ session 2 |
| P20 | Sat 12 Sep 2026 | 11:00 | Carousel | 5 | ✅ session 2 |

**15 scheduled, every one seen on the weekly calendar** at
`instagram.com/scheduled_content/` with its thumbnail, caption preview and time
read back. Nothing was published — P01 (17 Aug) remains the only live post.

## Ready — designed and captioned, not yet scheduled

_(none — every designed feed post has been scheduled)_

## Manual publish required

Full instructions, file paths and per-Reel detail: **`REEL_PUBLISH_QUEUE.md`**
and **`STORY_PUBLISH_QUEUE.md`**.

| ID | Date | Time | Asset | Reason |
|---|---|---|---|---|
| P05 | Sat 22 Aug | 19:00 | `reels/reel-01/reel-01.mp4` | **Reel.** MP4 ready. Upload preview never completes in the automated browser |
| P10 | Sat 29 Aug | 11:30 | `reels/reel-02/reel-02.mp4` | **Reel.** Same |
| P14 | Fri 4 Sep | 12:30 | `reels/reel-03/reel-03.mp4` | **Reel.** Same |
| P18 | Thu 10 Sep | 12:00 | `reels/reel-04/reel-04.mp4` | **Reel.** Same |
| P21 | Mon 14 Sep | 18:30 | `reels/reel-05/reel-05.mp4` | **Reel.** Same |
| All Stories | see `STORY_PUBLISH_QUEUE.md` | — | 7 assets | Instagram web cannot create Stories at all |

## Not started

_(nothing. All 15 static feed pieces are scheduled and verified; all 5 Reels are
finished MP4s awaiting manual publish; all 7 Stories are finished assets awaiting
manual publish.)_

## Known UI quirks (cost real time — read before scheduling)

1. Enter the flow from the **"Schedule content"** button on
   `scheduled_content/`, not Create → Post. It opens the composer with the
   **Schedule toggle already on** and the button already reading **Schedule**.
2. **Always set the crop to 4:5.** Default is 1:1 and it decapitates the
   wordmark. Crop icon bottom-left of the preview → `4:5`.
3. The **Next** button moves horizontally as the modal re-lays-out between
   steps. Screenshot and read its position before every click — a hardcoded
   x once hit the ✕ and raised "Discard post?" (Cancel saved it).
4. The caption box is a **contenteditable**, not a textarea — `form_input`
   fails. Click by ref, then `computer: type`.
5. A **hashtag autocomplete dropdown** covers the Schedule toggle. Dismiss it by
   clicking the "Create new post" title.
6. Time is a native `<input type="time">` that **ignores typed digits**. Get the
   Hours/Minutes spinbutton refs via `find`, click, drive with ArrowUp/Down and
   `repeat`. Read the current value first — it defaults to *now*.
7. **Always zoom on the Date + Time block and read it back** before Schedule.
8. The calendar **does not refresh in place** after scheduling. A newly
   scheduled post shows as an empty cell until the page is **hard reloaded**.
   This is not a failure — reload before concluding anything is missing.
9. Clicking "Schedule content" twice in one batch opens then closes the modal.
   Click once, wait ~7 s, then `find` the file input.
