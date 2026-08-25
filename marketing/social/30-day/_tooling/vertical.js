const B = require('./brand.js');
const {C,SW,SH,M,T,block,rule,card,mark,render,BLACK,REG} = B; const fs=require('fs');
const mk = p => { fs.mkdirSync(p,{recursive:true}); return p; };
const esc = B.esc;

// 9:16 page. Keeps text out of the bottom 250px (caption/UI zone) and top 200px.
function v(inner,{bg=C.white}={}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}"><rect width="${SW}" height="${SH}" fill="${bg}"/>${inner}</svg>`;
}
function vpage({lines, size=92, support=[], cta='', bg=C.white, ink=C.ink, body=C.body, accent=C.blue, wm=C.blue, label=''}) {
  let s = T(M,190,'TRENIKO',{size:44,fam:BLACK,weight:'900',fill:wm,ls:3});
  if (label) s += T(M,270,label,{size:34,fam:BLACK,weight:'900',fill:accent,ls:4});
  const h = block(M, 560, lines, {size, fill:ink});
  s += h.svg;
  s += rule(M, h.bottom+56, 140, 10, accent);
  if (support.length) s += block(M, h.bottom+130, support, {size:46, fam:REG, weight:'normal', fill:body, lh:1.4}).svg;
  if (cta) s += T(M, SH-320, cta, {size:52, fam:BLACK, weight:'900', fill:accent});
  return v(s,{bg});
}
// poll / question sticker mock for Stories (visual guide — the real sticker is added in-app)
function vpoll({question, opts, bg=C.blue, note=''}) {
  let s = T(M,190,'TRENIKO',{size:44,fam:BLACK,weight:'900',fill:'#ffffff',ls:3});
  const h = block(M, 520, question, {size:80, fill:'#ffffff'});
  s += h.svg;
  let y = h.bottom + 110;
  opts.forEach((o,i)=>{
    s += card(M, y+i*140, SW-2*M, 112, {r:56, fill:'#ffffff', stroke:'#ffffff', sw:0});
    s += T(SW/2, y+i*140+72, o, {size:48, fam:BLACK, weight:'900', fill:C.blueDk, anchor:'middle'});
  });
  if (note) s += T(M, SH-300, note, {size:40, fam:REG, fill:'#e0f2fe'});
  return v(s,{bg});
}
module.exports = {vpage, vpoll, mk, C, render};
