# TRENIKO — Reel publish queue

> **CURRENT — re-verified in session 4 (18 Aug 2026).** All five MP4s were
> re-probed and fully decoded: zero errors. The web-scheduling limitation was
> independently reproduced. Master queue: `../PUBLISHING_QUEUE.md`.


**All five Reels are finished MP4s. All five are MANUAL PUBLISH.**
Post them from the **Instagram mobile app**, signed in as **@treniko_fitness**.

Why manual: see *Why web scheduling did not work* at the bottom. It is a
limitation of the automated browser, not of the Reels and not of Instagram.

---

## The queue

| ID | Post on | Time (Europe/Zagreb) | MP4 | Caption | Cover |
|---|---|---|---|---|---|
| **P05** | **Sat 22 Aug 2026** | **19:00** | `reels/reel-01/reel-01.mp4` | `reels/reel-01/caption.md` | `reels/reel-01/cover.png` |
| **P10** | **Sat 29 Aug 2026** | **11:30** | `reels/reel-02/reel-02.mp4` | `reels/reel-02/caption.md` | `reels/reel-02/cover.png` |
| **P14** | **Fri 4 Sep 2026** | **12:30** | `reels/reel-03/reel-03.mp4` | `reels/reel-03/caption.md` | `reels/reel-03/cover.png` |
| **P18** | **Thu 10 Sep 2026** | **12:00** | `reels/reel-04/reel-04.mp4` | `reels/reel-04/caption.md` | `reels/reel-04/cover.png` |
| **P21** | **Mon 14 Sep 2026** | **18:30** | `reels/reel-05/reel-05.mp4` | `reels/reel-05/caption.md` | `reels/reel-05/cover.png` |

Every file: **1080 x 1920**, 9:16, **14.9 s**, H.264 High / yuv420p, 30 fps,
silent AAC track, ~1.5 MB, `+faststart`. All decode without a single error.

---

## How to post one — under a minute

1. Get the MP4 onto the phone. Easiest route: from this machine, share
   `reel-0N.mp4` to yourself (AirDrop, Drive, WhatsApp to self, email) and save
   it to the camera roll. Do all five in one go and the rest takes seconds.
2. Instagram app → **+** → **Reel** → pick the video from the camera roll.
3. **Do not trim it.** It is already 14.9 s and already 9:16 — Instagram will
   offer to adjust; decline. **Next.**
4. **Cover:** tap *Cover* → *Add from camera roll* → pick `cover.png` (that is
   the opening hook frame). If you skip this, the auto-cover is the same frame
   anyway, so it is optional.
5. **Caption:** open `caption.md`, copy everything **below the `#` heading
   line** (the heading is a note to us, not part of the post), paste it in.
6. Leave audio alone. There is no music, and the Reel is written to be read in
   silence — if you want a licensed Instagram track, pick one deliberately.
7. **Share.**

The dates and times above are the plan, not a constraint — a Reel posted an hour
either side of its slot is fine. What matters is that it does not clash with the
static feed post scheduled the same day.

---

## What is inside these Reels

Each one runs hook → pain → three real product shots → CTA:

| Reel | ID | Hook | Product section shows |
|---|---|---|---|
| 01 | P05 | "Still running your PT business from WhatsApp and spreadsheets?" | client list → one client → sessions and package |
| 02 | P10 | "Your client just asked how many sessions they have left." | client → *2 sessions left* → the package alert on the dashboard |
| 03 | P14 | "POV: one reschedule means updating three apps." | week calendar → three days → today's sessions |
| 04 | P18 | "What running a PT business should actually look like." | stat tiles → the week → paid / pending / total |
| 05 | P21 | "You are not disorganised. Your tools are." | today's sessions → billing → stat tiles |

The product frames are **screenshots of the running application**, not mock-ups.
They come from a synthetic demo tenant: placeholder client names reduced to a
surname initial (Alex M., Jordan T., Sam K., Riley P., Casey B.), reserved
`@example.com` addresses, no phone numbers, no health notes, invented amounts.
No browser chrome, URL bar, localhost address or operating-system window appears
in any frame.

---

## Why web scheduling did not work

Instagram's **Schedule content** flow does accept video — its file input
advertises `video/mp4` and `video/quicktime`, and the upload starts. It then
stalls forever on the preview step.

The cause is the automated browser, not the file. Instagram builds the upload
preview by loading the video into an HTML `<video>` element. In this browser
session that element never leaves `readyState 0` — and it does so for **every**
video, including a VP9/WebM control file and a plain-`main`-profile H.264
re-encode, served both as a blob and over plain HTTP. Video decoding is simply
not available to the page here. The MP4s themselves are sound: `ffmpeg` decodes
all five end to end with zero errors.

So the honest state is:

- **Not proven:** that Instagram web can schedule a Reel.
- **Not proven:** that it cannot.
- **Proven:** it cannot be driven from this automated browser.

If you want to try it yourself in an ordinary Chrome window, the flow is
`instagram.com/scheduled_content/` → **Schedule content** → drop the MP4 in. If
the preview renders, the rest is the same as the static posts. If it stalls the
same way, publish from the phone and stop paying attention to it — Reels are a
mobile-first format and the app path is more reliable regardless.

Nothing was scheduled, cancelled, duplicated or altered during the attempt. The
15 scheduled static posts were re-checked afterwards and are untouched.

---

## Rebuilding

Both steps are deterministic — same inputs, same bytes out:

```bash
node marketing/social/30-day/_tooling/reel-frames.js   # hook / pain / CTA frames
node marketing/social/30-day/_tooling/reel-cards.js    # the three product cards
bash marketing/social/30-day/_tooling/build-reels.sh   # all five MP4s
```

`build-reels.sh` needs `ffmpeg` on PATH (installed user-scoped via
`winget install Gyan.FFmpeg`; it is **not** a project dependency and no binary is
committed). `reel-cards.js` reads the raw captures from a scratch directory — if
they are gone, re-capture them from the app before re-running it.
