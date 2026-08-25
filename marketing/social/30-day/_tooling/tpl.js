const B = require('./brand.js');
const {C,W,H,M,T,block,wordmark,rule,card,mark,page,BLACK,REG} = B;

// vertically centre a content group between the wordmark and the CTA zone
function compose(parts, {bg=C.white, cta='', accent=C.blue, wm=C.blue, topPad=250}={}) {
  const bottomLimit = cta ? H-210 : H-140;
  const avail = bottomLimit - topPad;
  const dy = topPad + Math.max(0,(avail - parts.height)/2);
  let s = wordmark(wm);
  s += `<g transform="translate(0,${Math.round(dy)})">${parts.svg}</g>`;
  if (cta) s += T(M, H-118, cta, {size:36, fam:BLACK, weight:'900', fill:accent});
  return page(s,{bg});
}

// headline + rule + optional support, measured from y=0
function hookBody({lines, size=80, support=[], ink=C.ink, body=C.body, accent=C.blue}) {
  const h = block(M, 0, lines, {size, fill:ink});
  let svg = h.svg, y = h.bottom + 44;
  svg += rule(M, y, 120, 8, accent); y += 8;
  if (support.length) {
    const sb = block(M, y+58, support, {size:40, fam:REG, weight:'normal', fill:body, lh:1.4});
    svg += sb.svg; y = sb.bottom;
  }
  return {svg, height:y};
}

// title + bordered card of rows + optional support
function stackBody({title, items, support='', titleSize=76, rowH=104}) {
  const h = block(M, 0, title, {size:titleSize});
  let svg = h.svg;
  const top = h.bottom + 64, cw = W-2*M, ch = items.length*rowH + 44;
  svg += card(M, top, cw, ch, {r:28, fill:C.white, stroke:C.border, sw:2});
  svg += `<rect x="${M}" y="${top}" width="10" height="${ch}" rx="5" fill="${C.blue}"/>`;
  items.forEach((it,i)=>{
    const y = top + 22 + i*rowH;
    if (i) svg += `<rect x="${M+46}" y="${y}" width="${cw-92}" height="2" fill="${C.border}"/>`;
    svg += T(M+46, y+66, it, {size:46, fam:REG, fill:C.ink});
  });
  let bottom = top + ch;
  if (support) { svg += T(M, bottom+78, support, {size:40, fam:REG, fill:C.body}); bottom += 100; }
  return {svg, height:bottom};
}

// big numeral + rule + headline
function numberBody({n, lines, size=70}) {
  let svg = T(M, 120, String(n), {size:160, fam:BLACK, weight:'900', fill:C.blue});
  svg += rule(M, 168, 90, 8);
  const h = block(M, 250, lines, {size});
  svg += h.svg;
  return {svg, height:h.bottom};
}

// five deliberately misaligned cards spread down the canvas
function scatterBody({labels}) {
  const pos = [ {x:0,   y:0,   w:430, r:-6}, {x:490, y:70,  w:400, r:5},
                {x:60,  y:210, w:390, r:4},  {x:520, y:280, w:400, r:-7},
                {x:210, y:430, w:450, r:3} ];
  let svg='';
  labels.forEach((l,i)=>{
    const p=pos[i], h=124, x=M+p.x-40;
    svg += card(x,p.y,p.w,h,{r:22,fill:C.white,stroke:C.border,sw:2,rot:p.r,cx:x+p.w/2,cy:p.y+h/2});
    svg += `<g transform="rotate(${p.r} ${x+p.w/2} ${p.y+h/2})">${T(x+38,p.y+80,l,{size:44,fam:REG,fill:C.ink})}</g>`;
  });
  return {svg, height:560};
}

// title above a body group
function titled(titleLines, bodyParts, {titleSize=64, gap=56}={}) {
  const h = block(M, 0, titleLines, {size:titleSize});
  return { svg: h.svg + `<g transform="translate(0,${Math.round(h.bottom+gap)})">${bodyParts.svg}</g>`,
           height: h.bottom + gap + bodyParts.height };
}

// full-bleed statement slide (dark or blue ground)
function statement({lines, size=86, bg=C.ink, ink=C.white, support=[], cta='', accent=C.blue}) {
  const parts = hookBody({lines, size, support, ink, body:'#cbd5e1', accent});
  return compose(parts, {bg, cta, accent, wm:accent});
}

module.exports = {compose, hookBody, stackBody, numberBody, scatterBody, titled, statement, B};
