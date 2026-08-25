# TRENIKO — Internal Visual Guideline (marketing session)

Derived from the live product at https://treniko.com and `frontend/` source.
This is a marketing reference only. Do NOT change application branding.

## Sources of truth
| Item | Where | Value |
|---|---|---|
| Wordmark | `frontend/src/pages/DashboardLayout.jsx:90`, `pages/Login.jsx:45` | `TRENIKO` — uppercase, bold, tight tracking, primary-500 |
| App icon | `frontend/public/favicon.svg` | rounded square (20% radius), fill `#0ea5e9`, white heavy `T` |
| Theme color | `frontend/index.html` | `#0ea5e9` |
| Title / meta | live `treniko.com` `<head>` | "Treniko — Training Management for Personal Trainers" |
| Color ramp | `frontend/tailwind.config.js` | sky-based `primary` scale |

## Color
- **Primary (brand blue):** `#0ea5e9` — wordmark, accents, single focal element
- Primary light: `#38bdf8` · Primary dark: `#0284c7` / `#0369a1` · Deep: `#0c4a6e`
- Tint background: `#f0f9ff`
- **Neutrals:** page `#f9fafb` · surface `#ffffff` · text `#111827` · muted `#6b7280` · border `#e5e7eb`
- Dark surface (from dark mode): `#030712` / `#111827`
- Login screen uses a `#38bdf8 → #0369a1` gradient — permitted as an accent, not as full-bleed noise.

## Typography
- App uses the default Tailwind system sans stack (system-ui / Segoe UI / Helvetica / Arial) — a neutral grotesque.
- Marketing equivalent (Canva Free): **Inter**, or Archivo / Poppins as fallback.
- Headline: bold/extrabold, tight tracking, sentence case with hard line breaks.
- Wordmark: `TRENIKO` always uppercase, bold, letterspaced slightly.

## UI style cues to echo
- `rounded-2xl` cards (16px radius), 1px light borders, very soft shadows
- White cards on light-gray ground; generous whitespace
- Small uppercase tracked labels for section headers
- Status pills: rounded-full, tinted background + matching text

## Real product vocabulary (safe to reference — these are actual nav destinations)
Dashboard · Calendar · Trainings · Clients · Packages · Exercises · Groups · Progress

## Tone / prohibitions for this session
- SaaS-serious, not gym-motivational. No shirtless models, no dumbbell stock, no neon.
- No invented metrics, testimonials, user counts, scarcity, or "AI-powered" claims.
- All public copy in English.
