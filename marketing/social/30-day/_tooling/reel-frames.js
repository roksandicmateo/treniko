// TRENIKO — Reel frames, render-ready (no production timing labels).
// Same type, margins, colour and wordmark as the storyboard frames in reels.js.
// Two differences, both because these are now video frames and not storyboards:
//   1. the "0-2 SEC * HOOK" production label is dropped - internal wording must
//      never appear in a published Reel;
//   2. the headline block is optically centred in the safe band instead of
//      sitting at a fixed y=560, so the lower half is not dead space in motion.
const B = require('./brand.js');
const {C, SW, SH, M, T, block, rule, render, BLACK, REG} = B;
const fs = require('fs');
const R = 'marketing/social/30-day/reels';
const mk = p => { fs.mkdirSync(p, {recursive:true}); return p; };

const TOP = 400;    // below the wordmark
const BOT = 1560;   // above the Instagram caption/UI zone

function frame({lines, size=92, support=[], cta='', bg=C.white, ink=C.ink, body=C.body, accent=C.blue, wm=C.blue}) {
  // measure the stack first so it can be centred
  const lh = 1.12;
  let h = lines.length * size * lh - size * (lh - 1) + 56 + 10;      // headline + gap + rule
  if (support.length) h += 74 + support.length * 46 * 1.4;
  if (cta) h += 120;
  const yTop = Math.round(TOP + ((BOT - TOP) - h) / 2);

  let s = T(M, 190, 'TRENIKO', {size:44, fam:BLACK, weight:'900', fill:wm, ls:3});
  const hb = block(M, yTop, lines, {size, fill:ink});
  s += hb.svg;
  let y = hb.bottom + 56;
  s += rule(M, y, 140, 10, accent);
  y += 10;
  if (support.length) { s += block(M, y + 64, support, {size:46, fam:REG, weight:'normal', fill:body, lh:1.4}).svg; y += 64 + support.length*46*1.4; }
  if (cta) s += T(M, y + 110, cta, {size:52, fam:BLACK, weight:'900', fill:accent});
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}"><rect width="${SW}" height="${SH}" fill="${bg}"/>${s}</svg>`;
}
const dark = {bg:C.ink, ink:'#ffffff'};

const REELS = {
  'reel-01': {
    hook: {lines:['Still running','your PT business','from WhatsApp','and spreadsheets?'], size:80},
    pain: {lines:['Five apps.','One client.'], size:104, bg:C.tint},
    cta:  {lines:['Less admin.','More coaching.'], size:96, ...dark, cta:'treniko.com'},
  },
  'reel-02': {
    hook: {lines:['Your client just','asked how many','sessions they','have left.'], size:80},
    pain: {lines:['Go. Ten seconds.'], size:100, bg:C.tint},
    cta:  {lines:['One place.','Four seconds.'], size:100, ...dark, cta:'treniko.com'},
  },
  'reel-03': {
    hook: {lines:['POV: one','reschedule means','updating three','apps.'], size:82},
    pain: {lines:['Every. Single.','Time.'], size:104, bg:C.tint},
    cta:  {lines:['Move it once.'], size:104, ...dark, cta:'treniko.com'},
  },
  'reel-04': {
    hook: {lines:['What running','a PT business','should actually','look like.'], size:82},
    pain: {lines:['Not this many','tabs.'], size:100, bg:C.tint},
    cta:  {lines:['Clients. Sessions.','Payments.','Progress.'], size:82, ...dark, cta:'treniko.com'},
  },
  'reel-05': {
    hook: {lines:['You are not','disorganised.','Your tools are.'], size:88},
    pain: {lines:['Admin after','the last session','ends.'], size:88, bg:C.tint},
    cta:  {lines:['Free for','early adopters.'], size:96, ...dark, cta:'treniko.com'},
  },
};

(async () => {
  for (const [dir, r] of Object.entries(REELS)) {
    const d = mk(`${R}/${dir}`);
    await render(frame(r.hook), `${d}/frame-1-hook.png`);
    await render(frame(r.pain), `${d}/frame-2-pain.png`);
    await render(frame(r.cta),  `${d}/frame-4-cta.png`);
  }
  console.log('reel frames rendered (no timing labels)');
})();
