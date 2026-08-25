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

Ranked by probability of producing a real user. Croatian channels are
researched in detail in `marketing/CROATIA_ACQUISITION_2026.md`, including a public
directory of ~150 independent Croatian trainers and how to recognise the target
profile from a public Instagram bio.

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

### 4.7 Croatian Instagram DM — shorter variant

For an account where the longer message would read as a wall of text.

> Ej! Radim jednostavan alat za trenere — klijenti, paketi i koliko je treninga
> ostalo na svakom. Tražim par trenera da probaju i kažu mi što fali. Besplatno,
> bez kartice. Zanima te?

### 4.8 "What does it actually do?"

> Clients, sessions and packages in one place. The bit that matters: when you
> mark a session complete, the package counts itself down and warns you before
> someone runs out.
>
> It does *not* do workout programming, nutrition or online coaching — it's the
> business side only. If you need those, it's the wrong tool and I'd rather say
> so now.

**Croatian:**

> Klijenti, treninzi i paketi na jednom mjestu. Bitan dio: kad označiš trening
> kao odrađen, paket se sam odbroji i javi ti prije nego klijentu istekne.
>
> Ne radi programe treninga ni prehranu — to je poslovna strana. Ako ti trebaju
> programi, nije pravi alat i radije ću ti to odmah reći.

### 4.9 "I'm interested"

Do not send a tour. Send the smallest possible first step.

> Great — here's the whole thing:
>
> 1. treniko.com → sign up (email and password, no card)
> 2. Add one client you actually train
> 3. Book one session with them
>
> Two minutes. Then tell me what was confusing or annoying — that's the part
> I actually need.
>
> If you get stuck anywhere, message me and I'll fix it.

**Croatian:**

> Super — evo cijele stvari:
>
> 1. treniko.com → registracija (email i lozinka, bez kartice)
> 2. Dodaj jednog klijenta kojeg stvarno treniraš
> 3. Upiši mu jedan trening
>
> Dvije minute. Onda mi reci što ti je bilo zbunjujuće ili naporno — to mi
> zapravo treba.
>
> Ako zapneš bilo gdje, javi mi pa ću popraviti.

### 4.10 "How much does it cost?"

> Nothing. There's no payment system in it at all — no card field, nothing to
> enter.
>
> To be straight with you: that won't be true forever. At some point there'll be
> a paid plan. If that happens I'll tell you before it does, and you'll be able
> to export everything or delete the account either way.

**Croatian:**

> Ništa. Nema sustava naplate u aplikaciji — nema polja za karticu, nema se što
> upisati.
>
> Da budem iskren: to neće biti zauvijek. Jednom će postojati plaćeni plan. Ako
> se to dogodi, javit ću ti prije, i u svakom slučaju možeš izvesti sve podatke
> ili obrisati račun.

### 4.11 "I already use Excel / Google Sheets"

**Do not argue.** For a lot of trainers the sheet never stops being enough, and
saying so is what makes the rest credible.

> Honestly? Keep it. For a lot of trainers a sheet never stops being enough —
> it's free, it's yours, and nobody can change its pricing.
>
> It starts costing you at one specific point: when the calendar and the sheet
> disagree about what happened and you have to work out which one is lying.
>
> If you're nowhere near that, you don't need this. If you're curious, I wrote
> the honest comparison including where the sheet wins:
> treniko.com/guides/software-vs-spreadsheets
>
> And there's a free tracker there too, no signup — even if you never use
> TRENIKO: treniko.com/free-personal-trainer-client-tracker

### 4.12 "I already use Trainerize / TrueCoach / [competitor]"

> Then you probably don't need this, and I'd rather say that than pitch you.
>
> One honest question though: does it tell you *before* a client's block runs
> out, or do you check? That's the one thing TRENIKO is actually built around —
> the rest of it is deliberately smaller than what you're using.
>
> If yours handles that fine, you're sorted. If it doesn't, I'd genuinely like
> to hear how you work around it.

*Why this works: it concedes immediately, asks one specific question the
competitor genuinely handles poorly, and treats "no" as a real answer. If they
answer the question you have learned something either way.*

### 4.13 "I don't have time to test another tool"

> Completely fair — and that's usually the right instinct.
>
> I'm not asking you to migrate anything. One client, one session, two minutes,
> and then tell me it's not worth it. That answer is useful to me too.
>
> If two minutes is still too much this week, that's a genuine no and I won't
> follow up.

**Croatian:**

> Skroz fer — i to je obično dobar instinkt.
>
> Ne tražim da ništa prebacuješ. Jedan klijent, jedan trening, dvije minute, i
> onda mi slobodno reci da ne valja. I taj odgovor mi koristi.
>
> Ako su i dvije minute previše ovaj tjedan, to je pravi ne i neću te više
> gnjaviti.

### 4.14 Follow-up — once, 5–7 days later, never twice

Only if they read it and did not reply.

> Hey — just closing the loop on this, no pressure at all. If it's not relevant,
> genuinely no problem and I won't message again.
>
> If it is, the link's here: treniko.com

**Croatian:**

> Ej — samo zatvaram krug, bez pritiska. Ako ti nije zanimljivo, skroz ok i
> neću više pisati.
>
> Ako je: treniko.com

### 4.15 Email to a Croatian trainer education provider

Cold, from you, to an organisation. **Not sendable by me.**

> **Subject:** Besplatni alati za vaše polaznike (bez naplate, bez registracije)
>
> Poštovani,
>
> Radim TRENIKO — jednostavan alat za osobne trenere za vođenje klijenata,
> paketa i termina.
>
> Ne pišem zbog prodaje. Napravio sam dvije besplatne stvari koje bi mogle
> koristiti vašim polaznicima kad krenu samostalno raditi:
>
> · tablica za praćenje klijenata i paketa (Excel/Google Sheets, bez
>   registracije): treniko.com/free-personal-trainer-client-tracker
> · kalkulator cijene paketa: treniko.com/personal-trainer-pricing-calculator
>
> Oboje je besplatno, ne traži e-mail ni karticu, i korisno je bez obzira
> koriste li TRENIKO ili ne.
>
> Ako mislite da bi polaznicima bilo od koristi, slobodno podijelite. Ako ne,
> hvala na vremenu.
>
> Lijep pozdrav,
> [ime]

*No backlink request, no affiliate offer, no commission. If they share it, they
share it.*

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

## 8a. The pipeline

One row per person. Template at `marketing/outreach/OUTREACH_TRACKER.csv`; the
columns map onto the funnel stages so the two can be compared weekly.

| Person | Source | Contacted | Replied | Interested | Registered | Verified | First client | First package | First booking | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| *(example — do not commit real people)* | fitness-treneri.hr | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | | | Wants group sessions |

⚠️ **Never commit real names, handles or contact details.** The CSV in the repo
is a header row and nothing else. Keep the filled-in version locally, and delete
a person's row when they ask.

---

## 8b. Instagram bio — exact text

The single highest-impact manual action, and it takes under a minute.

**Name field** (this one is searchable inside Instagram, so it carries the
keywords, not the handle):

```
TRENIKO · Softver za trenere
```

**Bio** — four lines, answering what/who/problem/next:

```
Vođenje klijenata, paketa i termina — na jednom mjestu.
Za osobne trenere koji sami vode svoj posao.
Znaj točno koliko je treninga ostalo na svakom paketu.
↓ Besplatna tablica za praćenje klijenata
```

**Link:**

```
https://treniko.com/free-personal-trainer-client-tracker?utm_source=instagram&utm_medium=social&utm_campaign=organic&utm_content=link-in-bio
```

**Why the tracker and not the homepage:** it asks for nothing — no account, no
email, no card — so a profile visitor who is not ready to sign up still leaves
with something, and a trainer who downloads a client tracker has identified
themselves more precisely than any targeting could. The page then explains
honestly where a spreadsheet stops working and links onward. And it is now
measurable end to end: the download click writes its own row, so tracker views
versus downloads is a real number rather than an assumption.

**Facebook Page:** same URL with `utm_source=facebook`. Leave the existing Page
CTA button alone — it already carries `utm_content=page-cta`.

---

## 8c. The three existing pieces that should drive the funnel

From the 54 already written. **No new content, no changes to anything already
published or scheduled** — only destinations for pieces that currently have
none.

### 1. "How many sessions has she got left? Ten seconds. Go."

| | |
|---|---|
| **Format** | Single image · pain |
| **Audience** | Trainers selling blocks of sessions |
| **Problem** | The number lives in three places and none of them agrees |
| **CTA** | "Free tracker in bio if you want one place that does" |
| **Destination** | `/free-personal-trainer-client-tracker` |
| **UTM** | `?utm_source=instagram&utm_medium=social&utm_campaign=organic&utm_content=post-sessions-left` |
| **Funnel step** | Awareness → visit → download |

*The strongest piece written. It is the exact sentence the product exists to
answer, and it needs no knowledge of TRENIKO to land.*

### 2. The countdown Reel — 15 seconds of the formula working

| | |
|---|---|
| **Format** | Reel · product demonstration |
| **Audience** | Trainers who already know the problem |
| **Problem** | Hand-maintained counts drift |
| **CTA** | "Free spreadsheet, link in bio. Works in Excel and Google Sheets" |
| **Destination** | `/free-personal-trainer-client-tracker` |
| **UTM** | `…&utm_content=reel-countdown` |
| **Funnel step** | Consideration → visit → download → registration |

*The only format with any chance of reaching a non-follower — the account's
non-follower reach is currently 0%.*

### 3. "Price your packages so they're simple to explain"

| | |
|---|---|
| **Format** | Carousel · practical |
| **Audience** | Trainers setting or raising prices |
| **Problem** | The session rate ignores prep, travel and messages |
| **CTA** | "Free calculator, no signup — link in bio" |
| **Destination** | `/personal-trainer-pricing-calculator` |
| **UTM** | `…&utm_content=carousel-pricing` |
| **Funnel step** | Awareness → visit → tool use |

*The calculator is the most linkable and most shareable asset on the site, and
this is the only scheduled piece that leads naturally into it.*

**Every UTM above lands in the funnel by campaign**, so within a few weeks the
dashboard will say which of the three actually produced a registration — rather
than which got the most likes.

---

## 8d. Referral loop — investigated, not built

**Verdict: document, do not build. Not yet.**

Every referral mechanism worth having depends on a client-facing surface —
a booking confirmation, a session summary, a shared package page, a "powered by
TRENIKO" footer that a client would actually see.

**No such surface exists.** Checked directly: there is no client login, no client
portal, no public share token, no client-facing route of any kind. Clients exist
only as records a trainer reads.

So the honest options are:

| Loop | Requires | Verdict |
|---|---|---|
| Client sees a branded booking confirmation | A client-facing surface + email sending to clients | **Large feature.** Not for a product with zero acquired trainers |
| Trainer shares a client's package summary | A public share token, and a privacy decision about client data on a public URL | **Not now.** The privacy question alone outweighs the benefit at this stage |
| "Powered by TRENIKO" | Something a client sees | Blocked by the same absence |
| Trainer invites another trainer | An invite flow | Real, small — **and pointless with zero trainers to do the inviting** |
| **Free resource → registration** | Nothing. It already exists | ✅ **Live.** The tracker and calculator are the loop that works today |

Building a viral feature before a single trainer has been acquired is exactly the
premature work this sprint was told to avoid. **Revisit when there are five
active trainers** — at which point ask them whether they would send it to
another trainer, and build whatever they say instead of guessing now.

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
| **2** | **Instagram bio + link** | Instagram app → Edit profile | Name field, bio and link — exact text in **§ 8b** | Profile answers what/who/problem/next; visits appear under `instagram` in the funnel |
| **3** | **Message trainers you know** | Wherever you already talk to them | Script § 4.6, personalised first line. Aim for ten | Replies. Three is a good week |
| **5** | **Email 3 trainer education providers** | HFS Academy, Fitnes učilište, Flexyfit | Script § 4.15. Offers the two free resources, asks for nothing | Their students get a useful resource; some may share it |
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
