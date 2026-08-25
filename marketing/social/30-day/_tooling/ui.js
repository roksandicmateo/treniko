// TRENIKO — extended layout primitives for P11–P20.
// Goal: break the "white background + headline + blue rule" pattern flagged in
// the previous session's grid QA.
// Every app fragment mirrors the REAL product: nav items and stat labels are
// taken verbatim from frontend/src/locales/en.json. No invented features and no
// person names anywhere — counts and states only.
const B = require('./brand.js');
const {C,W,H,M,T,block,rule,card,mark,page,BLACK,REG} = B;

const IN = W - 2*M;                                   // 900 usable width

// ---------- a schematic fragment of the TRENIKO app ----------
// sections: {t:'nav'|'tiles'|'rows'|'label'|'alert', ...}
function appWindow(sections, {x=M, w=IN, pg='Dashboard', dark=false}={}) {
  const surf = dark ? '#0f172a' : C.white;
  const brd  = dark ? '#1e293b' : C.border;
  const ink  = dark ? '#e2e8f0' : C.ink;
  const mut  = dark ? '#94a3b8' : C.muted;
  const soft = dark ? '#111f36' : C.tint;

  let h = 92;
  for (const s of sections) {
    if (s.t === 'nav')   h += 84;
    if (s.t === 'tiles') h += 148;
    if (s.t === 'rows')  h += 22 + s.items.length * 78;
    if (s.t === 'label') h += 58;
    if (s.t === 'alert') h += 108;
  }
  h += 30;

  let g = card(x, 0, w, h, {r:30, fill:surf, stroke:brd, sw:2});
  g += mark(x + 28, 24, 44, {tile:C.blue, glyph:'#ffffff', r:22});
  g += T(x + 88, 58, 'TRENIKO', {size:28, fam:BLACK, weight:'900', fill: dark ? '#ffffff' : C.ink, ls:2});
  g += T(x + w - 28, 58, pg, {size:26, fam:REG, fill:mut, anchor:'end'});
  g += '<rect x="' + (x+2) + '" y="92" width="' + (w-4) + '" height="2" fill="' + brd + '"/>';

  let y = 92;
  for (const s of sections) {
    if (s.t === 'nav') {
      let cx = x + 28;
      s.items.forEach(function (it, i) {
        const cw = 30 + it.length * 17;
        g += card(cx, y + 20, cw, 52, {r:26, fill: i===0 ? C.blue : soft, stroke: i===0 ? C.blue : brd, sw: i===0 ? 0 : 2});
        g += T(cx + cw/2, y + 55, it, {size:26, fam:REG, fill: i===0 ? '#ffffff' : mut, anchor:'middle'});
        cx += cw + 14;
      });
      y += 84;
    }
    if (s.t === 'tiles') {
      const n = s.items.length, gap = 18, tw = (w - 56 - gap*(n-1)) / n;
      s.items.forEach(function (it, i) {
        const tx = x + 28 + i*(tw + gap);
        g += card(tx, y + 16, tw, 116, {r:22, fill:soft, stroke:brd, sw:2});
        g += T(tx + 24, y + 80, it[0], {size:54, fam:BLACK, weight:'900', fill: i===0 ? C.blue : ink});
        g += T(tx + 24, y + 114, it[1], {size:22, fam:REG, fill:mut});
      });
      y += 148;
    }
    if (s.t === 'label') {
      g += T(x + 28, y + 42, s.text, {size:24, fam:BLACK, weight:'900', fill:mut, ls:3});
      y += 58;
    }
    if (s.t === 'rows') {
      y += 8;
      s.items.forEach(function (it, i) {
        const ry = y + i*78;
        if (i) g += '<rect x="' + (x+28) + '" y="' + ry + '" width="' + (w-56) + '" height="2" fill="' + brd + '"/>';
        g += '<circle cx="' + (x+48) + '" cy="' + (ry+40) + '" r="9" fill="' + (it[2] ? C.blue : (dark ? '#334155' : '#cbd5e1')) + '"/>';
        g += T(x + 76, ry + 52, it[0], {size:30, fam:REG, fill:ink});
        g += T(x + w - 28, ry + 52, it[1], {size:28, fam:BLACK, weight:'900', fill: it[2] ? C.blue : mut, anchor:'end'});
      });
      y += 14 + s.items.length*78;
    }
    if (s.t === 'alert') {
      g += card(x + 28, y + 16, w - 56, 76, {r:20, fill: dark ? '#12263f' : '#fff7ed', stroke: dark ? '#1e3a5f' : '#fed7aa', sw:2});
      g += T(x + 52, y + 64, s.text, {size:30, fam:REG, fill: dark ? '#e2e8f0' : '#9a3412'});
      y += 108;
    }
  }
  return {svg:g, height:h};
}

// ---------- checklist card ----------
function checklistCard(items, {x=M, w=IN, dark=false, done=[]} = {}) {
  const rowH = 92, h = items.length*rowH + 40;
  const surf = dark ? '#0f172a' : C.white, brd = dark ? '#1e293b' : C.border, ink = dark ? '#e2e8f0' : C.ink;
  let g = card(x, 0, w, h, {r:28, fill:surf, stroke:brd, sw:2});
  items.forEach(function (it, i) {
    const y = 20 + i*rowH, bx = x + 40, by = y + 18;
    const on = done.indexOf(i) !== -1;
    g += card(bx, by, 44, 44, {r:12, fill: on ? C.blue : 'none', stroke: on ? C.blue : (dark ? '#334155' : '#cbd5e1'), sw:3});
    if (on) g += '<path d="M' + (bx+11) + ' ' + (by+23) + ' l9 9 l14 -17" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
    g += T(bx + 70, y + 52, it, {size:40, fam:REG, fill:ink});
    if (i) g += '<rect x="' + (x+40) + '" y="' + (y-10) + '" width="' + (w-80) + '" height="2" fill="' + brd + '"/>';
  });
  return {svg:g, height:h};
}

// ---------- before / after, stacked ----------
function beforeAfter({beforeTitle, before, afterTitle, after, x=M, w=IN}) {
  const bh = 60 + before.length*62 + 34;
  const ah = 60 + after.length*62 + 34;
  let g = card(x, 0, w, bh, {r:26, fill:'#f8fafc', stroke:C.border, sw:2});
  g += T(x + 38, 56, beforeTitle, {size:26, fam:BLACK, weight:'900', fill:C.muted, ls:3});
  before.forEach(function (l, i) { g += T(x + 38, 116 + i*62, l, {size:40, fam:REG, fill:C.body}); });

  const ay = bh + 34;
  g += '<path d="M' + (x + w/2 - 22) + ' ' + (bh + 2) + ' l22 26 l22 -26" fill="' + C.blue + '"/>';
  g += card(x, ay, w, ah, {r:26, fill:C.ink, stroke:C.ink, sw:0});
  let inner = T(x + 38, 56, afterTitle, {size:26, fam:BLACK, weight:'900', fill:C.blueLt, ls:3});
  after.forEach(function (l, i) { inner += T(x + 38, 116 + i*62, l, {size:40, fam:REG, fill:'#ffffff'}); });
  g += '<g transform="translate(0,' + ay + ')">' + inner + '</g>';
  return {svg:g, height: ay + ah};
}

// ---------- huge numeral hero ----------
function bigNumeral({n, lines, size=68, numFill='#ffffff', ink='#ffffff', accent='#ffffff'}) {
  let g = T(M, 210, String(n), {size:280, fam:BLACK, weight:'900', fill:numFill});
  const h = block(M, 268, lines, {size, fill:ink});
  g += h.svg;
  g += rule(M, h.bottom + 40, 130, 9, accent);
  return {svg:g, height: h.bottom + 58};
}

// ---------- top-to-bottom flow diagram ----------
function flowDiagram(nodes, {dark=true} = {}) {
  const ink = dark ? '#ffffff' : C.ink, mut = dark ? '#94a3b8' : C.muted;
  const surf = dark ? '#111f36' : C.tint, brd = dark ? '#1e3a5f' : '#bae6fd';
  const rowH = 118, gap = 26;
  let g = '';
  nodes.forEach(function (n, i) {
    const y = i*(rowH + gap);
    g += card(M + 56, y, IN - 56, rowH, {r:24, fill: i===0 ? C.blue : surf, stroke: i===0 ? C.blue : brd, sw:2});
    g += '<circle cx="' + (M+28) + '" cy="' + (y + rowH/2) + '" r="20" fill="' + (i===0 ? C.blue : (dark ? '#1e3a5f' : '#bae6fd')) + '"/>';
    g += T(M + 28, y + rowH/2 + 11, String(i+1), {size:30, fam:BLACK, weight:'900', fill: i===0 ? '#ffffff' : (dark ? '#93c5fd' : C.blueDk), anchor:'middle'});
    g += T(M + 100, y + rowH/2 + 2, n[0], {size:42, fam:BLACK, weight:'900', fill: i===0 ? '#ffffff' : ink});
    if (n[1]) g += T(M + 100, y + rowH/2 + 42, n[1], {size:28, fam:REG, fill: i===0 ? '#e0f2fe' : mut});
    if (i < nodes.length - 1) g += '<rect x="' + (M+26) + '" y="' + (y + rowH) + '" width="4" height="' + gap + '" fill="' + (dark ? '#1e3a5f' : '#bae6fd') + '"/>';
  });
  return {svg:g, height: nodes.length*rowH + (nodes.length - 1)*gap};
}

// ---------- two-column comparison ----------
function compareCols({leftTitle, left, rightTitle, right, x=M, w=IN}) {
  const cw = (w - 26) / 2;
  const n = Math.max(left.length, right.length);
  const h = 96 + n*74 + 30;
  let g = card(x, 0, cw, h, {r:26, fill:'#f8fafc', stroke:C.border, sw:2});
  g += card(x + cw + 26, 0, cw, h, {r:26, fill:C.tint, stroke:'#bae6fd', sw:2});
  g += T(x + 30, 62, leftTitle, {size:34, fam:BLACK, weight:'900', fill:C.muted});
  g += T(x + cw + 56, 62, rightTitle, {size:34, fam:BLACK, weight:'900', fill:C.blueDk});
  g += '<rect x="' + (x+30) + '" y="84" width="' + (cw-60) + '" height="2" fill="' + C.border + '"/>';
  g += '<rect x="' + (x+cw+56) + '" y="84" width="' + (cw-60) + '" height="2" fill="#bae6fd"/>';
  left.forEach(function (l, i) { g += T(x + 30, 152 + i*74, l, {size:34, fam:REG, fill:C.body}); });
  right.forEach(function (l, i) { g += T(x + cw + 56, 152 + i*74, l, {size:34, fam:REG, fill:C.ink}); });
  return {svg:g, height:h};
}

// ---------- scattered card mess ----------
function messCards(labels) {
  const pos = [ {x:-30,y:0,w:400,r:-7}, {x:430,y:52,w:420,r:6}, {x:10,y:190,w:430,r:5},
                {x:470,y:250,w:400,r:-5}, {x:120,y:390,w:470,r:3}, {x:520,y:450,w:380,r:-4} ];
  let g = '';
  labels.forEach(function (l, i) {
    const p = pos[i], h = 112, x = M + p.x;
    g += card(x, p.y, p.w, h, {r:20, fill:C.white, stroke:C.border, sw:2, rot:p.r, cx:x + p.w/2, cy:p.y + h/2});
    g += '<g transform="rotate(' + p.r + ' ' + (x + p.w/2) + ' ' + (p.y + h/2) + ')">'
       + '<rect x="' + (x+26) + '" y="' + (p.y+34) + '" width="44" height="44" rx="10" fill="' + C.tint + '" stroke="#bae6fd" stroke-width="2"/>'
       + T(x + 88, p.y + 72, l, {size:36, fam:REG, fill:C.body}) + '</g>';
  });
  return {svg:g, height:562};
}

module.exports = {appWindow, checklistCard, beforeAfter, bigNumeral, flowDiagram, compareCols, messCards, IN};
