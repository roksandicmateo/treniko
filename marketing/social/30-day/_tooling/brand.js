// TRENIKO deterministic social renderer — see marketing/brand/BRAND_GUIDE.md
// Resolve sharp wherever it happens to be installed. It is deliberately not a
// project dependency (nothing in the app or the build imports it), so this tries
// the normal resolution first and falls back to the session scratchpad where the
// ad-hoc `npm i --no-save sharp` puts it.
const SHARP_CANDIDATES = [
  'sharp',
  'C:/Users/Karlo/AppData/Local/Temp/claude/C--Users-Karlo-Desktop-TRENIKO-treniko/74fa6a36-a671-499b-8fb2-1da70b759a87/scratchpad/node_modules/sharp',
];
let sharp;
for (const c of SHARP_CANDIDATES) {
  try { sharp = require(c); break; } catch (e) { /* try the next one */ }
}
if (!sharp) throw new Error('sharp not found. Run: npm i --no-save sharp');
const fs = require('fs');

const C = {
  blue:'#0ea5e9', blueLt:'#38bdf8', blueDk:'#0369a1', tint:'#f0f9ff',
  ink:'#111827', body:'#4b5563', muted:'#6b7280', border:'#e5e7eb',
  page:'#f9fafb', white:'#ffffff', dark:'#0b1220'
};
const W = 1080, H = 1350, M = 90;               // feed canvas + left margin
const SW = 1080, SH = 1920;                      // story/reel canvas

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const BLACK = 'Arial Black, Arial, sans-serif';
const REG   = 'Arial, Helvetica, sans-serif';

// one line of text
const T = (x,y,txt,{size=40,fam=REG,weight='normal',fill=C.ink,ls=0,anchor='start'}={}) =>
  `<text x="${x}" y="${y}" font-family="${fam}" font-size="${size}" font-weight="${weight}" letter-spacing="${ls}" fill="${fill}" text-anchor="${anchor}">${esc(txt)}</text>`;

// a block of pre-broken lines, returns {svg, bottom}
function block(x, yTop, lines, o={}) {
  const size = o.size||78, lh = o.lh||1.12, fam = o.fam||BLACK, weight = o.weight||'900';
  const fill = o.fill||C.ink, ls = o.ls||0;
  let svg='', y = yTop + size*0.80;
  for (const ln of lines) { svg += T(x,y,ln,{size,fam,weight,fill,ls}); y += size*lh; }
  return { svg, bottom: y - size*lh + size*0.28 };
}

const wordmark = (fill=C.blue, x=M, y=118) => T(x,y,'TRENIKO',{size:40,fam:BLACK,weight:'900',fill,ls:3});
const rule = (x,y,w=120,h=8,fill=C.blue) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}"/>`;
const card = (x,y,w,h,{r=24,fill=C.white,stroke=C.border,sw=2,rot=0,cx=0,cy=0}={}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${rot?` transform="rotate(${rot} ${cx||x+w/2} ${cy||y+h/2})"`:''}/>`;

// the TRENIKO mark, scaled, at (x,y) with size s
const mark = (x,y,s,{tile=C.blue,glyph=C.white,r=22}={}) =>
  `<g transform="translate(${x},${y}) scale(${s/100})">` +
  `<rect width="100" height="100" rx="${r}" fill="${tile}"/>` +
  `<rect x="19" y="28" width="62" height="16" rx="3.2" fill="${glyph}"/>` +
  `<rect x="42" y="28" width="16" height="48" rx="3.2" fill="${glyph}"/></g>`;

function page(inner, {w=W,h=H,bg=C.white}={}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${inner}</svg>`;
}
const render = (svg, out) => sharp(Buffer.from(svg)).png({compressionLevel:9}).toFile(out);

// contact-sheet helper for visual QA
async function sheet(files, out, {cols=3, cw=300, pad=18, bg='#20242c'}={}) {
  const rows = Math.ceil(files.length/cols);
  const first = await sharp(files[0]).metadata();
  const ch = Math.round(cw * first.height / first.width);
  const comps = [];
  for (let i=0;i<files.length;i++){
    const buf = await sharp(files[i]).resize(cw,ch,{fit:'contain',background:'#ffffff'}).toBuffer();
    comps.push({input:buf,left:pad+(i%cols)*(cw+pad),top:pad+Math.floor(i/cols)*(ch+pad)});
  }
  await sharp({create:{width:pad+cols*(cw+pad),height:pad+rows*(ch+pad),channels:3,background:bg}})
    .composite(comps).png().toFile(out);
  return out;
}

module.exports = { sharp, fs, C, W, H, M, SW, SH, T, block, wordmark, rule, card, mark, page, render, sheet, BLACK, REG, esc };
