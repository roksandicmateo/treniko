# TRENIKO — September 2026 social campaign

Everything for **15–30 September 2026** on Instagram and Facebook: assets, copy,
screenshots, templates and the scheduling manifest. The first half of the month
(5–14 Sep) was built and scheduled in August and lives in
`../social/30-day/`; nothing here touches it.

Calendar for the whole window: **`../september-2026-content-calendar.md`**
Final report: **`SEPTEMBER_MARKETING_COMPLETE.md`**

---

## Layout

```
september-2026/
  feed/          8 Instagram feed pieces, 1080 × 1350, one folder per post
    _facebook/   the same 8, exported at 1200 × 1500
  stories/       10 Story sequences, 1080 × 1920, 21 frames
  screenshots/   full-screen product captures (desktop + phone)
    crops/       single cards, used as the product images in the assets
  templates/     7 specimens of the reusable layouts
  captions/      one file per post: hook, Instagram copy, Facebook copy, CTA,
                 hashtags, visual notes
  scheduling/    schedule-manifest.csv + step-by-step scheduling instructions
  _tooling/      the scripts that produced all of the above
```

Filenames carry the publish date: `2026-09-15-problem-six-places/slide-1.png`.

## The screenshots are real

Every product image in every asset is a region of an actual capture of the
running TRENIKO application. Nothing is drawn, mocked up or retouched, and no
asset shows a feature that does not exist.

They come from a **synthetic demo tenant on the local development server**,
created for this purpose by `_tooling/seed-marketing-demo*.js`:

* Trainer **Alex Morgan**, business "Morgan Performance" — fictional.
* Clients **James Carter, Emma Wilson, Daniel Brooks, Sophie Taylor, Olivia
  Bennett, Marcus Reid** — fictional, with reserved `@example.com` addresses, no
  phone numbers, no dates of birth, no injuries and no health notes.
* Invented prices, payments and package counts.
* **Production was never read or written.** No real trainer's or client's data is
  in any file here.

The captures are page captures at 1440 × 900 (×2) and 390 × 844 (×3–4): no
browser chrome, no address bar, no `localhost`, no operating-system window, no
developer tooling, no Croatian strings — the language is forced to English and
the theme to light before the first paint.

## Rebuilding any of it

`sharp` and `puppeteer-core` are deliberately **not** project dependencies —
nothing in the app or its build imports them. Install them outside the repo and
point Node at them:

```bash
# once, in a scratch directory outside the repo
npm i --no-save sharp puppeteer-core

# then, from the repo root, with NODE_PATH pointing at that node_modules
node marketing/september-2026/_tooling/seed-marketing-demo.js    # demo tenant
node marketing/september-2026/_tooling/seed-marketing-demo-2.js  # packages, payments, workouts
node marketing/september-2026/_tooling/seed-marketing-demo-3.js  # session counts, body metrics
node marketing/september-2026/_tooling/capture.js                # full screens
node marketing/september-2026/_tooling/crops.js                  # single cards
node marketing/september-2026/_tooling/feed.js                   # 8 feed posts + Facebook exports
node marketing/september-2026/_tooling/stories.js                # 10 Story sequences
node marketing/september-2026/_tooling/templates.js              # template specimens
```

The seeds and captures talk to `http://localhost:3000` / `:5173` and refuse to
run against anything else. Start the local stack first (`backend: node server.js`,
`frontend: npm run dev`).

## Design system

Inherited from `../BRAND_VISUAL_GUIDE.md` and the cycle-1 renderer in
`../social/30-day/_tooling/`, extended here with two templates the campaign
needed: a product card built around a real screenshot, and a Story frame in the
same type system.

* Brand blue `#0ea5e9`; tint `#f0f9ff`; ink `#111827`; dark ground `#0b1220`
* Wordmark `TRENIKO` top-left, always uppercase, letterspaced
* Headline: Arial Black, hand-broken lines, sentence case, no exclamation marks
* One `#0ea5e9` rule under the headline; support copy 36–42 px regular
* Product captures sit on a white plate with a hairline border and 34 px radius
* The renderer **refuses** to draw a line that would reach the margin — a
  clipped word fails the build instead of shipping

Specimens of all seven layouts: `templates/`. To rebuild them in Canva or Figma,
copy the sizes above; there is a Canva folder waiting at
<https://www.canva.com/folder/FAHUT59ACno>.
