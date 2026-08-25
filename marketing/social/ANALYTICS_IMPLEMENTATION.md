> ## STATUS — 24 Aug 2026
>
> **Steps 3, 4, 5 and the admin read-back are SHIPPED and verified in
> production** (commits `9fea8eb`, `1e3cdb2`). Migration 034 is applied; the
> production database was backed up first to
> `/var/backups/treniko-db/treniko_pre034_*.dump`.
>
> **The denominator is now closed too** (commit `e77f139`, migration 035).
> Page views are counted first-party, cookieless and anonymous, and the admin
> panel shows views, signups and a per-channel conversion rate.
>
> Umami and Plausible were both rejected against the actual server rather than
> in the abstract: Plausible needs Docker + ClickHouse, which this 1 vCPU /
> 961 MB droplet cannot host and which is not installed; Umami would fit but
> keeps its views in its own schema, which turns the one number that matters —
> visits joined to registrations — into a cross-system reconciliation. One
> table in the database that already holds the registrations makes it a single
> query. See `backend/migrations/035_page_view.sql` for the full reasoning.
>
> **Still not measurable, and labelled as such in the panel:** unique visitors
> (no identifier is stored, deliberately, so repeat views cannot be collapsed),
> registration *starts* as distinct from the /register page view, and
> trial-to-paid conversion — which cannot exist while there is no payment
> processor.
>
> Everything below is the original plan, kept as the record of why each
> decision was made.

# TRENIKO — analytics and attribution implementation plan

**Written:** 18 Aug 2026 · **Status: PLAN ONLY. Nothing implemented, nothing deployed.**

No application code was changed to produce this document. Every claim about the
current state below was verified by reading the repository, not assumed.

---

## 1. Current state — verified, not assumed

| Check | Method | Result |
|---|---|---|
| Analytics script in the frontend | grep for `gtag`, `google-analytics`, `googletagmanager`, `plausible`, `umami`, `posthog`, `matomo`, `fathom`, `mixpanel`, `segment` across `frontend/` | **none** |
| UTM parsing anywhere | grep `utm_` across `frontend/` and `backend/` | **none** |
| Source captured at registration | read `backend/controllers/authController.js` `register()` | **none** |
| `signup_source`-style column | `information_schema.columns` on `users` and `tenants` | **none** |
| CSP that would block a script tag | `backend/middleware/security.js` helmet config | applies to the **API only**; the SPA is served by nginx from `dist/` and carries no CSP |

**The funnel breaks in the middle:**

```
REACH → PROFILE VISIT → WEBSITE CLICK → ✗ → REGISTRATION → ACTIVATION → RETENTION
└──────── Instagram Insights ────────┘     └──── nothing measures this ────┘
```

Instagram can prove interest. Nothing on the other side records that anyone
arrived, so no registration can be traced to a Reel, a post or the bio link.

### The registration path, traced end to end

```
frontend/src/pages/Register.jsx      collects { email, password, firstName, lastName, businessName }
  → AuthContext.register(data)       frontend/src/context/AuthContext.jsx:52
  → authAPI.register(data)           frontend/src/services/api.js:47  → POST /api/auth/register
  → authController.register()        backend/controllers/authController.js:85
      INSERT INTO tenants (name)
      INSERT INTO users (tenant_id, email, ...)
      INSERT INTO tenant_subscriptions / subscription_usage
      returns { token, user }
```

Four files, one request. That is the whole surface the change has to touch,
which is why the plan below is small.

---

## 2. Attribution design

### First-touch, session-scoped, cookieless

**First touch wins.** The Reel that made a trainer look is the thing worth
crediting; the direct visit three days later is not new information. So the
capture writes **once** per browser session and is never overwritten.

**No cookies.** Attribution lives in `sessionStorage` — first-party, scoped to
the tab, dropped when the tab closes, never read by anyone else and never used
to follow a person between sites. See §6 for the honest privacy position.

**Server-side is the record.** `sessionStorage` only has to survive the walk
from the landing page to the registration form. Once the account exists the
attribution is a database row, and the client copy stops mattering.

### What gets captured

| Field | Source | Example |
|---|---|---|
| `utm_source` | query string | `instagram` |
| `utm_medium` | query string | `social` |
| `utm_campaign` | query string | `organic` |
| `utm_content` | query string | `reel-p05` |
| `utm_term` | query string | usually null |
| `referrer_host` | `document.referrer`, **host only** | `l.instagram.com` |
| `landing_path` | `location.pathname`, **no query string** | `/` |
| `first_seen_at` | client clock, server re-stamps | — |

**Host only, path only.** A full referrer URL can carry someone else's query
string, and a landing URL with its query string re-records the UTMs twice. Both
are trimmed at capture rather than at storage, so the untrimmed value never
leaves the browser.

### Why `referrer_host` matters as much as the UTMs

Instagram rewrites outbound links through `l.instagram.com`, so a click from the
bio arrives with a recognisable referrer **even when the UTM tags are stripped**
— which they are, for example, when someone types the domain after seeing it in
a Reel. The referrer is the fallback that catches traffic the tags miss.

---

## 3. UTM conventions

Adopting the convention in the session brief:

```
utm_source=instagram
utm_medium=social
utm_campaign=organic
utm_content=<specific-post-or-reel-id>
```

| Parameter | Value | Notes |
|---|---|---|
| `utm_source` | `instagram` | always lowercase |
| `utm_medium` | `social` | |
| `utm_campaign` | `organic` | reserve `paid` for any future ad spend |
| `utm_content` | `reel-p05`, `post-p11`, `story-wk3`, `link-in-bio` | the specific placement |

**Departure resolved — session 6, 18 Aug 2026.** `30-day/UTM_CONVENTION.md`
previously specified `utm_medium=organic_social` and `utm_campaign=launch_30day`,
conflicting with the `social` / `organic` form used here.

**This form won**, and the decision is now applied everywhere: the Facebook Page
CTA button was configured with it while it was being created, and changing a
live button to match a document would be the wrong way round. `UTM_CONVENTION.md`
has been rewritten, and every Story link-sticker URL — the four cycle-1 ones in
`PUBLISHING_QUEUE.md` and `30-day/STORY_PUBLISH_QUEUE.md`, and the five cycle-2
ones in `CONTENT_BATCH_CYCLE_2.md` — now matches. Nothing had been published
under the old form, so nothing is orphaned.

`utm_source` now also takes `facebook`, which it did not need to before.

### Where tags are used

| Placement | Tagged? | Why |
|---|---|---|
| Bio link | **No** | Instagram appends its own `utm_source=ig&…&fbclid=…`; double-tagging risks one overriding the other. `referrer_host` catches these |
| Story link stickers | **Yes** | the sticker hides the URL, so length is free |
| Link in a DM or comment reply | **Yes** | |
| Anything in a caption | **No** | captions are not clickable; a UTM there only makes the text uglier |

---

## 4. Events and funnel

Two layers, because they answer different questions and fail independently.

### Layer 1 — page analytics (cookieless, third-party)

Answers *how many people arrived and from where*. Plausible, Umami or Fathom:
all record UTMs and referrers, none sets a cookie, none needs a consent banner
under the usual EU reading. Self-hosted Umami keeps the data on infrastructure
already owned.

| Event | How |
|---|---|
| Landing page view | automatic |
| `/register` page view | automatic |
| Registration completed | custom event fired after a 201 from the API |

### Layer 2 — first-party funnel (database)

Answers *who actually became a working trainer*, and is the half that Instagram
can never tell you. Every stage below is already derivable from existing tables
once `signup_attribution` exists to join on.

| Stage | Derived from |
|---|---|
| Registration completed | `users.created_at` |
| Onboarding completed | `users.dpa_accepted = true` |
| First client | earliest `clients.created_at` for the tenant |
| First session | earliest `training_sessions.created_at` for the tenant |
| Still active in week 4 | any `training_sessions` row 21–28 days after signup |

Reporting query shape:

```sql
SELECT a.utm_content,
       COUNT(*)                                            AS registrations,
       COUNT(*) FILTER (WHERE u.dpa_accepted)              AS onboarded,
       COUNT(*) FILTER (WHERE c.first_client IS NOT NULL)  AS reached_first_client,
       COUNT(*) FILTER (WHERE s.first_session IS NOT NULL) AS reached_first_session
  FROM signup_attribution a
  JOIN users u ON u.id = a.user_id
  LEFT JOIN LATERAL (SELECT MIN(created_at) AS first_client
                       FROM clients WHERE tenant_id = a.tenant_id) c ON TRUE
  LEFT JOIN LATERAL (SELECT MIN(created_at) AS first_session
                       FROM training_sessions WHERE tenant_id = a.tenant_id) s ON TRUE
 WHERE a.utm_source = 'instagram'
 GROUP BY a.utm_content
 ORDER BY registrations DESC;
```

⚠️ That query reads RLS-protected tables (`clients`, `training_sessions`) and so
must be run by the migration/owner role as an operational report — **not** from
the platform admin API, which deliberately carries no tenant context. Do not
"solve" that by relaxing a policy.

---

## 5. Database changes

**One migration: `034_signup_attribution.sql`.** (033 is the platform admin
migration, already deployed.)

```sql
CREATE TABLE IF NOT EXISTS signup_attribution (
  tenant_id      UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  utm_source     VARCHAR(64),
  utm_medium     VARCHAR(64),
  utm_campaign   VARCHAR(64),
  utm_content    VARCHAR(128),
  utm_term       VARCHAR(128),
  referrer_host  VARCHAR(255),
  landing_path   VARCHAR(255),
  first_seen_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS signup_attribution_source_idx
  ON signup_attribution (utm_source, utm_content);
```

**A separate table, not columns on `tenants`.** Marketing metadata does not
belong in the row every tenant-scoped query reads, and a separate table can gain
fields later without touching a hot table. `tenant_id` as the primary key
enforces first-touch at the schema level: a second insert for the same tenant
cannot succeed.

**Every field nullable.** Most signups will carry no UTMs at all, and a
registration must never fail because attribution was missing. Attribution is
strictly best-effort; the account is the thing that matters.

### Three existing guard tests will fire — satisfy each, do not loosen any

This is the process that already caught migration 033, and it works.

1. **`tests/security/rlsPolicyInventory.test.js`** — the table carries
   `tenant_id`, so it must be protected or excused in writing. **Excuse it**, in
   `UNPROTECTED_TENANT_TABLES`, with the same reason as `tenant_subscriptions`:
   it is written during registration, before any tenant context can exist. A
   policy here would make signing up impossible.
2. **`tests/product/liveQaRegression.test.js`** — `cleanup-qa-tenant.js` must
   know every table with a `tenant_id`. Add `['signup_attribution', 'tenant_id']`
   to **`SHELL_TABLES`**: a QA tenant is expected to have an attribution row, so
   requiring it to be empty would block the cleanup it exists to perform.
3. **GDPR export completeness** — decide deliberately. **Recommendation:
   include it** in `tenantDatasets()` in `exportController.js`. It is data about
   how that trainer arrived, it contains no third-party personal data, and
   including it is the more defensible Art. 15 answer than excluding it.

---

## 6. Privacy

**UTM values are campaign labels, not personal data.** `reel-p05` identifies a
Reel, not a person. Nothing identifying is ever put in a URL parameter.

**Trimming is deliberate.** `referrer_host` not the full referrer, `landing_path`
not the full landing URL. Both are trimmed in the browser, so the untrimmed
value is never transmitted.

**The honest position on `sessionStorage`.** Under ePrivacy, storing information
on a device requires consent unless it is strictly necessary for a service the
user requested. Attribution is not strictly necessary, so a conservative reading
says it needs consent; the common industry reading is that first-party,
session-scoped, non-tracking storage is low risk and widely operated without a
banner. **This plan does not claim the exemption applies.** It notes the
tension, and recommends:

- keep it to `sessionStorage` (dies with the tab), never `localStorage`
- never a cookie, never a cross-site identifier, never a fingerprint
- if a cookie banner is ever added for any other reason, gate this behind it too
- if legal review says consent is required, the fallback is to read the UTMs
  directly from the `/register` URL and store nothing at all — weaker
  attribution, zero storage. Design the capture module so that switching to it
  is a one-line change.

**No Meta Pixel.** It is a cross-site tracker, it would require a consent
banner for an EU audience, and the banner costs more conversions than the
attribution is worth at this stage. If cookieless page analytics is adopted, a
Pixel may never be needed.

**Data subject rights.** Attribution rows are covered by the existing account
deletion path via `ON DELETE CASCADE` from `tenants`, and — per §5 — by the
data export.

---

## 7. Implementation steps

Smallest robust change, in dependency order. Steps 1–2 are independent of 3–5
and can ship first.

| # | Step | Files | Risk |
|---|---|---|---|
| 1 | Add cookieless analytics script | `frontend/index.html` | none — additive tag |
| 2 | Fire a `registration_completed` custom event on 201 | `frontend/src/context/AuthContext.jsx` | none |
| 3 | Capture module: read UTMs + referrer host on first load, write once to `sessionStorage`, expose `getAttribution()` | **new** `frontend/src/utils/attribution.js` | none — pure client |
| 4 | ✅ **DONE 24 Aug 2026** — attribution merged into the register payload | `frontend/src/context/AuthContext.jsx` | low |
| 5 | ✅ **DONE 24 Aug 2026** — migration, whitelist, server-side persistence | `backend/migrations/034_signup_attribution.sql`, `backend/utils/signupAttribution.js`, `backend/controllers/authController.js` | **the only risky step** |
| 6 | ✅ **DONE 24 Aug 2026** — admin reads it back: signups by source / campaign / content | `backend/controllers/adminController.js`, `frontend/src/pages/admin/AdminDashboard.jsx` | none |
| 1-2 | ✅ **DONE 24 Aug 2026** — page analytics, but first-party rather than a third-party script | **new** `backend/migrations/035_page_view.sql`, `backend/utils/pageView.js`, `backend/routes/metrics.js`, `frontend/src/utils/pageView.js`, `frontend/src/seo/PageViewTracker.jsx` | low — public endpoint, rate limited, write-only |

**Step 5 is the one to be careful with.** It touches the registration path,
which is the single most important flow in the product. Two rules:

- The insert is wrapped so that **a failure to record attribution can never fail
  a registration.** Best-effort, logged loudly, swallowed — the same posture as
  `recordAdminAction` in the admin controller.
- The server **whitelists and truncates** every field. Values arrive from the
  browser and are therefore attacker-controlled: cap each at its column width,
  accept only the eight known keys, and ignore everything else. This is a
  parameterised insert, so there is no injection path, but an unbounded string
  is still an unbounded string.

---

## 8. Test plan

| Test | Level | Asserts |
|---|---|---|
| `attribution.js` parses UTMs from a query string | frontend unit | all five UTM keys read |
| First touch is not overwritten | frontend unit | second call with different UTMs leaves stored values unchanged |
| Referrer is reduced to a host | frontend unit | `https://l.instagram.com/?x=1` → `l.instagram.com` |
| Landing path drops the query string | frontend unit | `/?utm_source=x` → `/` |
| No storage is written when there is nothing to record | frontend unit | direct visit, no referrer → no key |
| Registration persists attribution | backend integration | row in `signup_attribution` matching the payload |
| **Registration succeeds with no attribution at all** | backend integration | 201, no row, no error |
| **Registration succeeds when the attribution insert fails** | backend integration | 201 — failure is swallowed |
| Unknown fields in the attribution object are ignored | backend integration | no column set from `{ isAdmin: true }` |
| Over-long values are truncated, not rejected | backend integration | 300-char `utm_content` stored at 128 |
| Existing registration tests still pass | backend | 949 currently passing |
| RLS inventory, QA-cleanup and export guards | backend | all three updated per §5 |

The two bold rows are the ones that matter. Everything else is about getting
good data; those two are about not breaking signup to get it.

---

## 9. Deployment plan

Follows the documented procedure in `README.md` — migrations before code.

1. Verify locally: full backend suite **and** `npm run test:restricted`, plus the
   frontend suite and production build.
2. Commit, push, review.
3. On the droplet: `pg_dump` backup → `git pull` → `npm ci` (both) →
   `npm run build` → `npm run db:migrate` → `npm run db:status` must read
   **0 pending** → `pm2 restart treniko-api`.
4. Verify: site 200, `/api/auth/register` still answers 400 on an empty body,
   PM2 restart count +1 with `unstable_restarts` 0, no new errors in the logs.
5. **Smoke test attribution end to end** with a marked QA registration through
   `https://treniko.com/?utm_source=instagram&utm_medium=social&utm_campaign=organic&utm_content=deploy-smoke`,
   confirm the row, then remove the QA tenant with
   `scripts/cleanup-qa-tenant.js` and verify zero residue.

## 10. Rollback plan

| Failure | Rollback |
|---|---|
| Registration broken | `git revert` the code commit, `npm ci`, rebuild, `pm2 restart`. **Leave the migration in place** — an empty additive table harms nothing, and rolling schema back under a live app is the more dangerous move |
| Attribution rows wrong or empty | no rollback needed; nothing else reads the table. Fix forward |
| Analytics script causes a frontend problem | remove the tag from `index.html`, rebuild. Independent of steps 3–5 |
| Migration itself fails | it is `CREATE TABLE IF NOT EXISTS` plus one index, in a transaction. Restore from the pre-deploy dump only if the database is left inconsistent, which this migration cannot do |

**The migration is additive and reversible by `DROP TABLE signup_attribution`**,
which loses only attribution data and touches nothing else. No existing column,
policy, role or grant is modified at any point in this plan.

---

## 11. What this plan deliberately does not do

- **No Meta Pixel**, no cross-site tracking, no fingerprinting.
- **No change to RLS**, no new BYPASSRLS, no policy relaxed.
- **No last-touch or multi-touch attribution.** First touch answers "what should
  we make more of", which is the only question this account can act on. Revisit
  when there is enough volume for the difference to be measurable.
- **No dashboard.** The reporting query in §4 run by hand is enough at this
  scale; a dashboard before there is data to put in it is theatre.
