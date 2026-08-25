const {compose, hookBody, stackBody, numberBody, scatterBody, titled, statement, B} = require('./tpl.js');
const {C,W,H,M,T,block,render,card,mark,page,BLACK,REG} = B; const fs=require('fs');
const mk = p => { fs.mkdirSync(p,{recursive:true}); return p; };
const R = 'marketing/social/30-day/posts';
const hook = o => compose(hookBody(o), {bg:o.bg||C.white, cta:o.cta||'', accent:o.accent||C.blue});
const stack = o => compose(stackBody(o), {bg:o.bg||C.white, cta:o.cta||''});
const num  = o => compose(numberBody(o), {bg:o.bg||C.white});

// big question slide for conversation posts: headline + option chips
function options({title, opts, support='', bg=C.white}) {
  const h = block(M,0,title,{size:70});
  let svg=h.svg; let y=h.bottom+70;
  const cw=W-2*M;
  opts.forEach((o,i)=>{
    const ry=y+i*104;
    svg += card(M,ry,cw,84,{r:42,fill:C.tint,stroke:'#bae6fd',sw:2});
    svg += T(M+46,ry+56,o,{size:42,fam:REG,fill:C.blueDk});
  });
  let bottom=y+opts.length*104;
  if (support){ svg += T(M,bottom+66,support,{size:40,fam:REG,fill:C.body}); bottom+=90; }
  return compose({svg,height:bottom},{bg});
}
// product-area slide: label chip + what it replaces
function feature({label, lines, replaces, bg=C.white}) {
  let svg = card(M,0,360,72,{r:36,fill:C.blue,stroke:C.blue,sw:0});
  svg += T(M+40,50,label,{size:36,fam:BLACK,weight:'900',fill:'#ffffff',ls:2});
  const h = block(M,120,lines,{size:66});
  svg += h.svg;
  let bottom = h.bottom;
  if (replaces){ svg += T(M,bottom+70,replaces,{size:38,fam:REG,fill:C.body}); bottom+=94; }
  return compose({svg,height:bottom},{bg});
}

// ===== P06 — Mon 24 Aug 11:00 — Carousel ×6 — PRODUCT =====
let d = mk(`${R}/post-06`);
render(hook({lines:['What TRENIKO','keeps track of','so you don\u2019t','have to.'], size:78}), `${d}/slide-1.png`);
render(feature({label:'CLIENTS', lines:['Everyone you','train, on one','list.'], replaces:'Instead of: a contacts app and a chat thread.'}), `${d}/slide-2.png`);
render(feature({label:'SESSIONS', lines:['Booked, done,','rescheduled \u2014','all recorded.'], replaces:'Instead of: a calendar plus your memory.', bg:C.tint}), `${d}/slide-3.png`);
render(feature({label:'PACKAGES', lines:['Sessions left,','counted for','you.'], replaces:'Instead of: counting backwards by hand.'}), `${d}/slide-4.png`);
render(feature({label:'PAYMENTS', lines:['Who has paid,','and who has','not.'], replaces:'Instead of: a spreadsheet you update on Sundays.', bg:C.tint}), `${d}/slide-5.png`);
render(statement({lines:['Run your','coaching business.','Not your','spreadsheets.'], size:76, cta:'treniko.com'}), `${d}/slide-6.png`);

// ===== P07 — Tue 25 Aug 18:00 — Single — CONVERSATION =====
d = mk(`${R}/post-07`);
render(options({title:['Personal trainers:','what is the most','annoying part of the','business side?'], opts:['Scheduling','Payments','Session tracking','Client follow-ups','Progress records'], support:'Tell us below. We read every answer.'}), `${d}/slide-1.png`);

// ===== P08 — Thu 27 Aug 12:00 — Carousel ×5 — EDUCATIONAL =====
d = mk(`${R}/post-08`);
render(hook({lines:['What every PT','should track','for every client.'], size:80}), `${d}/slide-1.png`);
render(num({n:1, lines:['What they are','working towards.'], size:66}), `${d}/slide-2.png`);
render(num({n:2, lines:['Sessions used','and sessions left.'], size:66, bg:C.tint}), `${d}/slide-3.png`);
render(num({n:3, lines:['What they have','paid, and when.'], size:66}), `${d}/slide-4.png`);
render(hook({lines:['Track these four','and check-ins','stop being','guesswork.'], size:74,
  support:['4. What actually changed since last month.'], cta:'treniko.com', bg:C.tint}), `${d}/slide-5.png`);

// ===== P09 — Fri 28 Aug 18:30 — Single — PAIN =====
d = mk(`${R}/post-09`);
render(statement({lines:['How many apps','does it take','to manage','one client?'], size:82, bg:C.ink,
  support:['Most trainers we talk to answer four.','Some say six.']}), `${d}/slide-1.png`);

console.log('w2 rendered');
