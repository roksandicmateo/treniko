# TRENIKO admin panel — current scope and what is missing

**Written:** 18 Aug 2026, after the read-only admin panel was built.
**Status:** documentation only. Nothing in section B or C is implemented.

The panel at `/admin` is a pure consumer of the existing admin API added in
migration 033. No backend file was changed to build it. This document records
what that API supports today, what it does not, and which gaps are worth closing
— so that the next person does not have to rediscover the boundary by hitting it.

---

## A. Read-only, already available

Everything below is live, wired into the UI, and covered by tests.

| Capability | Endpoint | Where it appears |
|---|---|---|
| Platform counts — tenants, trainers, clients, sessions | `GET /overview` | Dashboard |
| Signups in the last 7 / 30 days | `GET /overview` | Dashboard |
| Subscriptions by plan × status, with trial counts | `GET /overview` | Dashboard, Subscriptions |
| Locked-trainer count | `GET /overview` | Dashboard |
| Pending account-deletion count | `GET /overview` | Dashboard |
| Newest tenants | `GET /overview` | Dashboard |
| Tenant list — plan, status, limits, usage, trainer count | `GET /tenants` | Clients, Subscriptions, Sessions |
| Tenant search, server-side | `GET /tenants?search=` | all three |
| Tenant detail — tenant, its trainers, subscription, staff history | `GET /tenants/:id` | Trainer detail |
| Trainer list — name, email, tenant, verified, locked, dates | `GET /trainers` | Trainers |
| Trainer search and filters (`tenantId`, `verified`, `locked`) | `GET /trainers?…` | Trainers (search wired; filters not yet surfaced) |
| Trainer detail — profile, DPA, lockout state | `GET /trainers/:id` | Trainer detail |
| Per-tenant usage against plan limits | via `GET /tenants` | Clients, Sessions, Subscriptions |
| Administrator audit trail with before → after | `GET /audit` | Activity |
| Audit filters (`adminId`, `entityType`, `tenantId`) | `GET /audit?…` | supported by API, **not yet surfaced as controls** |
| Administrator list (owner only) | `GET /admins` | not surfaced yet |
| API liveness | `GET /health` (public) | System |

---

## B. Read-only, missing

Each of these needs a new backend endpoint. None is implemented.

### B1. Individual client records — **deliberately absent, do not "fix"**

There is no endpoint that returns client rows, and there should not be one by
default. `clients` is RLS-protected; admin requests establish no tenant context;
under the `treniko_app` role the table returns zero rows. The boundary is
enforced by PostgreSQL, not by the UI hiding anything.

A trainer's client records carry health notes and dates of birth. There is no
routine support task that needs staff to read them, and under GDPR every
avoidable path to that data is a liability.

**If a genuine need ever appears** — a support request the trainer themselves
raises, say — it should arrive as its own migration with its own justification,
a narrowly scoped endpoint, mandatory audit logging of every read, and ideally
the trainer's recorded consent. Not as a widening of this panel.

### B2. Individual sessions — same reasoning

`training_sessions` is RLS-protected on the same terms. Only aggregate
`sessions_count` per tenant is available.

### B3. Trainer last-activity / last-login

The `users` table records no last-login timestamp (`platform_admins` does).
The Trainers table therefore shows `updated_at`, labelled honestly as "last
updated" rather than dressed up as activity.

**To close:** add `users.last_login_at`, set it in `authController.login`, and
surface it. Small, additive, one migration. Genuinely useful for spotting
accounts that registered and never returned.

### B4. Migration status

No endpoint reports applied/pending migrations. Available on the server as
`npm run db:status`.

**To close:** `GET /api/admin/system/migrations` returning counts and the
pending list. Read-only, no secrets. Low risk.

### B5. Deployed version / commit

Nothing reports the running commit.

**To close:** inject the commit SHA at build time and return it from a system
endpoint. Makes "is the fix live?" answerable without SSH.

### B6. RLS enforcement status

The application already computes this at startup (`config/rlsStatus.js`) and
logs it, but does not expose it over HTTP.

**To close:** return the same structure from a system endpoint. This is the most
valuable of the three System gaps — it answers "is the tenant boundary actually
switched on in production?" from a screen instead of from a log file.

### B7. Per-tenant revenue / payment totals

`client_payments` is RLS-protected, so no revenue figure is reachable. Note that
`subscription_usage` carries no money column either — there is currently no
aggregate to surface even in principle.

---

## C. Mutations — not implemented in the UI

**The API already supports every mutation below.** They were deliberately left
out of the panel: the brief asked for no destructive actions in the first
version, and each one deserves a confirmation step and a considered UI rather
than being bolted on.

Every one of these already writes a full before → after record to
`admin_audit_log`, so the audit trail is ready for them.

| Action | Endpoint | Role | Notes before building the UI |
|---|---|---|---|
| Update tenant name / phone / website | `PATCH /tenants/:id` | admin | Low risk. Refuses an empty name |
| Change plan, status, period, trial | `PATCH /tenants/:id/subscription` | admin | **The one that makes "free for early adopters" operable** — trainers cannot self-upgrade (payment-gated by TR-HIGH-2), so granting a plan is staff-only. Highest business value in this table |
| Update trainer profile fields | `PATCH /trainers/:id` | admin | Email and password are refused by the API by design — both redirect account recovery |
| Unlock a locked-out trainer | `POST /trainers/:id/unlock` | admin | The single most likely real support request. Trivial UI, high value |
| Force-verify a trainer email | `POST /trainers/:id/verify-email` | admin | For when verification mail genuinely cannot be delivered. Clears the outstanding token |
| Create an administrator | `POST /admins` | owner | |
| Change an admin's role / deactivate | `PATCH /admins/:id` | owner | API refuses self-demotion and self-deactivation |

### Not supported by the API at all, and probably should not be

- **Deleting a tenant or trainer.** The supported path is the trainer's own
  account-deletion flow plus `scripts/cleanup-qa-tenant.js`, which proves a
  tenant is empty before removing it. A one-click delete on a cross-tenant panel
  is a different risk class entirely.
- **Reading or setting a password.** No support flow should involve staff
  knowing a customer's password.
- **Impersonating a trainer.** Occasionally requested, and the most dangerous
  feature an admin panel can have. If it is ever built it needs explicit
  per-session consent from the trainer, a hard time limit, and its own audit
  stream.

---

## Recommended order, if this is picked up again

1. **Unlock trainer** (C) — smallest UI, answers the most common support ticket.
2. **Change plan** (C) — unblocks the early-adopter offer without a database console.
3. **RLS status endpoint** (B6) — turns the most important security property into something observable.
4. **`users.last_login_at`** (B3) — cheap, and the activation funnel needs it.
5. Migration status and version (B4, B5) — nice to have, lowest value.

Sections B1, B2 and B7 should stay closed unless a specific, justified need
appears in writing.
