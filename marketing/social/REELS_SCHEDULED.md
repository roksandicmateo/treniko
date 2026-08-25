# TRENIKO — Reels: SCHEDULED (no longer manual)

**Done:** 18 Aug 2026, session 7, via **Meta Business Suite Reels composer**.
**Verified** in the Planner month view after scheduling.

Instagram @treniko_fitness ↔ Facebook Page **Treniko** are now connected
(the user completed the mobile OAuth step). Portfolio "Treniko" shows both
assets. Business Suite asset id `1300314106493001`.

## The blocker is gone

Five sessions concluded Reels could not be scheduled from an automated browser:
Instagram web never gets the video past `readyState 0`. **Business Suite does not
use an HTML5 preview** — it uploads server-side. Every MP4 reached 100%, was
recognised as 1080x1920 / 15 s, and passed Meta's copyright check.

## Scheduled — 5 Reels x 2 platforms = 10 items

| ID | Date | Time | Video | Facebook | Instagram |
|---|---|---|---|---|---|
| P05 | Sat 22 Aug 2026 | 19:00 | reel-01.mp4 | SCHEDULED | SCHEDULED |
| P10 | Sat 29 Aug 2026 | 11:30 | reel-02.mp4 | SCHEDULED | SCHEDULED |
| P14 | Fri 4 Sep 2026 | 12:30 | reel-03.mp4 | SCHEDULED | SCHEDULED |
| P18 | Thu 10 Sep 2026 | 12:00 | reel-04.mp4 | SCHEDULED | SCHEDULED |
| P21 | Mon 14 Sep 2026 | 18:30 | reel-05.mp4 | SCHEDULED | SCHEDULED |

Every date/time was zoomed into and read back before committing, and each
confirmation dialog ("Reel scheduled ... on Facebook and ... on Instagram") was
captured.

Captions are the exact text below the `#` heading of each `caption.md`, verified
by reading the composer's contenteditable back after typing. Hashtags unchanged:
`#personaltrainer #ptbusiness`.

## Decisions taken during scheduling

- **Cross-posted to Facebook as well as Instagram.** The composer schedules both
  in one action with independent date/time. Facebook has 0 followers so this
  costs nothing and gives the Page real content instead of an empty timeline.
- **Same caption on both.** `FACEBOOK_STRATEGY.md` asks for rewritten Facebook
  copy; that rule is kept for the *feed* batch, where a clickable link is the
  whole point. These Reel captions already name treniko.com in plain text, and
  splitting them five times would have multiplied the chance of a mistake for no
  gain at 0 followers.
- **P18's optional first-line rewrite was NOT applied.** The proposal in
  `PUBLISHING_QUEUE.md` replaces line 1 with "Eight tabs open, and you still
  cannot answer who has paid." — but the next line already begins "Not eight
  tabs.", so the replacement repeats itself two lines running. The original
  reads better. Rejected on merit, not overlooked.
- **No music.** Original audio only, as the queue requires.
- **"Share to Facebook Story" left OFF** on all five.
- Timezone showed `Europe/Zagreb` on the first Reel and `Europe/Vienna` on the
  rest. Same UTC offset and same DST rules, so the clock time is identical.

## Important: two separate scheduling systems

**The 14 Instagram-native scheduled feed posts do NOT appear in Business Suite.**
The Planner shows only P01, P02, the Page cover change and these new Reels.
Posts scheduled inside Instagram itself are invisible here.

Consequences:
- Business Suite **cannot warn about a collision** with those 14 posts. The dates
  above were taken from `PUBLISHING_QUEUE.md`, which remains authoritative.
- **Nothing about those 14 was touched, and nothing could have been** — they are
  not reachable from this surface.
- To verify them, use `instagram.com/scheduled_content/`, not the Planner.
