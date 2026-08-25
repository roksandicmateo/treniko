// TRENIKO — the 5-12 s product section of each Reel.
//
// Every card is a real screenshot of the running TRENIKO application, captured
// from a synthetic demo tenant (placeholder client names, reserved
// @example.com addresses, no phone numbers, no health notes, invented amounts).
// Nothing is drawn or mocked up, and no browser chrome, URL bar or operating
// system window is in shot: each source image is a page capture and only the
// named region of it is used.
//
// Regions are cropped small and enlarged ~2x on purpose. A whole desktop screen
// shrunk into a 1080-wide frame is unreadable on a phone; one enlarged fragment
// with a headline over it is not.
const B = require('./brand.js');
const {sharp, C, SW, SH, M, T, block, BLACK} = B;
const fs = require('fs');
const SHOTS = 'C:/Users/Karlo/AppData/Local/Temp/claude/C--Users-Karlo-Desktop-TRENIKO-treniko/ae79e349-0677-4877-aade-c890751bc08d/scratchpad/shots';
const OUT   = 'marketing/social/30-day/reels';

// crop regions, in the 1568x709 coordinate space of the captures
const CROP = {
  stats2:   ['dash-top',   180, 300,  610, 175],   // two stat tiles
  alert:    ['dash-top',   985, 485,  390, 150],   // package alert
  today:    ['dash-today', 250, 225,  560, 320],   // three sessions today
  clients:  ['clients',    155, 355,  760, 330],   // five clients, name + email
  calweek:  ['calendar',   190, 360, 1180, 349],   // the whole week
  cal3:     ['calendar',   395, 360,  482, 349],   // three whole days of it
  pkg:      ['pkg-zoom',   350, 283,  462,  82],   // sessions used / sessions left
  clienthd: ['client',     337, 262,  566,  88],   // client name, email, status
  billing:  ['billing',    340, 535,  660, 105],   // paid / pending / total
};

const round = (w, h, r) =>
  Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);

const CAP_SIZE = 80, CAP_LH = 1.14, TOP = 340, BOT = 1620, GAP = 120;

// Arial Black runs about 0.63 em per character. Refuse to render a caption that
// would reach the margin rather than shipping a Reel with a clipped word.
const fits = (line, size) => line.length * size * 0.63 <= SW - 2 * M;

async function card({ crop, caption, out, maxW = 1000 }) {
  const [file, x, y, w, h] = CROP[crop];
  const cardW = Math.min(maxW, Math.round(w * 2.6));
  const scale = cardW / w;
  const cardH = Math.round(h * scale);

  const ui = await sharp(`${SHOTS}/${file}.jpg`)
    .extract({ left: x, top: y, width: w, height: h })
    .resize({ width: cardW, kernel: 'lanczos3' })
    .composite([{ input: round(cardW, cardH, 24), blend: 'dest-in' }])
    .png().toBuffer();

  for (const line of caption)
    if (!fits(line, CAP_SIZE)) throw new Error(`${out}: caption line too wide -> "${line}"`);

  const capH = caption.length * CAP_SIZE * CAP_LH;
  const plate = 24;
  const groupH = capH + GAP + cardH + plate * 2;
  const capTop = Math.round(TOP + ((BOT - TOP) - groupH) / 2);
  const cardTop = Math.round(capTop + capH + GAP + plate);
  const cardX = Math.round((SW - cardW) / 2);

  if (cardTop + cardH + plate > BOT + 60) throw new Error(`${out}: overflows safe area`);

  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
    <rect width="${SW}" height="${SH}" fill="${C.tint}"/>
    ${T(M, 190, 'TRENIKO', {size:44, fam:BLACK, weight:'900', fill:C.blue, ls:3})}
    ${block(M, capTop, caption, {size:CAP_SIZE, fill:C.ink, lh:CAP_LH}).svg}
    <rect x="${cardX - plate}" y="${cardTop - plate}" width="${cardW + plate*2}" height="${cardH + plate*2}" rx="34" fill="#ffffff"/>
    <rect x="${cardX - plate}" y="${cardTop - plate}" width="${cardW + plate*2}" height="${cardH + plate*2}" rx="34" fill="none" stroke="${C.blue}" stroke-opacity="0.28" stroke-width="3"/>
  </svg>`;

  await sharp(Buffer.from(bg))
    .composite([{ input: ui, left: cardX, top: cardTop }])
    .png({ compressionLevel: 9 }).toFile(out);
  return out;
}

const PLAN = {
  'reel-01': [
    { crop:'clients',  caption:['Every client','in one list.'] },
    { crop:'clienthd', caption:['Open one.'] },
    { crop:'pkg',      caption:['Sessions and','package.'] },
  ],
  'reel-02': [
    { crop:'clienthd', caption:['Open the client.'] },
    { crop:'pkg',      caption:['Two sessions','left.'] },
    { crop:'alert',    caption:['It told you','before they ask.'] },
  ],
  'reel-03': [
    { crop:'calweek',  caption:['One calendar.'] },
    { crop:'cal3',     caption:['Move the session.'] },
    { crop:'today',    caption:['Everywhere else','already knows.'] },
  ],
  'reel-04': [
    { crop:'stats2',   caption:['Clients.','Sessions.'] },
    { crop:'calweek',  caption:['The week ahead.'] },
    { crop:'billing',  caption:['Paid, pending,','total.'] },
  ],
  'reel-05': [
    { crop:'today',    caption:['Log the session.'] },
    { crop:'billing',  caption:['Mark the payment.'] },
    { crop:'stats2',   caption:['Admin done.'] },
  ],
};

(async () => {
  for (const [dir, cards] of Object.entries(PLAN)) {
    fs.mkdirSync(`${OUT}/${dir}`, { recursive: true });
    for (let i = 0; i < cards.length; i++) {
      await card({ ...cards[i], out: `${OUT}/${dir}/frame-3-${i + 1}-product.png` });
    }
  }
  console.log('product cards rendered');
})();
