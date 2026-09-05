// TRENIKO — September 2026 visual system.
//
// Extends the existing deterministic renderer (`marketing/social/30-day/_tooling`)
// with the two templates this campaign needs and the cycle-1 system did not
// have as a reusable piece: a product card built around a real screenshot, and
// a story frame in the same type system.
//
// Nothing here draws a fake user interface. Every product image is a region of
// an actual capture of the running application (see `crops.js`), placed on a
// branded ground and enlarged so it is legible on a phone.
//
// Requires sharp. If it is not resolvable, run with:
//   NODE_PATH=<scratchpad>/node_modules node ...
const B = require('../../social/30-day/_tooling/brand.js');
const TPL = require('../../social/30-day/_tooling/tpl.js');
const { sharp, C, W, H, M, SW, SH, T, block, wordmark, rule, card, mark, page, render, BLACK, REG } = B;
const fs = require('fs');

const CROPS = 'marketing/september-2026/screenshots/crops';

const mk = (p) => { fs.mkdirSync(p, { recursive: true }); return p; };

// ── shared type rules ────────────────────────────────────────────────────────
// Arial Black runs about 0.63 em per character; Arial regular about 0.52. A
// line that would reach the margin is a bug, not a style, so refuse to render it
// rather than ship a clipped word.
const fitsBlack = (line, size, width = W - 2 * M) => line.length * size * 0.63 <= width;
const fitsReg = (line, size, width = W - 2 * M) => line.length * size * 0.52 <= width;
function assertFits(lines, size, { black = true, width = W - 2 * M, where = '' } = {}) {
  for (const l of lines) {
    const ok = black ? fitsBlack(l, size, width) : fitsReg(l, size, width);
    if (!ok) throw new Error(`line too long for ${size}px${where ? ' in ' + where : ''}: "${l}"`);
  }
}

const roundMask = (w, h, r) =>
  Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);

// A real screenshot region, resized to `width`, corners rounded, hairline frame.
// `keep` takes the top fraction of a very tall capture (the week calendar is
// 1 : 1.24 portrait and would otherwise crowd out the headline). Nothing is
// stretched and nothing is composited in: it is still one contiguous region of
// one capture.
async function shot(name, width, { radius = 26, keep = 1, keepX = 1, cropTop = 0, trim = true } = {}) {
  let src = `${CROPS}/${name}.png`;
  // A card's own container often carries page padding, which lands in the crop
  // as a band of empty ground. Trim the uniform border away first, then measure:
  // the alternative is a product card that floats in a white margin.
  if (trim) {
    const trimmed = await sharp(src).trim({ threshold: 8 }).png().toBuffer();
    const tm = await sharp(trimmed).metadata();
    const om = await sharp(src).metadata();
    // Refuse a trim that ate the card: only accept a modest reduction.
    if (tm.width >= om.width * 0.7 && tm.height >= om.height * 0.5) src = trimmed;
  }
  const meta = await sharp(src).metadata();
  let pipeline = sharp(src);
  const srcW = Math.round(meta.width * keepX);
  const top = Math.round(meta.height * cropTop);
  const srcH = Math.min(Math.round(meta.height * keep), meta.height - top);
  if (keep < 1 || keepX < 1 || cropTop > 0) {
    pipeline = pipeline.extract({ left: 0, top, width: srcW, height: srcH });
  }
  const height = Math.round(srcH * (width / srcW));
  const img = await pipeline
    .resize({ width, kernel: 'lanczos3' })
    .composite([{ input: roundMask(width, height, radius), blend: 'dest-in' }])
    .png().toBuffer();
  return { buf: img, width, height };
}

// ── FEED: headline over a product screenshot (1080 × 1350) ───────────────────
async function productFeed({ out, lines, size = 68, support = [], cta = '', crop, cropWidth = 900,
                             keep = 1, keepX = 1, cropTop = 0, bg = C.page, accent = C.blue, top = 250 }) {
  assertFits(lines, size, { where: out });
  const s = await shot(crop, cropWidth, { keep, keepX, cropTop });
  const head = block(M, top, lines, { size, fill: C.ink });
  let svg = wordmark(accent);
  svg += head.svg;
  let y = head.bottom + 34;
  svg += rule(M, y, 110, 8, accent);
  y += 8;
  if (support.length) {
    const sb = block(M, y + 52, support, { size: 36, fam: REG, weight: 'normal', fill: C.body, lh: 1.35 });
    svg += sb.svg; y = sb.bottom;
  }
  const zoneTop = Math.round(y + 60);
  const zoneBottom = cta ? H - 190 : H - 110;
  const room = zoneBottom - zoneTop;
  if (s.height > room) throw new Error(`screenshot too tall for ${out}: ${s.height} > ${room}`);
  const imgTop = Math.round(zoneTop + (room - s.height) / 2);
  const imgLeft = Math.round((W - s.width) / 2);
  // The card sits on a soft plate so a white UI does not dissolve into the page.
  svg += card(imgLeft - 18, imgTop - 18, s.width + 36, s.height + 36, { r: 34, fill: C.white, stroke: C.border, sw: 2 });
  if (cta) svg += T(M, H - 96, cta, { size: 34, fam: BLACK, weight: '900', fill: accent });
  const base = page(svg, { bg });
  await sharp(Buffer.from(base))
    .composite([{ input: s.buf, left: imgLeft, top: imgTop }])
    .png({ compressionLevel: 9 }).toFile(out);
  return out;
}

// ── FEED: a screenshot as the whole hero, one line of type over it ───────────
async function heroFeed({ out, lines, size = 62, crop, cropWidth = 980, keep = 1, keepX = 1, cropTop = 0, bg = C.tint, accent = C.blue, cta = '' }) {
  assertFits(lines, size, { where: out });
  const s = await shot(crop, cropWidth, { keep, keepX, cropTop });
  const head = block(M, 250, lines, { size, fill: C.ink });
  let svg = wordmark(accent) + head.svg;
  const imgTop = Math.round((H - s.height) / 2 + 90);
  if (imgTop < head.bottom + 50) throw new Error(`no room for the screenshot in ${out}`);
  svg += card(M - 18, imgTop - 18, s.width + 36, s.height + 36, { r: 34, fill: C.white, stroke: C.border, sw: 2 });
  if (cta) svg += T(M, H - 96, cta, { size: 34, fam: BLACK, weight: '900', fill: accent });
  await sharp(Buffer.from(page(svg, { bg })))
    .composite([{ input: s.buf, left: M, top: imgTop }])
    .png({ compressionLevel: 9 }).toFile(out);
  return out;
}

// ── STORY: statement frame (1080 × 1920) ─────────────────────────────────────
function storyFrame({ out, lines, size = 84, support = [], footer = '', bg = C.white,
                      ink = C.ink, accent = C.blue }) {
  assertFits(lines, size, { width: SW - 2 * M, where: out });
  let svg = T(M, 190, 'TRENIKO', { size: 40, fam: BLACK, weight: '900', fill: accent, ls: 3 });
  const head = block(M, 430, lines, { size, fill: ink });
  svg += head.svg;
  let y = head.bottom + 44;
  svg += rule(M, y, 120, 8, accent);
  y += 8;
  if (support.length) {
    const sb = block(M, y + 66, support, { size: 42, fam: REG, weight: 'normal',
      fill: bg === C.ink ? '#cbd5e1' : C.body, lh: 1.4 });
    svg += sb.svg;
  }
  if (footer) svg += T(M, SH - 190, footer, { size: 38, fam: BLACK, weight: '900', fill: accent });
  return render(page(svg, { w: SW, h: SH, bg }), out);
}

// ── STORY: a poll or this-or-that frame, drawn as the sticker will sit ───────
function storyPoll({ out, question, options, note = '', bg = C.tint, accent = C.blue }) {
  assertFits(question, 76, { width: SW - 2 * M, where: out });
  let svg = T(M, 190, 'TRENIKO', { size: 40, fam: BLACK, weight: '900', fill: accent, ls: 3 });
  const head = block(M, 470, question, { size: 76, fill: C.ink });
  svg += head.svg;
  let y = head.bottom + 90;
  // Empty slots, sized and spaced for the real sticker that goes over them in
  // the app. They are placeholders on purpose: a drawn poll cannot be voted on.
  options.forEach(() => {
    svg += card(M, y, SW - 2 * M, 132, { r: 28, fill: C.white, stroke: C.border, sw: 3 });
    y += 160;
  });
  if (note) svg += T(M, SH - 190, note, { size: 36, fam: REG, fill: C.muted });
  return render(page(svg, { w: SW, h: SH, bg }), out);
}

// ── STORY: product frame — screenshot on a branded ground ────────────────────
async function storyProduct({ out, lines, size = 72, crop, cropWidth = 900, keep = 1, keepX = 1, cropTop = 0, footer = '',
                              bg = C.page, accent = C.blue }) {
  assertFits(lines, size, { width: SW - 2 * M, where: out });
  const s = await shot(crop, cropWidth, { keep, keepX, cropTop });
  let svg = T(M, 190, 'TRENIKO', { size: 40, fam: BLACK, weight: '900', fill: accent, ls: 3 });
  const head = block(M, 400, lines, { size, fill: C.ink });
  svg += head.svg;
  const imgTop = Math.round(Math.max(head.bottom + 110, (SH - s.height) / 2));
  if (imgTop + s.height > SH - 260) throw new Error(`screenshot too tall for ${out}`);
  svg += card(M - 18, imgTop - 18, s.width + 36, s.height + 36, { r: 34, fill: C.white, stroke: C.border, sw: 2 });
  if (footer) svg += T(M, SH - 190, footer, { size: 38, fam: BLACK, weight: '900', fill: accent });
  await sharp(Buffer.from(page(svg, { w: SW, h: SH, bg })))
    .composite([{ input: s.buf, left: M, top: imgTop }])
    .png({ compressionLevel: 9 }).toFile(out);
  return out;
}

// ── FACEBOOK: 1200 × 1500, the same design at the platform's ratio ───────────
// 4:5 like the feed asset, so nothing is re-laid-out — only resampled.
async function facebook(from, to) {
  await sharp(from).resize({ width: 1200, height: 1500, fit: 'fill', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 }).toFile(to);
  return to;
}

module.exports = { ...TPL, B, C, W, H, M, SW, SH, mk, render, productFeed, heroFeed,
                   storyFrame, storyPoll, storyProduct, facebook, shot, assertFits };
