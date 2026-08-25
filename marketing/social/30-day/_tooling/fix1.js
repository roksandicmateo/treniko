const {compose, hookBody, numberBody, statement, B} = require('./tpl.js');
const {C,render} = B;
const R = 'marketing/social/30-day/posts';
const hook = o => compose(hookBody(o), {bg:o.bg||C.white, cta:o.cta||''});
const num  = o => compose(numberBody(o), {bg:o.bg||C.white});

// P08 — now a proper 6-slide set: hook + four numbered + close
render(hook({lines:['What every PT','should track','for every client.'], size:80}), `${R}/post-08/slide-1.png`);
render(num({n:1, lines:['What they are','working towards.'], size:66}), `${R}/post-08/slide-2.png`);
render(num({n:2, lines:['Sessions used','and sessions left.'], size:66, bg:C.tint}), `${R}/post-08/slide-3.png`);
render(num({n:3, lines:['What they have','paid, and when.'], size:66}), `${R}/post-08/slide-4.png`);
render(num({n:4, lines:['What actually','changed since','last month.'], size:66, bg:C.tint}), `${R}/post-08/slide-5.png`);
render(hook({lines:['Track these four','and check-ins stop','being guesswork.'], size:74, cta:'treniko.com'}), `${R}/post-08/slide-6.png`);

// P09 — claim removed; now asks the reader instead of inventing research
render(statement({lines:['How many apps','does it take','to manage','one client?'], size:82, bg:C.ink,
  support:['Count yours right now.','Chat. Calendar. Notes. Spreadsheet. Payments.']}), `${R}/post-09/slide-1.png`);
console.log('fixed');
