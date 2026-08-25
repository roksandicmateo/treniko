# TRENIKO — Search Console growth analysis

**Status: EMPTY, AND DELIBERATELY SO.** · Checked 25 Aug 2026.

Search Console is **not connected**. This file exists as the place the analysis
will go, and it contains no analysis — because there is nothing to analyse and
writing plausible-looking findings from no data is the single most expensive
thing that could be done to this project.

---

## What was checked, and how

| Check | Result |
|---|---|
| `google-site-verification` meta tag in the homepage head | **absent** |
| DNS TXT records on `treniko.com` | **two, neither Google**: `v=spf1 include:zoho.eu ~all` and `brevo-code:03c4d94e...` |
| `/google*.html` verification file | 404 |

**This is the only thing missing.** Everything Search Console needs on our side
is done and verified in production:

- `sitemap.xml` — 15 URLs, all returning 200, all present on disk
- `robots.txt` — sitemap declared, private routes disallowed
- Googlebot receives full text: 1,334 words on a guide, 1,723 on the homepage
- Canonicals self-referential on every indexable page
- Structured data valid on all 15
- Security headers and HTTPS in place

Nothing else is waiting on anything except one DNS record.

---

## The one manual action

Nameservers are **Cloudflare** (`perla.ns.cloudflare.com`,
`rustam.ns.cloudflare.com`), so the TXT record goes in the Cloudflare dashboard.

1. <https://search.google.com/search-console> → **Add property → Domain** →
   `treniko.com`
2. Copy the `google-site-verification=…` string it shows
3. Cloudflare dashboard → `treniko.com` → **DNS → Records → Add record**
   - Type `TXT` · Name `@` · Content: the string from step 2
   - ⚠️ **Add, do not edit.** The existing SPF and Brevo TXT records must stay —
     overwriting the SPF one breaks outbound email.
4. Back in Search Console → **Verify**
5. **Sitemaps** → submit `sitemap.xml` → expect **15** URLs

That is the whole procedure.

**Then tell me.** The next session fills this file in from real data.

---

## What gets analysed the moment data exists

Recorded now so the analysis is not designed after seeing the numbers — which is
how a report ends up describing whatever the data happens to show as a success.

### The four questions, in order

1. **Is anything indexed at all?** Pages report → Indexed vs Discovered vs
   Crawled-not-indexed. On a domain this new, most URLs sitting in *Discovered*
   after a month is normal, not a fault.
2. **What are we appearing for?** Queries with impressions. This replaces every
   keyword hypothesis in `RESEARCH_2026.md` § 4, which are guesses and labelled
   as such.
3. **Where are we close?** Queries at **positions 4–30**. Position 4–10 is a
   title, meta description or intent-match problem — cheap to fix. Position
   11–30 means the page is understood but not trusted; more content rarely fixes
   that, better internal linking sometimes does.
4. **Where do impressions not become clicks?** High impressions, low CTR, at a
   decent position, is almost always the title or description failing to match
   what the searcher wanted.

### The filter that decides what gets acted on

**Would this searcher plausibly become a TRENIKO user?**

A query is only worth optimising for if the person typing it is a personal
trainer running their own business. Impressions from people looking for workout
programmes, certifications, gym memberships or client-side fitness apps are
*not* an opportunity, however many there are, and chasing them produces traffic
that cannot convert and content that dilutes the site.

### The ranking, once queries are known

1. **Easiest ranking improvement** — position 4–10 on a relevant query, where a
   title or description rewrite is the whole job
2. **Highest relevant impressions** — where demand demonstrably exists
3. **Strongest commercial intent** — someone comparing software beats someone
   reading about policy
4. **Shortest path to a trainer signing up**

### What will NOT be done with this data

- Writing a page for every query with impressions. Most will be variants of a
  covered topic, and a second page for a covered query competes with the first.
- Reporting a CTR from fewer than a few hundred impressions. It is noise.
- Treating branded searches as a win. People searching "treniko" already know
  the name; the non-branded queries are the acquisition signal.

---

## The honest caveat about timing

**Do not expect anything useful for two to four months.** Twelve of the fifteen
URLs were published within the last two days, on a domain with no backlinks and
no history. First impressions typically take weeks; query data worth acting on
takes longer.

Connect it now anyway. The clock does not start until it exists, and there is
nothing else on the critical path.
