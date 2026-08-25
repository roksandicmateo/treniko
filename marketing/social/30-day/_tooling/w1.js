const {compose, hookBody, stackBody, numberBody, scatterBody, titled, statement, B} = require('./tpl.js');
const {C,render} = B; const fs=require('fs');
const mk = p => { fs.mkdirSync(p,{recursive:true}); return p; };
const R = 'marketing/social/30-day/posts';

const hook = o => compose(hookBody(o), {bg:o.bg||C.white, cta:o.cta||'', accent:o.accent||C.blue});
const stack = o => compose(stackBody(o), {bg:o.bg||C.white, cta:o.cta||''});
const num  = o => compose(numberBody(o), {bg:o.bg||C.white});

// ---------- P02 — Tue 18 Aug 11:30 — PAIN ----------
let d = mk(`${R}/post-02`);
render(hook({lines:['Your coaching','business is spread','across five apps.'], size:82}), `${d}/slide-1.png`);
render(compose(titled(['Five places to look.'], scatterBody({labels:['WhatsApp','Calendar','Notes','Spreadsheet','Payments']}), {titleSize:64}),
  {bg:C.page}), `${d}/slide-2.png`);
render(stack({title:['Or one place.'], items:['Clients','Sessions','Payments','Progress'],
  support:'Everything about a client, on one screen.', cta:'treniko.com'}), `${d}/slide-3.png`);

// ---------- P03 — Thu 20 Aug 18:30 — RELATABLE ----------
d = mk(`${R}/post-03`);
render(hook({lines:['POV: your client','asks how many','sessions they','have left.'], size:80, bg:C.tint}), `${d}/slide-1.png`);
render(stack({title:['So you start','looking.'], items:['Search the chat thread','Open the calendar','Find the spreadsheet','Count backwards'],
  support:'Nine minutes later, you answer.'}), `${d}/slide-2.png`);
render(hook({lines:['There should be','a better way.'], size:84,
  support:['Sessions, packages and payments sit on','the client\u2019s own page. You answer in','four seconds.'], cta:'treniko.com'}), `${d}/slide-3.png`);

// ---------- P04 — Fri 21 Aug 12:00 — EDUCATIONAL ----------
d = mk(`${R}/post-04`);
render(hook({lines:['5 signs your','coaching business','has outgrown','spreadsheets.'], size:78}), `${d}/slide-1.png`);
render(num({n:1, lines:['You check three','places to answer','one question.']}), `${d}/slide-2.png`);
render(num({n:2, lines:['You are never','completely sure','who has paid.'], bg:C.tint}), `${d}/slide-3.png`);
render(num({n:3, lines:['Remaining sessions','need manual','counting.']}), `${d}/slide-4.png`);
render(num({n:4, lines:['Progress lives in','messages, notes','and camera rolls.'], bg:C.tint}), `${d}/slide-5.png`);
render(num({n:5, lines:['One reschedule','means updating','three things.']}), `${d}/slide-6.png`);
render(statement({lines:['Your coaching grew.','Your system','should too.'], size:80,
  support:['Clients. Sessions. Payments. Progress.','One place.'], cta:'treniko.com'}), `${d}/slide-7.png`);

console.log('w1 re-rendered');
