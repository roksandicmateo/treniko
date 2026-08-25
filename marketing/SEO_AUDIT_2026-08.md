# TRENIKO — technical SEO audit

**Audited:** 25 Aug 2026, against live production · **Cost: €0** · No paid tool used.

Everything below was measured against `https://treniko.com`, not read off the
repository. Where something could not be measured for free it says so instead of
guessing.

**Two things this audit cannot tell you**, and no amount of work on this side
will change that until Search Console exists:

- **Whether Google has indexed anything.** Not one URL's index status is known.
- **What anyone searches to find TRENIKO.** There is no query data.

Ten minutes of your time fixes both — `MANUAL_QUEUE.md` U1.

---

## 1. Result

| Area | State |
|---|---|
| Crawlability, raw HTML | ✅ **Pass** — every indexable URL carries its content in the response body |
| Titles, descriptions, canonicals | ✅ Pass — all unique, all within length, all self-referential |
| Structured data | ✅ Pass — 14/14 blocks parse, no fabricated ratings |
| Robots / sitemap coherence | ✅ Pass — fixed this session, was contradictory |
| Internal linking, orphans | ✅ Pass — zero orphans |
| Redirects, www/apex, HTTPS | ✅ Pass |
| Soft 404s | ⚠️ **Partial** — unknown paths are `noindex` but still answer 200 |
| Security headers | ✅ **Fixed this session** — there were none |
| Performance | ✅ Pass on what is measurable — see § 8 |
| Images / alt text | ➖ **N/A** — there are no images on any content page. See § 9 |
| hreflang | ➖ Not applicable — see § 10 |
| Index coverage | ❓ **Unknown** — needs Search Console |

Automated: `npm run check:seo` (11 pages, gates the build) and
`npm run check:headers` (live origin). Both pass.

---

## 2. What was actually broken, and is now fixed

Four real defects, all found by measuring rather than by reading.

### 2.1 No security headers on anything a person loads

Production sent no HSTS, no `X-Content-Type-Options`, no `Referrer-Policy`, no
frame protection and no CSP on any HTML or asset response. The API was never in
this state — Express has run behind helmet throughout — but every page a visitor
opens was bare.

All six are now sent, with a CSP whose `script-src` is `'self'` and nothing else:
no hashes, no nonces, no `'unsafe-inline'`. That was only possible because the
page-view beacon was moved out of the HTML into a file first.

Deployed as Report-Only, checked across 15 routes in a browser, then enforced.
Verified genuinely enforcing rather than merely present: a cross-origin `fetch`
is now blocked while the same-origin API call still completes.

**One weak directive, stated plainly:** `style-src` keeps `'unsafe-inline'`.
React writes inline `style` attributes and a static build has no request-time
step in which to mint a nonce. Removing it needs either nonce injection at
request time or the elimination of every inline style in the app.

### 2.2 The homepage had no `Cache-Control` at all

`location = /index.html` sets `no-cache, must-revalidate` and never ran for `/`,
because `try_files` serves a matched file inside the current location without a
second location lookup. So `/` went out with no caching directive and picked up
whatever heuristic the browser and Cloudflare chose.

index.html names the content-hashed bundles. A stale copy points at asset files
the next deploy has already deleted, and the visitor gets a blank page with a
404 in the console until they hard-refresh. Fixed in `location /`.

### 2.3 `/privacy` and `/terms` were in the sitemap and marked `noindex`

Both were being served the SPA shell, which since the soft-404 fix carries
`noindex, nofollow`, no canonical, and the homepage's title — while `sitemap.xml`
lists both as pages to index. RouteMeta corrected it at runtime, so Google saw
the right values and every non-rendering crawler saw the wrong ones.

The build now writes a real head for each, from the same `PUBLIC_ROUTES` table
RouteMeta uses, so the two cannot drift. `#root` stays empty on purpose: both
pages are `lazy()` behind Suspense, so prerendering their bodies would hydrate a
loading state onto a full document.

`/terms` also had a 38-character description, well under the point where Google
writes its own. Now 149.

### 2.4 A stylesheet deploy was invisible for four hours

`content.css` was an unhashed filename and Cloudflare applied a four-hour
extension-based TTL. Caught in production with `cf-cache-status: HIT, Age: 3593`
while a mobile-nav fix that had deployed correctly still looked broken.

Both static assets are content-hashed now and served `immutable`; `/downloads/`
gets an explicit one-hour TTL because its filename must stay stable — people link
to it.

---

## 3. Crawlability

The thing that matters most on a domain with no authority: does the content
arrive in the response body, or does it need a JavaScript render that may never
be budgeted?

| URL | Words in raw HTML | Needs JS? |
|---|---|---|
| `/` | 1,723 | No — prerendered at build time |
| 11 content pages | 445–1,334 each | No — static HTML off disk |
| `/privacy`, `/terms` | head only | Body yes, metadata no |
| Everything else | — | `noindex` by design |

Confirmed by requesting as each crawler rather than assuming:

| Crawler | Response |
|---|---|
| Googlebot | 200, full text |
| bingbot | 200 |
| DuckDuckBot | 200 |
| facebookexternalhit, Twitterbot | 200 — link previews work |
| **GPTBot** | **403** — Cloudflare default, your decision (`MANUAL_QUEUE.md` O6) |

---

## 4. Metadata

All 14 sitemap URLs, measured live:

- **Titles:** 46–65 characters. All unique. All within the truncation point.
- **Descriptions:** 90–156 characters. All unique. None auto-generated.
- **Canonicals:** all present, all self-referential, none pointing at a URL that
  redirects.
- **H1:** exactly one per page. No skipped heading levels anywhere.
- **Open Graph / Twitter:** present on all 11 content pages; `og:url` matches the
  canonical and `og:title` matches `<title>` on every one — asserted by
  `check-seo.mjs`, not spot-checked.

---

## 5. Structured data

14 JSON-LD blocks, all parsing:

| Type | Where |
|---|---|
| `SoftwareApplication` + `WebSite` + `Organization` | `/`, and the two legal pages |
| `BreadcrumbList` + `Organization` + `WebPage` | the two commercial pages |
| `BreadcrumbList` + `Organization` + `Article` | seven guides |
| `BreadcrumbList` + `Organization` + `CollectionPage` | `/guides` |
| `BreadcrumbList` + `Organization` + `HowTo` | the free tracker |

**No `aggregateRating`, no `Review`, no `offers` with a price anywhere.** TRENIKO
has no reviews; marking up ones that do not exist is fabricated structured data
and a manual action waiting to happen. `check-seo.mjs` fails the build if any of
those types appear.

Breadcrumb markup is generated from the same array that renders the visible
trail, so the schema cannot describe a path the reader does not see.

---

## 6. Robots, sitemap, duplicates

- `robots.txt`: private routes disallowed, sitemap declared. Agrees with the
  runtime `noindex` — two layers, because a non-rendering crawler never sees the
  runtime tag.
- `sitemap.xml`: 14 URLs, no duplicates, every one returns 200, every one exists
  on disk. Asserted both directions by `check-seo.mjs` — a page missing from the
  sitemap fails, and a sitemap entry with no page fails.
- **www → apex:** 301. **http → https:** 301. Both verified.
- **Trailing slash:** `/guides` and `/guides/` both answer 200 with identical
  bytes. The canonical on both points at the no-slash form, which resolves the
  duplicate. A 301 would be tidier; the canonical is sufficient and the nginx
  comment explains why serving 200 at the clean URL was chosen deliberately.
- **Case:** `/GUIDES` answers 200 with the `noindex` shell, not the page.

---

## 7. Soft 404s — partially fixed, and honestly so

| Request shape | Status | Indexable? |
|---|---|---|
| `/nope.html`, `/nope.php`, `/assets/nope.js` | **404** | No |
| `/nope`, `/guides/nope` (no extension) | **200** | **No** — `noindex, nofollow` |

Extensionless unknown paths still answer 200 with the app shell. That is the SPA
fallback doing its job for `/dashboard`, and it cannot distinguish an invented
URL from a real client route without enumerating every route in nginx.

The indexing risk is closed — the shell is `noindex, nofollow`, so no invented
URL can enter the index. The remaining cost is that Google spends a little crawl
budget discovering that. Returning a true 404 needs the route list in nginx and
is not worth the coupling at 14 URLs.

---

## 8. Performance

Measured over the wire, gzipped, cache-busted:

| URL | HTML | Total | Requests | TTFB |
|---|---|---|---|---|
| `/guides/no-show-clients` | 4 KB | **8 KB** | 3 | 129 ms |
| `/free-personal-trainer-client-tracker` | 3 KB | **7 KB** | 3 | 167 ms |
| `/` | 11 KB | 156 KB | 3 | 196 ms |
| `/login` | 2 KB | 147 KB | 3 | 132 ms |

The content pages are 7–8 KB total across three requests. There is nothing to
optimise there; that is close to the floor for a page with 1,300 words on it.

Render-blocking on a content page: **one small stylesheet.** The JSON-LD block is
data, and the beacon is `defer`. Nothing else blocks.

`/` and `/login` carry the 141 KB React bundle. For `/` that is mitigated by the
prerender — the text is painted before the bundle arrives — and the heavy
libraries (Recharts, FullCalendar) are already code-split out of the entry
chunk.

**Not measured: LCP, CLS, INP.** Lab values from an offscreen iframe are
worthless (LCP does not fire when the frame is not visible), and field data needs
CrUX, which needs Search Console. Run PageSpeed Insights in a browser
(`pagespeed.web.dev`, free, no account) if you want lab numbers before then. No
number is quoted here because none was honestly obtained.

---

## 9. Images

**There are none.** Zero `<img>` on any content page, so alt-text coverage is
vacuously complete and image optimisation is not a finding.

That is not a defect, but it is worth naming: a 1,300-word guide with no visual
break is harder to read than one with a diagram, and the pages most in need of
one are `/guides/session-packages` (the counting model) and
`/free-personal-trainer-client-tracker` (what the sheet looks like). Inline SVG
would cost no requests and no CSP change.

Not done in this pass, because a diagram invented to fill a gap is worse than
white space. Listed in the content plan as an option, not a task.

---

## 10. hreflang

**Not applicable, and should stay that way for now.**

The product interface is available in English, Croatian and German. The public
website is English only. hreflang describes *alternate language versions of the
same page* — with one language there is nothing to declare, and declaring it
anyway is a self-referential tag that does nothing.

This becomes a real question the moment a Croatian version of any public page
exists. It is a decision about who the first twenty users are, not a technical
one, and it is still open.

---

## 11. What is left, in priority order

| # | Item | Who | Why it is not done |
|---|---|---|---|
| 1 | **Search Console** | **You** | Ten minutes. Everything unknown above depends on it |
| 2 | Lab CWV via PageSpeed Insights | **You** | Free in a browser; the API needs a key |
| 3 | True 404 for extensionless unknown paths | Optional | Needs the route list in nginx; indexing risk already closed |
| 4 | Diagrams on two guides | Optional | Only worth doing if the diagram is genuinely explanatory |
| 5 | Croatian pages + hreflang | **Your decision** | Not a technical question |
