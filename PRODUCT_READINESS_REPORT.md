# TRENIKO — Product Readiness Report

**Sprint:** beta readiness (product / QA), following the security hardening phases
**Starting commit:** `e8744ce`
**Method:** the product was exercised as a personal trainer would use it — through
the real API against a real PostgreSQL database with row-level security in force,
and through the real interface in Chrome, in Croatian, at desktop and phone widths.
No mocks, no assumptions from reading routes.

---

# Executive Summary

TRENIKO's core trainer workflow **did not work end to end** at the start of this
sprint, and the failures were not subtle. Scheduling a group session was
impossible — the endpoint answered *"Group not found"* for a group that plainly
existed. The dashboard's "Upcoming this week" list printed **"Invalid Date"** on
every row, and opening any session from it produced an edit dialog with an empty,
unsaveable date. Clicking "Cancel package" replaced the client page with an error
screen. A brand-new trainer who signed up was sent to a *"Check your email"* page
whose email is never sent, because outbound mail is not configured — and the only
way past it was to press refresh, which happened to work because the gate was
also inconsistent. And the number a session-package business runs on — *sessions
remaining* — never moved, because nothing decremented it.

None of these were visible from the route table. All of them were reachable in
the first ten minutes of using the product.

**Twenty-three defects were found and fixed**: six that would have made a closed
beta fail outright, seventeen that would have made trainers distrust what they
were reading. The full trainer journey — register, onboard, configure, two
clients, package, individual session, group session, training, progress, payment,
notes, edit, reschedule, cancel, complete, remaining sessions, dashboard,
calendar, export, log out and back in — now passes end to end, and is pinned by
regression tests: **23 new backend tests** and **13 new frontend tests**, on top of
the existing suites, all green (**808 backend, 58 frontend**).

The security posture from the previous phases is intact and verified: the entire
backend suite still passes against a freshly provisioned **non-superuser,
NOBYPASSRLS role that owns nothing**. Both dependency audits report zero
vulnerabilities. One new migration was needed and applied (29 total, 0 pending).

**Two things stand between this and a closed beta, and neither is code.**
Outbound email is not configured, so a trainer who forgets their password cannot
recover it. And the Free plan caps at 5 clients / 20 sessions per month with no
payment path, so every invited trainer hits a wall inside a week. Both are an
hour of configuration or one business decision. Until they are done, inviting
real trainers means inviting them into those two walls.

---

# Product Areas Tested

| Area | Exercised | Result |
|---|---|---|
| Register / login / logout / re-login | API + UI | pass |
| Email verification | API + UI | **was a dead end** — fixed |
| Forgot / reset password | code + config | works in code; **no email is sent** (see risks) |
| DPA acceptance, onboarding | API + UI | **blocked page loads** — fixed |
| Trainer profile & business settings | API + UI | pass |
| Language handling (hr / en / de) | UI | **mixed languages** — fixed on all core screens |
| Dashboard | API + UI | **broken dates, stale stats, cancelled sessions** — fixed |
| Clients: list, create, edit, archive, deactivate, delete, detail | API + UI | **overflow, misaligned table, lost fields** — fixed |
| Client notes | API + UI | pass |
| Packages: create, assign, usage, cancel | API + UI | **cancel crashed; usage never moved** — fixed |
| Sessions: create, edit, reschedule, cancel, complete, conflicts | API + UI | **date corruption** — fixed |
| Group sessions: create, list, log, attendance | API + UI | **impossible to create** — fixed |
| Groups: create, members, feed | API + UI | pass (unreachable on mobile — fixed) |
| Trainings, exercises, sets, templates | API | pass |
| Progress: entries, charts, strength, overview | API | pass |
| Payments & billing summary | API | pass |
| Subscription UI & limits | API + UI | pass (limits are a business risk, see below) |
| GDPR export & account deletion | API + UI | **export refused for every new trainer** — fixed |
| Uploads / training images | API | pass |
| Mobile responsiveness | real 386px viewport | pass after fixes |

---

# P0 Findings

All six confirmed and fixed.

### P0-1 — Group sessions could not be scheduled at all
`POST /api/groups/:id/sessions` answered **404 "Group not found"** for a group
that existed and had members. The handler checked out a raw `pool.connect()`
client, which carries no tenant context; with row-level security in force for the
runtime role, every statement on it was denied — including the lookup that
decided the group did not exist. The same defect sat in
`PUT /api/groups/:id/sessions/:sessionId`, so a group session's log and its
per-member attendance could not be saved either.

*Reproduction:* create a group, add a member, schedule a session → 404.
*Fix:* reads go through the context-carrying `pool.query`; the transaction uses
`getClient()`, which establishes the context on `BEGIN`.

### P0-2 — The dashboard printed "Invalid Date", and sessions opened unsaveable
`session_date` is a `DATE`. The dashboard, session create/update and client
detail returned it as a timestamp, which node-postgres serialises as a UTC
instant — `2026-08-20` leaves the server as `2026-08-19T22:00:00.000Z` in
Croatia. The dashboard builds `session_date + 'T00:00:00'` to get a local day,
which is unparseable from a timestamp: **every row in "Upcoming this week" read
"Invalid Date"**, and the same value went into the session modal's `<input
type="date">`, which rendered empty and refused to submit.

*Fix:* every endpoint that returns a session date now casts `::text`, matching
what `GET /api/sessions` already did.

### P0-3 — "Cancel package" crashed the client page
`PackagesSection` called `showConfirm(...)`, which is defined in a different
component in the same file. Clicking it threw `showConfirm is not defined` and
the error boundary replaced the whole client detail page.

*Fix:* the section owns its own confirmation dialog, and surfaces a failure
instead of swallowing it.

### P0-4 — New trainers were locked out behind an email that is never sent
Registration redirected to `/check-email` — *"click the link in the email to
activate your account"* — with only a "Back to login" button. The mail service
sends through the Brevo HTTP API and does nothing without `BREVO_API_KEY`, which
is unset, so **the link never arrives and there is no resend**. The gate was also
inconsistent: `/auth/validate` did not return `emailVerified`, so after any page
reload the field was `undefined`, `undefined === false` is false, and the user was
let straight in. Verified by hand — blocked after signing up, admitted after
pressing refresh.

*Fix:* `/auth/validate` now returns the field, so the client's state is
deterministic; the hard redirect is replaced by a dismissible banner asking for
verification. Re-enabling enforcement is one named constant
(`ENFORCE_EMAIL_VERIFICATION` in `PrivateRoute.jsx`) once mail and a resend path
exist.

### P0-5 — Sessions remaining never decreased
The product's core commercial unit is "10 sessions for €400". Nothing decremented
it. `use-session` existed but its only caller was the training-detail page's
complete toggle — and that call was not idempotent (toggling twice charged twice),
was never refunded, and wrote a usage row with no link to any session. A trainer
completing sessions on the calendar — the way the product invites them to — watched
"10 sessions remaining" stay at 10 forever, while the session modal's package
banner reported a balance that was never true.

*Fix:* completion is what consumes a package session, recorded server-side next to
the status change. Idempotent (unique on `session_id`), reversible (un-completing
or deleting the session returns it), and it closes the package out when the last
session is used. The frontend's ad-hoc charge was removed.

### P0-6 — A new account's first screen showed no numbers at all
Pages rendered *underneath* the blocking DPA modal, so every screen mounted and
fetched while the API was still answering `403 dpa_required` — and none retried
after acceptance. Immediately after signup the dashboard's four headline figures
all read **"—"** and the onboarding checklist never appeared.

*Fix:* nothing below the DPA modal renders until the agreement is accepted, so
pages mount and fetch once they are allowed to. The dashboard also gained a real
error state, because "we could not reach the server" previously looked identical
to "you have no clients yet".

---

# P1 Findings

All seventeen confirmed and fixed.

| # | Area | What the trainer saw | Cause |
|---|---|---|---|
| P1-1 | Calendar | Group sessions drawn **one day early** | `DATE` serialised in UTC, then `.split('T')[0]` |
| P1-2 | Calendar | The client filter **did nothing** | `useCallback([])` closed over the initial empty filter |
| P1-3 | Dashboard | Cancelled sessions still listed as upcoming | filter checked `is_completed` only |
| P1-4 | Clients list | "0 completed" for a client whose sessions were done; cancelled sessions inflating totals | `client_statistics` classified by date, ignoring the status column added later |
| P1-5 | Client detail | Different totals from the clients list for the same client | counted trainings + group sessions locally instead of reading the shared statistics |
| P1-6 | GDPR | "Export my data" returned **403** for every new trainer | data portability gated behind a paid plan; everyone starts on Free |
| P1-7 | GDPR | Export saved a `.zip` that was actually a JSON error, with no message | response status never checked; `showToast` not imported |
| P1-8 | Packages | Deleting a package in use did nothing, silently | `showToast` not imported → `ReferenceError` inside an async handler |
| P1-9 | Client detail, email verification, training modal | Would 404 in production whenever the API is on another origin | relative `/api/...` paths that only work via the dev-server proxy |
| P1-10 | Clients list (mobile) | Page scrolled sideways; headings sat above the wrong columns; a filter switch could show an empty table with no way back | no scroll container; 5 headers over 6 cells; page not reset on filter change |
| P1-11 | Clients list | Full app reload on every client tap | `window.location.href` instead of client-side navigation |
| P1-12 | Mobile | **Groups and Exercises unreachable on a phone** | present only in the desktop nav |
| P1-13 | Clients | Date of birth, goals, injuries, diet and notes silently discarded on create | `INSERT` stored only the first five fields |
| P1-14 | Two modals | Guaranteed `t is not defined` crash on save | `useTranslation` imported but `t` never taken from it |
| P1-15 | Dashboard, calendar, training detail | A failed load looked like "no data"; a failed action looked like success | no error states |
| P1-16 | Throughout | Croatian and English mixed on the same screen, including the entire signup form | strings hardcoded instead of translated |
| P1-17 | Training detail | Marking a training complete charged the package **twice** | page charged directly *and* completed the linked session |

---

# P2 Backlog

Recorded in `PRODUCT_BACKLOG_BETA.md`, not built. Headline items:

1. **Free-plan limits (5 clients / 20 sessions per month) with no payment path** — a business decision, see risks.
2. **Outbound email unconfigured** — breaks password recovery and verification.
3. **No "resend verification email"** endpoint or button.
4. **DPA and health-data consent modals are English-only** — legal copy, needs a translation the owner will stand behind.
5. Plan usage bar goes stale until the next navigation.
6. Onboarding dismissal is global, not per user.
7. Three unused components should be deleted (their latent crashes were fixed in place; removal was declined by the environment).
8. Touch targets slightly under 44px; a bottom-nav label wraps on narrow phones.

# P3 Backlog

`users.language` written by nobody; `client_statistics` not a `security_invoker`
view (flagged, deliberately not changed — it touches the RLS design);
training-log routes gated and unreachable; single 1.34 MB bundle; assorted
polish. Plus five experiment ideas, none of them commitments.

---

# Bugs Fixed

**Backend**
- `routes/groups.js` — tenant context on group session create and log/attendance save (P0-1); `session_date::text` on every group session read and write (P1-1).
- `controllers/dashboardController.js` — calendar dates, `status` included, cancelled sessions excluded, server-local "today" instead of UTC (P0-2, P1-3).
- `controllers/sessionsController.js` — calendar dates on create and update; package consumption on completion, idempotent and reversible, released on delete (P0-2, P0-5).
- `controllers/clientsController.js` — all client fields persisted on create; calendar dates and status on session lists (P1-13, P0-2).
- `controllers/authController.js` — `/auth/validate` returns `emailVerified` (P0-4).
- `server.js` — data export removed from the plan feature gate (P1-6).
- `migrations/031_client_statistics_status_aware.sql` — the view now classifies by session status (P1-4).

**Frontend**
- `PrivateRoute.jsx` + new `VerifyEmailBanner.jsx` — verification reminded, not enforced (P0-4).
- `DashboardLayout.jsx` — nothing renders or fetches behind the DPA modal; mobile access to Groups and Exercises (P0-6, P1-12).
- `DashboardPage.jsx` — real error state with retry (P1-15).
- `ClientDetail.jsx` — own confirm dialog for package cancel, absolute API URLs, statistics read from the shared source, save failures surfaced (P0-3, P1-5, P1-9, P1-15).
- `Clients.jsx` — scrollable table, correct headers, page reset on filter change, client-side navigation, toast copy that names the action (P1-10, P1-11).
- `Calendar.jsx` — working client filter, load-error banner, dark mode on the calendar card (P1-2, P1-15).
- `SessionModal.jsx` — package banner refreshes after a status change; error text from the server; language consistency.
- `ProfileMenu.jsx` — `showToast` imported; export checks the response before saving a file (P1-7).
- `PackagesPage.jsx` — `showToast` imported, so a refused delete is now visible (P1-8).
- `TrainingDetailPage.jsx` — no longer double-charges the package; toggle failures surfaced (P1-17, P1-15).
- `VerifyEmail.jsx`, `AddTrainingModal.jsx` — absolute API URLs; correct client filter parameter (P1-9).
- `ClientModal.jsx`, `TrainingLogModal.jsx` — latent `t is not defined` crashes removed (P1-14).
- `Register.jsx`, `CheckEmail.jsx`, `PasswordInput.jsx`, `AssignPackageModal.jsx`, `GroupsPage.jsx`, locales — language consistency (P1-16).

---

# UX Improvements

Beyond the defects, kept deliberately narrow:

- Toasts name what happened. Adding a client used to announce **"Active"**; deleting one announced **"Delete"**. They now say "Client added", "Client deleted", and so on, in the interface's language.
- The upgrade dialog closes when the server refuses a paid upgrade, instead of sitting open behind the toast as though it were still working.
- Errors are shown where the action was taken — the calendar, the dashboard, the client profile dialog, the package list — with a retry where retrying makes sense.
- Dates format in the user's locale rather than always `en-GB`.
- Groups and Exercises are reachable from the profile menu on phones.

No redesign was attempted. Layout, visual language and navigation structure are unchanged.

---

# Mobile Findings

Tested at a real **386px viewport** with media queries active, on dashboard,
clients, client detail, calendar, session modal, packages, progress, trainings
and groups.

- **No page scrolls horizontally.** The clients table was the one offender; it now scrolls inside its own container while the page stays put.
- **Groups and Exercises were unreachable on a phone** — the two sections exist only in the desktop nav. Now in the profile menu.
- The session modal fits (339px wide inside a 386px viewport) with its save button in view without scrolling.
- Bottom navigation, safe-area padding and modal scrolling behave correctly.
- Remaining, non-blocking: the primary button is 36px tall against a 44px guideline, and "Nadzorna ploča" wraps in the tab bar.

**Mobile: PASS** for launch purposes.

---

# Data Consistency

The sprint's rule was that no two screens may disagree about the same number.

| Number | Before | After |
|---|---|---|
| Completed sessions per client | Clients list said 0 while the dashboard said 1, for the same data | one source (`client_statistics`), classified by status |
| Upcoming sessions | Included completed and cancelled sessions dated in the future | only `scheduled`, dated today or later |
| Total sessions | Counted cancelled sessions | excludes cancelled |
| Client detail totals | Counted trainings + group sessions locally | reads the same statistics as the list |
| Sessions remaining | Frozen at the starting value forever | decrements on completion, restored on undo or delete |
| Session dates | Timestamp on some endpoints, calendar date on others; a day early east of Greenwich | calendar dates everywhere |
| Dashboard "today" | UTC date — wrong for two hours every night in Croatia | server-local date |

---

# Tests Added

**Backend — `tests/product/trainerWorkflow.test.js`, 23 tests**
Group session scheduling and logging under RLS; calendar-date shape on every
session-returning endpoint; cancelled sessions excluded from the dashboard;
package consumption (charge, idempotence, refund on undo, refund on delete,
close-out at zero, usage linked to the session that paid); status-aware client
statistics including the future-completed and cancelled cases; client creation
keeping every field; export reachable on the Free plan; `emailVerified` returned
by `/auth/validate`.

**Frontend — `src/__tests__/product.regression.test.jsx`, 13 tests**
Every `t()` key referenced in the source exists in all three locales (467 keys
checked); no file calls `t()` without obtaining it; no file calls `showToast`
without importing it; no file fetches a bare `/api` path; the dashboard's date
parsing assumption, including the timestamp case that broke it; the verification
gate stays off behind its named constant; the clients list resets its page and
navigates client-side.

Two of these are source checks rather than render tests, deliberately: the bugs
they protect against were unbound identifiers on error and busy paths — the paths
a render test is least likely to reach — and they had shipped in four separate
files.

**Both suites were verified to fail without their fixes**, so they are not
vacuous: reverting the group-session tenant context turns the scheduling test red,
and removing the `showToast` import names the exact file.

**Security tests touched (2).** Two suites asserted that `/api/export` returns 403
on the Free plan. Data export is now deliberately exempt from the plan gate. The
security property — the feature gate runs and denies for an authenticated
free-plan caller — is unchanged and still asserted, retargeted onto the
training-logs route, and a new test pins the export exemption so it cannot be
undone by accident.

---

# Remaining Beta Risks

1. **Free plan caps at 5 clients / 20 sessions per month, with no way to upgrade.** A working trainer passes both inside a week; the upgrade button then answers *"contact support"*, correctly, because there is no payment provider. **Decide and apply before invitations go out** — put testers on Pro, raise the Free limits, or add a beta plan.
2. **Outbound email is not configured.** `BREVO_API_KEY` is unset, so nothing is sent. The sharp edge is **password reset**: a trainer who forgets their password cannot recover it, and there is no admin path either. Email verification no longer blocks anyone, but this one is a support burden from day one.
3. **The DPA and the health-data consent modal are English-only** while the interface is Croatian. Trainers are being asked to accept a GDPR agreement, and to attest to their client's consent, in a language they may not read. Product/legal decision, not an engineering one.
4. **No `emailVerified` enforcement means unverified addresses can use the product.** Deliberate, and reversible with one constant — but it does mean a typo'd address is not caught until someone notices.
5. **Group and payment features have the thinnest real-world exposure.** Group session scheduling was completely broken until this sprint, so it has never been used by anyone. Payments are recorded but never reconciled against packages automatically. Both deserve close attention in the first week of beta.

---

# Beta Launch Recommendation

## NOT READY FOR CLOSED BETA

— and this is a configuration verdict, not a code one. **No engineering work
remains.** Every P0 and P1 found in this sprint is fixed and covered by tests;
the full trainer journey passes end to end; the security posture from the earlier
phases is intact and verified under a restricted, RLS-enforced role; both audits
are clean.

The verdict is *not ready* because of what happens to a real trainer invited
today:

- **In week one they hit a hard wall at 5 clients**, and the only door out says "contact support".
- **If they forget their password, they cannot get back in**, because no email can be sent.

Neither is a defect in the product; both are unmade decisions about how it is
deployed. Ship the two of them — assign beta testers to a plan that fits real use,
and configure `BREVO_API_KEY` — and this becomes **READY FOR CLOSED BETA** the
same day, with no further code changes.
