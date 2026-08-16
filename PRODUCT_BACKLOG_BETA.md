# TRENIKO — Product Backlog (post-beta)

Findings from the beta-readiness sprint that were deliberately **not** built.
Everything launch-blocking was fixed and is described in
`PRODUCT_READINESS_REPORT.md`; what follows is what is left, in the order it is
worth doing.

Each item says what a trainer actually experiences, because that is what decides
priority — not how interesting the fix is.

---

## P2 — soon after beta opens

### 1. Free-plan limits make the product unusable within a week
**What the trainer sees.** The Free plan allows **5 clients and 20 sessions per
month**. A working personal trainer passes both inside the first week. When they
do, "Add client" opens an upgrade dialog, and the upgrade returns *"Upgrading to
a paid plan requires a completed payment. Please contact support."* — because
there is no payment provider (correctly: self-service upgrades are blocked so
nobody can grant themselves a paid plan for free).

**Why it is not fixed here.** Plan limits are pricing, not engineering. Raising
them is the owner's decision, and building checkout is explicitly out of scope
for this sprint.

**What to do before inviting testers.** Pick one:
- put beta testers on the Pro plan directly in the database, or
- raise `subscription_plans.max_clients` / `max_sessions_per_month` for `free`,
  or
- add a `beta` plan with generous limits and assign testers to it.

Whichever is chosen, do it *before* the invites go out — the first trainer to
hit the wall has no way through it on their own.

### 2. `.env.example` documents mail settings the code does not read
Outbound email **is** configured in production (Brevo), so verification and
password-reset messages reach users. Local development deliberately runs without
`BREVO_API_KEY`, where `services/emailService.js` logs `[Email DISABLED]` and
sends nothing — that is the intended local behaviour, not a fault.

What is worth fixing: `.env.example` advertises `EMAIL_HOST` / `EMAIL_PORT` /
`EMAIL_USER` / `EMAIL_PASS`, none of which the mail service reads — it uses the
Brevo HTTP API with `BREVO_API_KEY` and `EMAIL_FROM_ADDRESS`. Anyone configuring
mail from the example file configures nothing and gets silence, with no error to
explain it. Correct the example file to name the variables that are actually
read.

### 3. No "resend verification email"
There is no endpoint and no button. A trainer whose message went to spam, or who
mistyped their address at signup, has no route forward — they cannot correct the
address and cannot trigger another send. This is the blocker for restoring the
verification gate, which is otherwise a one-constant change in
`frontend/src/components/PrivateRoute.jsx` now that production mail works.

### 4. Consent and legal copy are English-only
The Data Processing Agreement modal and the health-data Consent modal are
hardcoded English while the rest of the interface is Croatian. A Croatian
trainer is asked to accept a GDPR agreement they may not be able to read, and
to confirm on their client's behalf that consent was given.

Left alone deliberately: translating a legal instrument is not an engineering
edit. It needs a translation the owner is willing to stand behind, and probably
a version bump on the DPA.

### 5. Package type labels and a few list strings are still English
Smaller pockets of the same problem, in ordinary product copy rather than legal
text: parts of the package modal's type descriptions and placeholders. Mechanical
to finish; the pattern is established (`t('packages.typeSessionBased')` etc.).

### 6. The plan usage bar goes stale
`SubscriptionBanner` loads once with the dashboard layout. Add a client and the
bar still reads "Klijenti: 1/5" until the next page navigation. Harmless, but it
is the one place a trainer looks to see how close they are to the limit — which
matters a great deal while item 1 stands.

### 7. Onboarding checklist dismissal is not per-user
`treniko_onboarding_dismissed` is a single localStorage key. If two trainers use
the same browser, the second never sees the checklist. Key it by user id.

### 8. Three unused components should be deleted
`components/ClientModal.jsx`, `components/TrainingLogModal.jsx` and
`pages/CalendarPage.jsx` are referenced by nothing. Two of them contained a
guaranteed `t is not defined` crash, fixed during this sprint so that whoever
wires them up next does not inherit it — but the right move is removal.
(Deletion was attempted and declined by the environment during the sprint.)

### 9. Touch targets are slightly under the recommended size
The session modal's primary button measures 36px tall at 390px width; the usual
guidance is 44px. Nothing is unreachable — it is comfort, on a device trainers
use standing up in a gym.

### 10. Bottom-nav label wraps on narrow phones
"Nadzorna ploča" wraps to two lines in the mobile tab bar and clips slightly.
Shorten the label or the icon/label stack.

---

## P3 — later

### 11. `users.language` is written by nobody
Migration 019 added the column; no code reads or writes it. Language lives in
localStorage, so a trainer's choice does not follow them to another device.
Either wire the column up or drop it.

### 12. `client_statistics` is not a `security_invoker` view
The view is owned by the migration role, so row-level security on the underlying
tables is evaluated as the *owner*, not the caller. Tenant isolation does not
currently depend on this — every query that reads the view also carries an
explicit `WHERE tenant_id = $n` — but it means the view is not a second boundary
the way the tables are. On PostgreSQL 15+ this is one `WITH (security_invoker =
true)`. Flagged, not changed: it touches the RLS design, which was out of scope
for this sprint.

### 13. Training logs are gated behind a paid plan and unreachable
`/api/training-logs/*` returns 403 on the Free plan, and no screen calls it —
training records go through `/api/trainings` instead. Dead surface: either wire
it up or retire the routes.

### 14. `AddTrainingModal` offers inactive clients
Now that it sends `isActive=true` the API filters correctly, but the picker
still shows archived clients in some paths. Worth a pass once the client
lifecycle settles.

### 15. `/uploads` and training images
Images are served only through the authenticated endpoint, which is right, but
there is no UI to view them outside the training detail page and no size or
count feedback when an upload is rejected.

### 16. Bundle is a single 1.34 MB chunk
Fine on a desktop, noticeable on a phone on mobile data — which is the target
device. Route-level code splitting would cut the first paint substantially.

---

## Ideas / experiments (not commitments)

- **Session → package linkage made visible.** The server now records which
  session consumed which package session. Showing that on the client's package
  card ("used on 12 Aug, 19 Aug, …") would make the balance auditable to the
  trainer, and settle disputes with clients.
- **Undo on destructive actions.** Deleting a client is immediate and
  cascading. A short-lived undo would be kinder than a confirmation dialog.
- **Week view as the mobile default.** The calendar opens in day view on
  phones. Trainers appear to think in weeks; worth watching in beta before
  changing.
- **Attendance from the calendar.** Marking a group session's attendance
  currently means opening the group, then the session. One tap from the
  calendar event would match how it is used on the gym floor.
- **Client-facing view.** Nothing in the product is visible to the client.
  Several of the data structures (progress, packages, attendance) would support
  a read-only client link.
