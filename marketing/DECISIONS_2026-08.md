# TRENIKO — decisions: crawlers, competitors, and what not to build

**Written:** 25 Aug 2026. Everything measured against live production.

---

## 1. AI crawlers — **CHANGE, selectively**

The last report said "Cloudflare blocks GPTBot, your decision". Testing the full
set today shows that framing was too narrow, and the narrow framing hid the part
that actually costs something.

### What is measured, not assumed

Each crawler's user agent, sent at `/personal-trainer-software`:

| Crawler | Edge | What it governs |
|---|---|---|
| Googlebot | **200** ✅ | Google Search ranking |
| Google-Extended | **200** ✅ | Gemini training — *not* Search |
| GoogleOther | **200** ✅ | Google's non-search products |
| bingbot | **200** ✅ | Bing, and Copilot grounding |
| GPTBot | **403** ❌ | ChatGPT **training** |
| ClaudeBot | **403** ❌ | Claude **training** |
| PerplexityBot | **403** ❌ | Perplexity answers |
| **OAI-SearchBot** | **403** ❌ | **ChatGPT Search results** |
| **ChatGPT-User** | **403** ❌ | **A user asking ChatGPT to open a link** |
| **Claude-User** | **403** ❌ | **A user asking Claude to open a link** |

Where the block lives: **Cloudflare's edge, not us.** Requested directly against
the origin IP, all three OpenAI agents get 200. `robots.txt` says nothing about
any AI crawler. This is a Cloudflare dashboard setting.

### Does it affect Google? **No.**

Every Google and Bing crawler passes. Search ranking, indexing and rich results
are untouched by this. Anyone claiming otherwise is guessing.

### Does it affect normal users? **Yes — and this is the part that was missed.**

The bottom three rows are not training crawlers, and lumping them in with GPTBot
is the mistake:

- **`ChatGPT-User` and `Claude-User` fire when a person asks the assistant to
  open a link.** A trainer pastes `treniko.com` into ChatGPT and asks "is this
  any good for tracking client packages?" — and gets *"I can't access that
  site."* That is a real prospective user, taking a deliberate action, being
  turned away. There is no upside to it whatsoever.
- **`OAI-SearchBot` powers ChatGPT Search results.** Blocking it means TRENIKO
  can never be cited as a source when someone asks an assistant what software a
  personal trainer should use — which is increasingly how software gets found,
  and is precisely the question TRENIKO's twelve content pages were written to
  answer.

### The trade, honestly

The block's genuine purpose is stopping content being used as **training data**.
That is a real thing to want, and it is your call, not mine — the argument for
keeping it is that the guides took real work and you may not want them absorbed
into a model for free.

But that argument only applies to the training crawlers. It does not apply to a
user clicking a link, and it does not apply to search citation.

### Recommendation

**Split the decision. Allow the user-initiated and search agents. Keep or drop
the training agents as you prefer.**

| Agent | Recommendation | Why |
|---|---|---|
| `ChatGPT-User`, `Claude-User` | **Allow** | A real person asked for the page. Blocking has no upside at all |
| `OAI-SearchBot` | **Allow** | Citation in AI search is discovery, not training |
| `PerplexityBot` | **Allow** | Same — it answers questions with citations |
| `GPTBot`, `ClaudeBot` | **Your call** | Pure training. Nothing about discovery depends on them. Defensible either way |

Concretely: Cloudflare → `treniko.com` → **Security → Bots** → turn off the
blanket AI-crawler block, then re-add a block for `GPTBot` and `ClaudeBot`
specifically if you want to keep training out.

Re-test afterwards — do not assume:

```bash
for ua in GPTBot OAI-SearchBot ChatGPT-User PerplexityBot Googlebot; do
  printf "%-16s " "$ua"
  curl -s -o /dev/null -w "%{http_code}\n" \
    -A "Mozilla/5.0 (compatible; $ua/1.0)" https://treniko.com/
done
```

**Do not "just enable everything"** without deciding the training question. And
do not change it at all if you would rather keep the content out of models —
that is a coherent position, it costs you AI-search visibility, and it costs you
nothing in Google.

---

## 2. Competitors — where TRENIKO can actually be better

Re-checked today. **Nothing copied**; the point is to find where a one-person
product beats a funded one, which is never on breadth.

| Competitor | Genuinely strong | Where TRENIKO cannot compete | The narrow gap |
|---|---|---|---|
| **ABC Trainerize** | Category leader. ~98 pages of blog archive, several posts a week | Anything broad: marketing, programming, nutrition, industry content | Their own users are asking them for session tracking *inside* packages. The admin half is a bolt-on for them and the entire product here |
| **TrueCoach** | Programming speed, clean UX | Workout building | It cannot answer "has she paid" |
| **PTminder** | All-in-one for studios | Studios, staff, rooms, class booking | Studio setup is pure overhead for a solo trainer. Time-to-first-client is the axis |
| **FitSW** | Ranks for the operational long-tails | — | Its top page is 2022 vendor documentation, ~850 words, ~60% product tour. Beatable with a platform-agnostic answer |
| **Everfit** | Free Starter tier | Free-tier competition | Differentiate on being a *business* tool, not a coaching-delivery tool |
| **TrainerStudio** | **30+ free Excel/PDF templates** — a mature free-resource hub | Out-publishing a 30-template library | **They have no calculator.** A static template cannot compute anything. This is why today's build was a calculator, not a fourth template |

### Where TRENIKO can realistically be better, and why

1. **Session and package tracking as the product, not a feature.** Every
   competitor treats "how many sessions are left" as a field on a screen. It is
   the reason TRENIKO exists. This is the only genuinely defensible position
   here.
2. **Time to first client.** No setup wizard, no rooms, no staff, no class
   portal. Two minutes from registration to a real client with a booked session.
   Nobody in the list above can say that, because their products serve
   facilities too.
3. **Solo trainers specifically, said out loud.** The pages here state who
   TRENIKO is *not* for. That filters traffic and it earns trust — competitors
   selling to gyms and solos at once cannot do it.
4. **Croatian, and reachable.** A founder who answers messages in the local
   language, in a market none of these five are working. This is a distribution
   advantage, not a product one, and it is the one most likely to produce the
   first ten users.
5. **An interactive free tool.** Live as of today, and the gap in the strongest
   competitor's free-resource strategy.

### What this rules out

- Never write a broad "fitness business" post. Trainerize publishes several a
  week with a team.
- Never compete on template count. TrainerStudio has thirty.
- Never claim feature parity. TRENIKO does not do programme delivery, nutrition
  or online coaching, and pages that pretend otherwise lose the reader at the
  first check.

---

## 3. DO NOW / DO AFTER DATA / DO NOT DO

### DO NOW — done this session

| Item | State |
|---|---|
| **Activation funnel on the admin dashboard** — accounts, verified, added-a-client, booked, package | ✅ Deployed. It reads 4 / 3 / **0** / 0 / 0 |
| **Signup count corrected** — accounts, not tenant rows; was overstating by 125% | ✅ Deployed |
| **Free pricing calculator** with sitemap, nav, footer and two contextual links | ✅ Deployed, arithmetic verified by hand |
| **Free/no-card line on the registration form**, three languages | ✅ Deployed |
| Decimal-separator fix in the calculator | ✅ Deployed |

### DO NOW — needs you, and is genuinely small

| Item | Time |
|---|---|
| Search Console: one Cloudflare TXT record | 10 min |
| Instagram bio link → the free tracker | 1 tap |
| Message trainers you already know | 1 hour |
| Cloudflare AI-crawler decision (§ 1) | 5 min |

### DO AFTER DATA

Everything here is blocked on Search Console or on a real user, and doing any of
it now means guessing twice instead of once.

- Expanding any content page — needs query data to know *which* page and *which
  way*
- Writing pages 13, 14, 15 — the three candidates in `CONTENT_HUB_2026.md`
  (client retention, managing many clients, recurring sessions) are ready and
  should wait for impressions
- Title and meta rewrites — needs CTR data
- Landing-page changes — needs behaviour to change against. Four accounts and no
  traffic is not evidence
- G2 listing — needs real reviews from real users
- Product Hunt — needs users to point at
- Croatian-language pages — a decision about who the first twenty users are

### DO NOT DO

Written down so it does not come back next month.

| | Why |
|---|---|
| **More SEO articles** | Twelve pages cover the cluster. Eleven of sixteen topics in the last brief were already covered. A second page for a covered query competes with the first |
| **"300+ directory" submissions** | Link farms. Real downside, no upside |
| **Chasing "best free tools for PTs" roundups** | Verified: they are written by competitors or affiliate-monetised. Competitor-owned ones will not list you; affiliate ones want commission, which is a paid placement |
| **Posting the product to r/personaltraining** | Rule 1 bans soliciting. It will be removed and it should be |
| **Any paid tool, listing, ad, boost or trial** | €0 is a hard constraint |
| **Redesigning the landing page** | No behavioural data exists to redesign against |
| **Asking for reviews before there are users** | A review from a non-user is fabricated, whoever writes it |
| **Building the other three free resources** | Onboarding checklist, policy generator, progress template all scored below the calculator. Build the next one when the first shows it earns attention |
| **A second content batch for Instagram** | 54 pieces are written and none has finished publishing |
