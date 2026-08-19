/**
 * Generates the static brand assets that live in frontend/public/.
 *
 * These are committed build outputs, not runtime code: the landing page and the
 * social scrapers need real raster files at fixed URLs, and regenerating them on
 * every build would be pointless churn. Run this only when the brand or the
 * positioning line changes, then commit the PNGs it writes.
 *
 *   npm i --no-save sharp && node scripts/generate-brand-assets.mjs
 *
 * `sharp` is deliberately NOT a project dependency — nothing in the app or the
 * build imports it, and adding a native module to the frontend install for a
 * once-a-quarter script is a bad trade.
 *
 * Colours and the mark geometry are the ones in marketing/brand/BRAND_GUIDE.md,
 * kept in sync by hand with marketing/social/30-day/_tooling/brand.js.
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const BLUE = '#0ea5e9';
const INK = '#111827';
const BODY = '#4b5563';
const BORDER = '#e5e7eb';
const TINT = '#f0f9ff';

const BLACK_FAMILY = 'Arial Black, Arial Bold, Arial, sans-serif';
const REG_FAMILY = 'Arial, Helvetica, sans-serif';

/** The TRENIKO mark: a rounded blue tile with a white T. */
const mark = (x, y, s, r = 22) =>
  `<g transform="translate(${x},${y}) scale(${s / 100})">` +
  `<rect width="100" height="100" rx="${r}" fill="${BLUE}"/>` +
  `<rect x="19" y="28" width="62" height="16" rx="3.2" fill="#ffffff"/>` +
  `<rect x="42" y="28" width="16" height="48" rx="3.2" fill="#ffffff"/></g>`;

// ── 1200x630 Open Graph / Twitter card ───────────────────────────────────────
// No people, no numbers, no claims that are not on the site itself.
//
// The right-hand tint panel starts at x=880, so every line of copy has to end
// before that or it is clipped — which is exactly how the first render of this
// file failed, and how the Facebook cover failed three times before it. The
// guard below refuses to emit an image whose text would cross the boundary
// rather than leaving it to be spotted by eye.
const PANEL_X = 880;
const SAFE_RIGHT = PANEL_X - 24;
const TEXT_X = 80;

// Mean advance width per character, as a fraction of the font size. Measured
// against the rendered output for these two families, and deliberately
// pessimistic so the guard trips early rather than late.
const ADVANCE = { black: 0.66, regular: 0.52 };

const lines = [];
const line = (y, text, { size, family = 'black', fill = INK, weight = '900', ls = 0 }) => {
  const width = text.length * size * ADVANCE[family] + ls * text.length;
  if (TEXT_X + width > SAFE_RIGHT) {
    throw new Error(
      `OG copy overflows the safe area: "${text}" is about ${Math.round(width)}px ` +
      `at ${size}px, which reaches x=${Math.round(TEXT_X + width)} (limit ${SAFE_RIGHT}). ` +
      `Shorten the line or reduce the size.`
    );
  }
  lines.push(
    `<text x="${TEXT_X}" y="${y}" font-family="${family === 'black' ? BLACK_FAMILY : REG_FAMILY}" ` +
    `font-size="${size}" font-weight="${weight}" letter-spacing="${ls}" fill="${fill}">${text}</text>`
  );
};

line(122, 'TRENIKO', { size: 34, ls: 4 });
line(264, 'Run your coaching', { size: 50 });
line(324, 'business.', { size: 50 });
line(384, 'Not your spreadsheets.', { size: 50, fill: BLUE });
line(504, 'Clients, sessions, packages and payments', { size: 26, family: 'regular', weight: 'normal', fill: BODY });
line(542, 'in one place.', { size: 26, family: 'regular', weight: 'normal', fill: BODY });
line(598, 'treniko.com', { size: 24, family: 'black', fill: BLUE, ls: 1 });

const ogSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <rect x="0" y="0" width="1200" height="10" fill="${BLUE}"/>
  <rect x="${PANEL_X}" y="0" width="${1200 - PANEL_X}" height="630" fill="${TINT}"/>

  ${mark(TEXT_X, 74, 60)}
  ${lines.join('\n  ').replace(`<text x="80" y="122"`, `<text x="164" y="122"`)}

  <rect x="${TEXT_X}" y="434" width="120" height="8" rx="4" fill="${BLUE}"/>

  <!-- an abstract nod to the product surface: a list of session rows -->
  <rect x="912" y="168" width="256" height="80" rx="16" fill="#ffffff" stroke="${BORDER}" stroke-width="2"/>
  <rect x="934" y="192" width="8"  height="32" rx="4" fill="${BLUE}"/>
  <rect x="956" y="196" width="128" height="11" rx="5" fill="#d1d5db"/>
  <rect x="956" y="216" width="82"  height="9"  rx="4" fill="#e5e7eb"/>

  <rect x="912" y="268" width="256" height="80" rx="16" fill="#ffffff" stroke="${BORDER}" stroke-width="2"/>
  <rect x="934" y="292" width="8"  height="32" rx="4" fill="#22c55e"/>
  <rect x="956" y="296" width="150" height="11" rx="5" fill="#d1d5db"/>
  <rect x="956" y="316" width="66"  height="9"  rx="4" fill="#e5e7eb"/>

  <rect x="912" y="368" width="256" height="80" rx="16" fill="#ffffff" stroke="${BORDER}" stroke-width="2"/>
  <rect x="934" y="392" width="8"  height="32" rx="4" fill="#f59e0b"/>
  <rect x="956" y="396" width="112" height="11" rx="5" fill="#d1d5db"/>
  <rect x="956" y="416" width="96"  height="9"  rx="4" fill="#e5e7eb"/>
</svg>`;

// ── Icons ────────────────────────────────────────────────────────────────────
const iconSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${BLUE}"/>
  <rect x="19" y="28" width="62" height="16" rx="3.2" fill="#ffffff"/>
  <rect x="42" y="28" width="16" height="48" rx="3.2" fill="#ffffff"/>
</svg>`;

const png = (svg, out) =>
  sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(join(OUT, out));

await png(ogSvg, 'og-image.png');
await png(iconSvg(180), 'apple-touch-icon.png');
await png(iconSvg(96), 'favicon-96.png');

console.log('wrote og-image.png, apple-touch-icon.png, favicon-96.png to', OUT);
