// TRENIKO — Facebook Page cover.
//
// 1640 x 856 is the asset Facebook asks for. What it actually SHOWS varies:
// desktop renders roughly the full width, mobile crops the sides hard. So every
// word sits inside a centred safe band and nothing meaningful goes near the
// left or right edge — a cover whose tagline is cut in half on a phone is worse
// than no cover.
//
// Same palette, type and geometry as the rest of the brand system (brand.js):
// #0ea5e9, the geometric T, generous whitespace, no stock photography.
//
// Run from the repository root:
//   node marketing/social/30-day/_tooling/facebook-cover.js

const B = require('./brand.js');
const { C, T, block, mark, render, BLACK, REG } = B;
const fs = require('fs');

const W = 1640, H = 856;

// Facebook overlays the profile picture bottom-left on desktop and centres the
// name under it on mobile, so the lower-left quadrant is treated as unusable.
const SAFE_LEFT = 300;

const svg = () => {
  let s = '';

  // Ground: the light blue tint used across the feed assets, with a soft brand
  // wash so the flat colour does not read as unfinished.
  s += `<rect width="${W}" height="${H}" fill="${C.tint}"/>`;
  s += `<defs><linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#e0f2fe" stop-opacity="0"/>
          <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.18"/>
        </linearGradient></defs>`;
  s += `<rect width="${W}" height="${H}" fill="url(#wash)"/>`;

  // ── Layout is dictated by where Facebook puts the profile picture ──────────
  // Facebook centres the avatar over the BOTTOM-CENTRE of the cover. A first
  // version put the headline across the middle and the circle sat straight on
  // top of "Not your spreadsheets." — a cover that obscures its own tagline.
  // So everything lives in the upper band, horizontally centred, and the bottom
  // third is deliberately left empty for the avatar to occupy.
  //
  // Centring also survives the mobile crop, which takes a narrower slice from
  // the middle; a left-anchored layout would lose its first words there.
  const CX = W / 2;

  // ── The usable band is narrower than the canvas, in BOTH directions ────────
  // Facebook uploads 1640x856 but DISPLAYS a wider, shorter crop, so the top
  // and bottom of the image are cut. It also centres the profile circle over
  // the lower-middle. Measured against the live preview, what actually survives
  // is roughly y 120–460: above that is cropped away, below that the avatar
  // covers it.
  //
  // Two earlier versions were rejected against that reality — one had the
  // headline behind the circle, the next had the mark clipped off the top and
  // the feature list behind the circle. This one keeps everything inside the
  // band and drops the feature list, which was redundant anyway: it appears in
  // the Page description immediately below the cover.
  const SAFE_TOP = 120;
  const SAFE_BOTTOM = 460;

  const markSize = 76;
  const wordSize = 54;

  s += mark(CX - markSize / 2, SAFE_TOP + 30, markSize, { tile: C.blue, glyph: '#ffffff', r: 18 });
  s += T(CX, SAFE_TOP + 30 + markSize + 54, 'TRENIKO',
    { size: wordSize, fam: BLACK, weight: '900', fill: C.blue, ls: 6, anchor: 'middle' });

  const line1Y = 380;
  const line2Y = 444;
  s += T(CX, line1Y, 'Run your coaching business.',
    { size: 52, fam: BLACK, weight: '900', fill: C.ink, anchor: 'middle' });
  s += T(CX, line2Y, 'Not your spreadsheets.',
    { size: 52, fam: BLACK, weight: '900', fill: C.ink, anchor: 'middle' });

  // Fail loudly rather than ship a cover whose own words are cropped or hidden.
  if (line2Y > SAFE_BOTTOM) throw new Error('cover content falls into the cropped/avatar zone');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`;
};

const out = 'marketing/social/facebook';
fs.mkdirSync(out, { recursive: true });
render(svg(), `${out}/fb-cover.png`).then(() => {
  console.log(`facebook cover rendered: ${out}/fb-cover.png (${W}x${H})`);
});
