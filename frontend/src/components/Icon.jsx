/**
 * The app's icon set.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * The application used emoji as its icon system — 160 of them, across the
 * navigation, the tabs, the status markers and every empty state — while the
 * landing page shipped a proper inline SVG set. So the marketing page looked
 * like a product and the product looked like a prototype.
 *
 * Emoji are not icons: they render as a different picture on every platform,
 * they ignore `currentColor`, they do not scale with the type around them, and
 * they carry a tone that fights "this is the tool I run my business on".
 *
 * ── The rules ────────────────────────────────────────────────────────────────
 * Same drawing language as pages/landing/Landing.jsx: 24×24 box, no fill,
 * `currentColor` stroke, 1.8 width, round caps and joins. Nothing here is
 * coloured — colour comes from the text colour of whatever contains it, so an
 * icon is always legible in both themes without a second definition.
 *
 * No dependency. A named set in one file is smaller than any icon package and
 * makes "which icons does this product use" answerable by reading it.
 */

const PATHS = {
  // Navigation
  home:      <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  calendar:  <><rect x="3" y="4.5" width="18" height="16.5" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 10h18" /></>,
  clients:   <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" /><path d="M17 11.2a3 3 0 1 0-1.8-5.4" /><path d="M18.4 14.6c2 .7 3.1 2.2 3.1 4.4" /></>,
  packages:  <><path d="M12 2.8 21 7v10l-9 4.2L3 17V7z" /><path d="M3 7l9 4.2L21 7" /><path d="M12 11.2V21" /></>,
  dumbbell:  <><path d="M6.5 7v10M3.5 9v6M17.5 7v10M20.5 9v6" /><path d="M6.5 12h11" /></>,
  groups:    <><circle cx="8" cy="9" r="2.6" /><circle cx="16" cy="9" r="2.6" /><path d="M2.8 19c0-2.7 2.3-4.4 5.2-4.4s5.2 1.7 5.2 4.4" /><path d="M15 14.7c3.2-.3 6.2 1.4 6.2 4.3" /></>,
  chart:     <><path d="M3 3v18h18" /><path d="m7 15 3.5-4 3 2.6L19 7" /></>,
  more:      <><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,

  // Actions
  plus:      <><path d="M12 5v14M5 12h14" /></>,
  check:     <><path d="m4.5 12.5 5 5 10-11" /></>,
  x:         <><path d="M18 6 6 18M6 6l12 12" /></>,
  edit:      <><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" /><path d="M14.5 6.5l3 3" /></>,
  trash:     <><path d="M4 7h16" /><path d="M9 7V4.8h6V7" /><path d="M6.5 7l1 13h9l1-13" /></>,
  search:    <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  chevronL:  <><path d="m14.5 5-7 7 7 7" /></>,
  chevronR:  <><path d="m9.5 5 7 7-7 7" /></>,
  chevronD:  <><path d="m5 9.5 7 7 7-7" /></>,
  arrowR:    <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
  refresh:   <><path d="M20 11a8 8 0 1 0-.7 4.5" /><path d="M20 5v6h-6" /></>,

  // State
  alert:     <><path d="M12 3.5 22 20H2z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.4" r=".9" fill="currentColor" stroke="none" /></>,
  clock:     <><circle cx="12" cy="12" r="8.6" /><path d="M12 7.2V12l3.2 2" /></>,
  money:     <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 10.5v3M18 10.5v3" /></>,
  sun:       <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" /></>,
  moon:      <><path d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.6 8.6 0 1 0 10.2 10.2z" /></>,
  screen:    <><rect x="2.5" y="4" width="19" height="13" rx="2" /><path d="M8.5 21h7M12 17v4" /></>,
  bell:      <><path d="M6.5 9.5a5.5 5.5 0 1 1 11 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5z" /><path d="M10 18.5a2.2 2.2 0 0 0 4 0" /></>,
  note:      <><path d="M5 3.5h9.5L19 8v12.5H5z" /><path d="M14 3.5V8h5" /><path d="M8.5 12.5h7M8.5 16h4.5" /></>,
  trophy:    <><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 5.5H4.2v1.6A3.2 3.2 0 0 0 7.4 10" /><path d="M17 5.5h2.8v1.6A3.2 3.2 0 0 1 16.6 10" /><path d="M12 14v3.5M8.5 20.5h7" /></>,
  user:      <><circle cx="12" cy="8.2" r="3.6" /><path d="M4.8 20.5c0-3.7 3.2-6 7.2-6s7.2 2.3 7.2 6" /></>,
  logout:    <><path d="M14 4.5h4.5v15H14" /><path d="M10 12h9" /><path d="m13 8 4 4-4 4" /></>,
  eye:       <><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  play:      <><path d="M7 4.5 19 12 7 19.5z" /></>,
};

export const ICON_NAMES = Object.keys(PATHS);

/**
 * @param {string} name  one of ICON_NAMES
 * @param {string} className  size and colour, e.g. "h-5 w-5 text-gray-400"
 */
export default function Icon({ name, className = 'h-5 w-5', title, ...rest }) {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      // Decorative by default: the label next to an icon already says what it
      // is, and a screen reader announcing both reads everything twice.
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {path}
    </svg>
  );
}
