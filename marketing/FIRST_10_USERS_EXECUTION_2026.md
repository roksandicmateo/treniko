# TRENIKO — first 10 trainers: execution

**Written:** 25 Aug 2026 · **€0** · Extends `FIRST_10_USERS_2026.md`, which has
the ICP, the objections and the activation definition. This file is the doing.

---

## 1. Current state — production, measured after migration 036

| | |
|---|---|
| Tenant rows | 9 |
| **Accounts** (tenant with a user) | **4** |
| Email verified | 3 |
| Added a client | **3** |
| Created a package | 1 |
| Booked a session | 1 |
| Page views, all time | 56 — QA traffic from these sessions |
| **Visits from a search engine** | **0** |
| **Accounts from a measured source** | **0** |
| **Trainers acquired** | **0** |

All four accounts are development accounts from May. The activation numbers
above were reading zero until today — the query looked through row-level
security with no tenant context and could never have returned anything else.
**The core flow does work end to end; nobody has been acquired.** Those are two
different facts and the dashboard now separates them.

---

## 2. The funnel, and what it can now answer

Live on the admin dashboard, per source, per campaign:

```
Visit → Registration → Verified → First client → First package → First booking
```

**The question it exists to answer:** *which source produced trainers who
actually started using TRENIKO?* Before today nothing joined visits to accounts
to activity; now one row does.

Reading it:

- **`(direct)`** — measured, no source. Typed the address, or the referrer was
  withheld.
- **`(unattributed)`** — created before attribution existed. Never measured.
  Kept apart on purpose: merging them would make development accounts read as
  measured direct signups.
- **Each account counts once per stage.** A trainer with five clients advances
  "first client" by one. This is an activation funnel, not a usage total.
- **No percentage appears below 30 in the denominator.** It says *Not enough
  data yet* instead. Two signups from forty visits is not a 5% conversion rate.

**What to watch weekly, in this order:** `First client` by source → `Registered`
by source → `Visits` by source. If the first column is not moving, nothing below
it matters.

---

## 3. Strategy: conversations, not channels

The twelve content pages, the tracker and the calculator are a compounding
asset. They will not produce trainer number one — a domain with no backlinks and
no Search Console history needs two to four months before impressions mean
anything.

**Trainer one comes from a conversation.** Trainers two to ten come from being a
useful member of a room where trainers already are.

Ranked by probability of producing a real user:

| # | Channel | Why it ranks here | Needs you? |
|---|---|---|---|
| **1** | **Trainers you already know** | Warm, immediate, and they will actually reply. One hour, this week | ✅ entirely |
| **2** | **Local Croatian trainers** — gyms you can walk into | You can be in the room. Nobody else in the category is | ✅ entirely |
| **3** | **Croatian trainer Facebook groups** | The exact ICP, concentrated. **Rules unreadable from outside — join and read first** | ✅ entirely |
| **4** | **Instagram trainer accounts** | Reachable by DM, but cold and easy to get wrong. Only after a genuine interaction | ✅ entirely |
| **5** | **LinkedIn** | Works only if you already post there. A dormant profile posting a product link converts nothing | ⚠️ your call |
| **6** | **Free software directories** (Capterra, SaaSHub, AlternativeTo) | Buyer intent, but slow, and the audience is people already shopping | ✅ account |
| **7** | **Organic search** | Two to four months out. Started, correct, and not the answer today | Search Console |
| **8** | **Communities where promotion is banned** (r/personaltraining) | Participation only, no link, ever | ✅ if at all |

---

## 4. Outreach scripts

**The positioning, in every one of these:**

> I'm building a simple tool for personal trainers to manage clients, packages
> and sessions. I'm looking for a few trainers to try it free and tell me what's
> useful and what's missing.

Never: "the best", "#1", "revolutionary", "thousands of trainers", "limited
spots", "join X trainers already using". None of it is true and the audience is
small enough that being caught costs everything.

---

### 4.1 Instagram DM — Croatian

> Bok! Vidio sam da radiš kao osobni trener — ne prodajem ti ništa, pitanje je
> stvarno.
>
> Radim jednostavan alat za trenere: klijenti, paketi i koliko je treninga
> ostalo na svakom paketu. Napravio sam ga jer sam se sam umorio od toga da to
> stoji na tri mjesta.
>
> Tražim par trenera da probaju besplatno i kažu mi što fali. Nema kartice, nema
> pretplate. Ako ti se da: treniko.com
>
> Ako ne — bez brige, hvala u svakom slučaju 🙏

### 4.2 Instagram DM — English

> Hey! Saw you're a personal trainer — not selling anything, this is a real
> question.
>
> I'm building a simple tool for trainers: clients, packages, and how many
> sessions are left on each one. I built it because keeping that in three places
> drove me mad.
>
> Looking for a few trainers to try it free and tell me what's missing. No card,
> no subscription. If you're up for it: treniko.com
>
> If not, no worries at all — thanks either way.

### 4.3 Facebook message

> Hi — I'll keep this short.
>
> I've built a small tool for personal trainers to track clients, packages and
> how many sessions each client has left. It's free and there's nothing to pay
> for — there's no payment system in it at all.
>
> I'm looking for a handful of trainers to try it and tell me where it falls
> over. Would you be willing? It takes about two minutes to add one client and
> book one session, which is enough to see whether it's useful.
>
> treniko.com — and if it's not for you, that's genuinely fine.

### 4.4 LinkedIn message

> Hi [name] — I'm building TRENIKO, a tool for independent personal trainers to
> manage clients, session packages and bookings.
>
> It's early and free, and I'm looking for a few trainers to try it and tell me
> what's useful and what's missing. Not a sales message — I want to know where
> it's wrong before I go further.
>
> If that's of interest: treniko.com. Happy to answer anything.

### 4.5 Email

> **Subject:** A tool for tracking client packages — would you tell me what's wrong with it?
>
> Hi [name],
>
> I'm building TRENIKO, a simple tool for independent personal trainers:
> clients, session packages, and how many sessions each client has left.
>
> It's free — there's no payment processor in it, so there's nothing to pay and
> no card to enter. I'm looking for a few trainers to try it and tell me what's
> useful and what's missing.
>
> If you're willing, the whole thing is: add one real client, book one session.
> Two minutes, and it's enough to tell whether it fits how you work.
>
> treniko.com
>
> Either way, thanks for reading.
>
> [your name]

### 4.6 Personal introduction — someone you know

> You know how you've mentioned the admin side being a pain? I ended up building
> something for it.
>
> It's the part nobody talks about: which client has how many sessions left,
> whether they've paid, and who's about to run out.
>
> It's free and I'm not trying to sell you anything — I want to know where it
> falls over with someone who actually trains people. Add one real client, book
> one session, then tell me what annoyed you.
>
> treniko.com

### 4.7 If they reply "what does it actually do?"

> Clients, sessions and packages in one place. The bit that matters: when you
> mark a session complete, the package counts itself down and warns you before
> someone runs out.
>
> It does *not* do workout programming, nutrition or online coaching — it's the
> business side only. If you need those, it's the wrong tool and I'd rather say
> so now.

---

## 5. The daily process

**5–10 conversations a day, maximum.** Not a campaign. If it starts feeling like
volume, it has stopped working.

**Each day:**

1. Find 5–10 trainers who plausibly match the ICP — books their own clients,
   takes their own money, roughly 8–30 clients.
2. **Look at each one for thirty seconds before writing.** If you cannot name
   something specific about them, do not message them.
3. Personalise the first line. The rest of the script can stand.
4. Log it in the tracker (§ 6).
5. **One follow-up, after 5–7 days, only if they read it and did not reply.**
   Never a second.

**Rules that are not negotiable:**

- Never the same message twice in one group or one comment thread.
- Never a link where the rules forbid promotion.
- Never message someone who has already said no.
- If a group's rules ban promotion, that is permanent, not "until nobody is
  looking".

---

## 6. Tracker

`marketing/outreach/OUTREACH_TRACKER.csv` — one row per person, and no CRM.

Columns: `date, name_or_handle, channel, source_of_lead, personalised_note,
status, replied, registered, verified, added_client, notes, follow_up_due`

`status`: `contacted` → `replied` → `interested` → `registered` → `activated` →
`active` (or `declined` / `no_reply`).

**Weekly, compare the tracker against the admin funnel.** If five people say
they registered and the funnel shows two, the gap is the thing to investigate —
that is a broken registration, not a bookkeeping error.

---

## 7. Existing content → website

54 social pieces are written, 14 scheduled to mid-September, and **none of them
links to anything**. They were all written before the site had anything to link
to. Fixing that is one tap plus six destinations, and it does not touch a single
scheduled post.

| Content type | Best used for | Send to |
|---|---|---|
| Pain-point posts ("how many sessions has she got left?") | Awareness | `/free-personal-trainer-client-tracker` |
| Spreadsheet-problem posts | Problem-aware | `/guides/software-vs-spreadsheets` |
| Package/countdown demos | Product demonstration | `/` |
| Pricing posts | Problem-solving | `/personal-trainer-pricing-calculator` |
| Onboarding posts | Practical | `/guides/new-client-first-week` |
| Cancellation/no-show posts | Practical | `/guides/cancellation-policy` |

**Bio link — set once and leave it:**

```
https://treniko.com/free-personal-trainer-client-tracker?utm_source=instagram&utm_medium=social&utm_campaign=organic&utm_content=link-in-bio
```

It asks for nothing — no account, no email, no card — so a visitor who is not
ready still leaves with something, and a trainer who downloads a client tracker
has identified themselves more precisely than any targeting could. **It is now
measurable end to end:** the download click writes its own row, so tracker views
versus downloads is a real number.

Story-slot mapping for the scheduled calendar is in
`marketing/social/RESOURCE_DISTRIBUTION.md`. No dates or copy change.

---

## 8. Activation — what happens after they register

The in-product onboarding already does the right thing: a dashboard checklist
with *add a client → create a package → schedule a session*, with progress and
a direct link for each step. **It was inspected and deliberately left alone.**

What changed today is that all three steps are now *measurable*, per source. If
trainers register and stall at step one, the funnel will show it — and that is
the moment to change the onboarding, not before.

**First value is:** add one real client, book one real session, mark it
complete, watch the package count down. Roughly two minutes. That is what the
outreach asks for, and it is deliberately smaller than "try the product".

---

## 9. Measurement plan

| Metric | Where | Cadence |
|---|---|---|
| First client, by source | Admin → Funnel by source | Weekly |
| Registrations, by source | Same | Weekly |
| Visits, by source | Same | Weekly |
| Tracker views vs downloads | Admin → Most-viewed pages | Weekly |
| Outreach → registration gap | Tracker vs funnel | Weekly |
| Impressions, queries | Search Console | From ~month 2 |

**No percentage below 30 in the denominator.** The dashboard enforces this; do
not work around it in a spreadsheet.

---

## 10. Manual actions

Everything else in this document is done. These four are not, and cannot be.

| # | What | Where | Exactly | Expected result |
|---|---|---|---|---|
| **1** | **Search Console** | Cloudflare + Search Console | Add property → **Domain** → `treniko.com`. Copy the `google-site-verification=…` string. Cloudflare → `treniko.com` → **DNS → Records → Add record** → type `TXT`, name `@`, content = that string. ⚠️ **Add, do not edit** — the SPF and Brevo records must stay. Then **Verify**, then **Sitemaps** → submit `sitemap.xml` | Verified; 15 URLs discovered |
| **2** | **Instagram bio link** | Instagram app → Edit profile → Website | Paste the URL in § 7 | Profile links to the tracker; visits appear under `instagram` in the funnel |
| **3** | **Message trainers you know** | Wherever you already talk to them | Script § 4.6, personalised first line. Aim for ten | Replies. Three is a good week |
| **4** | **Cloudflare AI crawlers** | Cloudflare → `treniko.com` → Security → Bots | Turn off the blanket AI-crawler block; re-block `GPTBot`/`ClaudeBot` if you want training excluded. Reasoning in `DECISIONS_2026-08.md` § 1 | `ChatGPT-User` stops returning 403, so a trainer pasting treniko.com into ChatGPT gets an answer |

---

## 11. Seven-day plan

| Day | Do |
|---|---|
| **1** | Search Console (10 min). Instagram bio link (1 min). List 20 trainers you know or can reach warmly |
| **2** | Message 10 of them, personalised, script § 4.6. Log every one |
| **3** | Message the other 10. Reply to anything that came back — *reply the same day, always* |
| **4** | Join 3 Croatian trainer Facebook groups. Read the pinned rules. **Post nothing** |
| **5** | Capterra + GetApp + Software Advice vendor listing (copy in `DISTRIBUTION_EXECUTION_2026.md` § 5). Decline every paid upsell |
| **6** | Answer two questions in one of those groups. No link, no mention of TRENIKO |
| **7** | Read the funnel. Compare against the tracker. Write down what people actually said |

**A good week: 20 messaged, 3 replies, 1 registration, 1 first client.** One
activated trainer in week one would be a strong result, not a weak one.

---

## 12. Thirty-day plan, if ten users are not reached

They probably will not be, and that is not failure — it is the expected shape.

**Weeks 2–4:**

- 5–10 conversations a day, only where appropriate
- Participate in the Facebook groups for two weeks before mentioning TRENIKO at
  all; then only if the rules allow and someone asks
- Ask every non-replier nothing. Ask every replier the five questions in
  `FIRST_10_USERS_2026.md`
- SaaSHub and AlternativeTo listings
- Search Console: first impressions should appear around week 4

**At day 30, one of three things is true:**

1. **People register and activate.** Do more of exactly what worked. Do not add
   features.
2. **People register and stall.** The funnel will show where. Fix that one step.
   This is the best possible failure — it is specific.
3. **People do not register.** The message or the audience is wrong. **Change
   the message, not the product.** Ask the ten people who did not sign up why.

---

## 13. Stop conditions

**Stop building and go talk to trainers when any of these is true:**

- You are writing a thirteenth content page before Search Console has query data
- You are adding a feature nobody asked for
- You are optimising a conversion rate on a denominator under 30
- You are considering a redesign with no behavioural data
- You have not spoken to a trainer this week
- You are researching a channel you have not yet tried the free version of

**Resume building when:**

- A trainer used it and told you something specific was missing
- The funnel shows a stage where people consistently stop
- Search Console shows a real query that an existing page nearly answers

**The single test:** *would this change be worth doing if I already had ten
trainers?* If not, it is probably avoidance of the conversation.
