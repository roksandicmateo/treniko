// TRENIKO — P11–P20 feed posts (week 3 + 4 of the 30-day calendar).
// Deliberately varied layouts: flow diagram, app fragments, checklist cards,
// before/after, big numeral, scatter, two-column compare, conceptual diagram.
// Product claims are verified against the codebase:
//   - nav items            frontend/src/locales/en.json  -> nav
//   - dashboard tiles      frontend/src/locales/en.json  -> dashboard
//   - packages count down  backend/controllers/sessionsController.js (sessions_used)
//   - package alerts <= 2  backend/controllers/dashboardController.js
//   - payments             backend/routes/payments.js (amount, status, method)
// No person names, no invented numbers, no invented features.
const {compose, hookBody, stackBody, numberBody, statement, B} = require('./tpl.js');
const U = require('./ui.js');
const {C,W,H,M,T,block,render,card,mark,rule,page,BLACK,REG} = B;
const fs = require('fs');
const mk = p => { fs.mkdirSync(p, {recursive:true}); return p; };
const R = 'marketing/social/30-day/posts';

// crude width guard so nothing silently runs off the canvas
const warn = [];
function chk(txt, size, fam, avail) {
  const w = txt.length * size * (fam === BLACK ? 0.66 : 0.54);
  if (w > avail) warn.push(txt + '  (~' + Math.round(w) + 'px / ' + avail + ')');
}

// ---- local helpers -------------------------------------------------------
function titled(titleLines, body, {titleSize=62, gap=54, fill=C.ink} = {}) {
  titleLines.forEach(l => chk(l, titleSize, BLACK, W - 2*M));
  const h = block(M, 0, titleLines, {size:titleSize, fill});
  return { svg: h.svg + '<g transform="translate(0,' + Math.round(h.bottom + gap) + ')">' + body.svg + '</g>',
           height: h.bottom + gap + body.height };
}
const shot = (o, out) => render(compose(o.parts, {bg:o.bg||C.white, cta:o.cta||'', accent:o.accent||C.blue, wm:o.wm||C.blue}), out);

// label chip + headline + optional checklist
function chipCard({label, lines, items, done=[], bg=C.white, size=62}) {
  const chipW = 48 + label.length*23;
  let g = card(M, 0, chipW, 66, {r:33, fill:C.blue, stroke:C.blue, sw:0});
  g += T(M + chipW/2, 45, label, {size:30, fam:BLACK, weight:'900', fill:'#ffffff', ls:3, anchor:'middle'});
  lines.forEach(l => chk(l, size, BLACK, W - 2*M));
  const h = block(M, 110, lines, {size});
  g += h.svg;
  const list = U.checklistCard(items, {done});
  g += '<g transform="translate(0,' + Math.round(h.bottom + 46) + ')">' + list.svg + '</g>';
  return {svg:g, height: h.bottom + 46 + list.height, bg};
}

// headline + one small "where this lives in TRENIKO" row
function whereRow({lines, size=64, module: mod, value, bg=C.white}) {
  lines.forEach(l => chk(l, size, BLACK, W - 2*M));
  const h = block(M, 0, lines, {size});
  let g = h.svg;
  const y = h.bottom + 60, cw = W - 2*M;
  g += card(M, y, cw, 128, {r:24, fill:C.tint, stroke:'#bae6fd', sw:2});
  g += mark(M + 26, y + 34, 60, {tile:C.blue, glyph:'#ffffff', r:22});
  g += T(M + 108, y + 58, mod, {size:26, fam:BLACK, weight:'900', fill:C.blueDk, ls:3});
  g += T(M + 108, y + 100, value, {size:34, fam:REG, fill:C.ink});
  return {svg:g, height: y + 128};
}

// conceptual admin-load diagram (explicitly labelled illustrative)
function loadDiagram() {
  const x0 = M + 70, y0 = 430, x1 = M + 880, w = x1 - x0;
  let g = '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="3" fill="' + C.border + '"/>';
  g += '<rect x="' + x0 + '" y="60" width="3" height="' + (y0 - 60) + '" fill="' + C.border + '"/>';
  g += '<path d="M' + x0 + ' ' + (y0-10) + ' C' + (x0+w*0.45) + ' ' + (y0-30) + ' ' + (x0+w*0.7) + ' ' + (y0-330) + ' ' + x1 + ' 80" fill="none" stroke="' + C.ink + '" stroke-width="9" stroke-linecap="round"/>';
  g += '<path d="M' + x0 + ' ' + (y0-14) + ' C' + (x0+w*0.5) + ' ' + (y0-40) + ' ' + (x0+w*0.7) + ' ' + (y0-70) + ' ' + x1 + ' ' + (y0-90) + '" fill="none" stroke="' + C.blue + '" stroke-width="9" stroke-linecap="round"/>';
  g += T(x1 - 6, 56, 'No system', {size:30, fam:BLACK, weight:'900', fill:C.ink, anchor:'end'});
  g += T(x1 - 6, y0 - 108, 'One system', {size:30, fam:BLACK, weight:'900', fill:C.blue, anchor:'end'});
  g += T(x0, y0 + 46, 'CLIENTS', {size:24, fam:BLACK, weight:'900', fill:C.muted, ls:3});
  g += '<g transform="rotate(-90 ' + (M+20) + ' ' + (y0-20) + ')">' + T(M+20, y0-20, 'ADMIN TIME', {size:24, fam:BLACK, weight:'900', fill:C.muted, ls:3}) + '</g>';
  g += T(x0, y0 + 96, 'Illustrative, not measured data.', {size:28, fam:REG, fill:C.muted});
  return {svg:g, height: y0 + 110};
}

// option chips on a blue ground (conversation posts)
function blueOptions({title, opts, support}) {
  title.forEach(l => chk(l, 70, BLACK, W - 2*M));
  const h = block(M, 0, title, {size:70, fill:'#ffffff'});
  let g = h.svg;
  const y = h.bottom + 66, cw = W - 2*M;
  opts.forEach((o, i) => {
    const ry = y + i*104;
    g += card(M, ry, cw, 84, {r:42, fill:'#ffffff', stroke:'#ffffff', sw:0});
    g += T(M + 46, ry + 56, o, {size:42, fam:REG, fill:C.blueDk});
  });
  let bottom = y + opts.length*104;
  g += T(M, bottom + 62, support, {size:38, fam:REG, fill:'#e0f2fe'});
  return {svg:g, height: bottom + 84};
}

// =========================================================================
// P11 — Mon 31 Aug, 19:00 — Carousel x4 — PRODUCT
// =========================================================================
let d = mk(R + '/post-11');
shot({ bg:'#0b1220', wm:C.blueLt, parts: titled(
  ['What happens', 'after a client', 'books.'],
  U.flowDiagram([
    ['The session is booked',   'Once. In the calendar.'],
    ['It shows on the dashboard', 'Sessions Today, Upcoming next 7 days'],
    ['The package counts down',  'Sessions remaining updates itself'],
    ['You get an alert near zero', 'Package Alerts, before it runs out']
  ], {dark:true}),
  {titleSize:64, gap:52, fill:'#ffffff'})
}, d + '/slide-1.png');

shot({ parts: titled(['Booked once.', 'Visible everywhere.'],
  U.appWindow([
    {t:'nav', items:['Dashboard','Calendar','Clients','Packages']},
    {t:'tiles', items:[['3','Sessions Today'],['18','Active Clients'],['11','Active Packages']]},
    {t:'label', text:"TODAY'S SESSIONS"},
    {t:'rows', items:[['07:00 · 1:1 session','Done',false],['12:30 · 1:1 session','Booked',true],['18:00 · Group session','Booked',true]]}
  ], {pg:'Dashboard'}), {titleSize:60})
}, d + '/slide-2.png');

shot({ bg:C.tint, parts: titled(['You stop counting', 'sessions by hand.'],
  U.appWindow([
    {t:'nav', items:['Packages','Clients','Progress']},
    {t:'label', text:'ACTIVE PACKAGES'},
    {t:'rows', items:[['10-session package','6 left',false],['20-session package','14 left',false],['10-session package','2 left',true]]},
    {t:'alert', text:'1 package is ending soon.'}
  ], {pg:'Packages'}), {titleSize:60})
}, d + '/slide-3.png');

render(statement({lines:['Book it once.', 'Everything else', 'follows.'], size:82, bg:C.blue, ink:'#ffffff',
  support:['Clients, sessions, packages and payments', 'in one place.'], cta:'treniko.com', accent:'#ffffff'}), d + '/slide-4.png');

// =========================================================================
// P12 — Tue 1 Sep, 11:00 — Carousel x6 — EDUCATIONAL
// =========================================================================
d = mk(R + '/post-12');
let p = chipCard({label:'WEEKLY', lines:['Your PT admin', 'checklist.'], size:70,
  items:['Confirm the week ahead', 'Log every session you ran', 'Check packages near zero', 'Chase anything unpaid', 'Write one progress note'], done:[0,1]});
shot({parts:p}, d + '/slide-1.png');

shot({bg:C.tint, parts: chipCard({label:'MONDAY', lines:['Confirm the week', 'before it starts.'], size:62,
  items:['Open the calendar for the week', 'Send only the changes, not the schedule']})}, d + '/slide-2.png');

shot({parts: chipCard({label:'AFTER EACH SESSION', lines:['Log it while it is', 'still in your head.'], size:60,
  items:['Mark the session done', 'One line on what changed']})}, d + '/slide-3.png');

shot({bg:C.tint, parts: chipCard({label:'FRIDAY', lines:['Look at money', 'once a week.'], size:64,
  items:['Who has paid', 'Who has not', 'What is due next week']})}, d + '/slide-4.png');

shot({parts: chipCard({label:'SUNDAY · 10 MIN', lines:['Check what is', 'about to run out.'], size:62,
  items:['Packages with 2 sessions left', 'Clients you have not spoken to']})}, d + '/slide-5.png');

render(statement({lines:['Ten minutes a week', 'beats an hour', 'of catching up.'], size:76, bg:C.ink,
  support:['Same checklist, same place, every week.'], cta:'Save this', accent:C.blueLt}), d + '/slide-6.png');

// =========================================================================
// P13 — Thu 3 Sep, 18:00 — Single — RELATABLE
// =========================================================================
d = mk(R + '/post-13');
shot({ parts: titled(['Stop counting', 'sessions by hand.'],
  U.beforeAfter({
    beforeTitle:'HOW IT USUALLY GOES',
    before:['Scroll back through the chat.', 'Count the sessions you remember.', 'Say "I think you have three left."'],
    afterTitle:'HOW IT SHOULD GO',
    after:['Open the client.', 'Read the number.']
  }), {titleSize:66, gap:48}),
  cta:'How do you handle this?'
}, d + '/slide-1.png');

// =========================================================================
// P15 — Sat 5 Sep, 18:30 — Carousel x5 — EDUCATIONAL
// =========================================================================
d = mk(R + '/post-15');
shot({bg:C.blue, wm:'#ffffff', accent:'#ffffff', parts: U.bigNumeral({n:5,
  lines:['things to check', 'before your next', 'client check-in.'], size:66})}, d + '/slide-1.png');

shot({parts: whereRow({lines:['What are they', 'actually working', 'towards?'], size:64,
  module:'PROGRESS', value:'The goal you agreed, written down once.'})}, d + '/slide-2.png');

shot({bg:C.tint, parts: whereRow({lines:['How many sessions', 'are left?'], size:66,
  module:'PACKAGES', value:'Sessions remaining, without counting back.'})}, d + '/slide-3.png');

shot({parts: whereRow({lines:['Has anything', 'been left unpaid?'], size:66,
  module:'PAYMENTS', value:'Amount, method and status per client.'})}, d + '/slide-4.png');

render(statement({lines:['A check-in is easy', 'when you are not', 'reconstructing', 'the last month.'], size:70, bg:C.ink,
  support:['4. What actually changed since last time.', '5. What you promised and have not done yet.'],
  cta:'Save this', accent:C.blueLt}), d + '/slide-5.png');

// =========================================================================
// P16 — Mon 7 Sep, 11:30 — Single — PAIN
// =========================================================================
d = mk(R + '/post-16');
shot({ parts: titled(['Client progress', 'should not live in', 'your camera roll.'],
  U.messCards(['Screenshot 14:06', 'Voice note, 2:41', 'Photo, last March', 'Note to self', 'Chat thread', 'A scale reading']),
  {titleSize:60, gap:44}),
  cta:'Follow for more'
}, d + '/slide-1.png');

// =========================================================================
// P17 — Tue 8 Sep, 19:00 — Carousel x4 — PRODUCT
// =========================================================================
d = mk(R + '/post-17');
shot({ parts: titled(['Payment tracking', 'without another', 'spreadsheet.'],
  U.appWindow([
    {t:'label', text:'PAYMENTS'},
    {t:'rows', items:[['10-session package','Paid',false],['Single session','Paid',false],['20-session package','Unpaid',true]]},
    {t:'alert', text:'1 payment is still outstanding.'}
  ], {pg:'Client'}), {titleSize:60, gap:50})
}, d + '/slide-1.png');

shot({bg:C.tint, parts: titled(['Same information.', 'Less looking.'],
  U.beforeAfter({
    beforeTitle:'THE SPREADSHEET',
    before:['A tab per month.', 'Updated when you remember.', 'Never open when you need it.'],
    afterTitle:'ON THE CLIENT',
    after:['Amount, method, status.', 'Next to their sessions.']
  }), {titleSize:62, gap:46})
}, d + '/slide-2.png');

shot({ parts: titled(['And it tells you', 'before it matters.'],
  U.appWindow([
    {t:'nav', items:['Dashboard','Packages','Clients']},
    {t:'label', text:'PACKAGE ALERTS'},
    {t:'rows', items:[['10-session package','2 left',true],['10-session package','1 left',true]]},
    {t:'alert', text:'Renew or re-book before the last session.'}
  ], {pg:'Dashboard'}), {titleSize:60})
}, d + '/slide-3.png');

render(statement({lines:['Know who has paid', 'without opening', 'a spreadsheet.'], size:74, bg:'#0b1220',
  support:['Payments sit on the client, next to their sessions.'], cta:'treniko.com', accent:C.blueLt}), d + '/slide-4.png');

// =========================================================================
// P19 — Fri 11 Sep, 18:00 — Single — CONVERSATION
// =========================================================================
d = mk(R + '/post-19');
shot({bg:C.blue, wm:'#ffffff', parts: blueOptions({
  title:['Personal trainers:', 'what would save you', 'the most time?'],
  opts:['Scheduling and rescheduling', 'Session tracking', 'Packages and renewals', 'Payments', 'Progress records'],
  support:'Tell us below. We are building around the answers.'})}, d + '/slide-1.png');

// =========================================================================
// P20 — Sat 12 Sep, 11:00 — Carousel x5 — EDUCATIONAL
// =========================================================================
d = mk(R + '/post-20');
shot({ parts: titled(['Admin does not', 'grow politely.'], loadDiagram(), {titleSize:70, gap:30}) }, d + '/slide-1.png');

shot({bg:C.tint, parts: titled(['What changes', 'as you grow.'],
  U.compareCols({
    leftTitle:'5 CLIENTS', left:['You remember everything.', 'One chat thread.', 'Nothing is written down.', 'It works.'],
    rightTitle:'25 CLIENTS', right:['You remember most of it.', 'Twelve chat threads.', 'Nothing is written down.', 'It stops working.']
  }), {titleSize:64})
}, d + '/slide-2.png');

shot({parts: titled(['The three things', 'that break first.'],
  U.checklistCard(['Who is due a session this week', 'How many sessions are left', 'Who has paid and who has not']),
  {titleSize:64})}, d + '/slide-3.png');

shot({bg:C.tint, parts: titled(['A system is not', 'more software.'],
  U.compareCols({
    leftTitle:'NOT THIS', left:['Five apps.', 'A new tool each month.', 'Rebuilt every January.'],
    rightTitle:'THIS', right:['One place to look.', 'The same fields, always.', 'Boring on purpose.']
  }), {titleSize:64})
}, d + '/slide-4.png');

render(statement({lines:['You are not', 'disorganised.', 'Your tools are.'], size:82, bg:C.ink,
  support:['Built for independent trainers, not gyms.'], cta:'treniko.com', accent:C.blueLt}), d + '/slide-5.png');

setTimeout(() => {
  console.log('w3 rendered');
  if (warn.length) { console.log('WIDTH WARNINGS:'); warn.forEach(w => console.log('  ' + w)); }
  else console.log('no width warnings');
}, 50);
