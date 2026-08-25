const {vpage, vpoll, mk, C, render} = require('./vertical.js');
const R='marketing/social/30-day/reels', S='marketing/social/30-day/stories';

// ---- REEL 01 (P05) ----
let d=mk(`${R}/reel-01`);
render(vpage({label:'0\u20132 SEC \u00b7 HOOK', lines:['Still running','your PT business','from WhatsApp','and spreadsheets?'], size:80}), `${d}/frame-1-hook.png`);
render(vpage({label:'2\u20135 SEC \u00b7 PAIN', lines:['Five apps.','One client.'], size:104, bg:C.tint}), `${d}/frame-2-pain.png`);
render(vpage({label:'12\u201315 SEC \u00b7 CTA', lines:['Less admin.','More coaching.'], size:96, bg:C.ink, ink:'#ffffff', cta:'treniko.com'}), `${d}/frame-4-cta.png`);

// ---- REEL 02 (P10) ----
d=mk(`${R}/reel-02`);
render(vpage({label:'0\u20132 SEC \u00b7 HOOK', lines:['Your client just','asked how many','sessions they','have left.'], size:80}), `${d}/frame-1-hook.png`);
render(vpage({label:'2\u20135 SEC \u00b7 PAIN', lines:['Go. Ten seconds.'], size:100, bg:C.tint}), `${d}/frame-2-pain.png`);
render(vpage({label:'12\u201315 SEC \u00b7 CTA', lines:['One place.','Four seconds.'], size:100, bg:C.ink, ink:'#ffffff', cta:'treniko.com'}), `${d}/frame-4-cta.png`);

// ---- REEL 03 (P14) ----
d=mk(`${R}/reel-03`);
render(vpage({label:'0\u20132 SEC \u00b7 HOOK', lines:['POV: one','reschedule means','updating three','apps.'], size:82}), `${d}/frame-1-hook.png`);
render(vpage({label:'2\u20135 SEC \u00b7 PAIN', lines:['Every. Single.','Time.'], size:104, bg:C.tint}), `${d}/frame-2-pain.png`);
render(vpage({label:'12\u201315 SEC \u00b7 CTA', lines:['Move it once.'], size:104, bg:C.ink, ink:'#ffffff', cta:'treniko.com'}), `${d}/frame-4-cta.png`);

// ---- REEL 04 (P18) ----
d=mk(`${R}/reel-04`);
render(vpage({label:'0\u20132 SEC \u00b7 HOOK', lines:['What running','a PT business','should actually','look like.'], size:82}), `${d}/frame-1-hook.png`);
render(vpage({label:'2\u20135 SEC \u00b7 PAIN', lines:['Not this many','tabs.'], size:100, bg:C.tint}), `${d}/frame-2-pain.png`);
render(vpage({label:'12\u201315 SEC \u00b7 CTA', lines:['Clients. Sessions.','Payments.','Progress.'], size:82, bg:C.ink, ink:'#ffffff', cta:'treniko.com'}), `${d}/frame-4-cta.png`);

// ---- REEL 05 (P21) ----
d=mk(`${R}/reel-05`);
render(vpage({label:'0\u20132 SEC \u00b7 HOOK', lines:['You are not','disorganised.','Your tools are.'], size:88}), `${d}/frame-1-hook.png`);
render(vpage({label:'2\u20135 SEC \u00b7 PAIN', lines:['Admin after','the last session','ends.'], size:88, bg:C.tint}), `${d}/frame-2-pain.png`);
render(vpage({label:'12\u201315 SEC \u00b7 CTA', lines:['Free for','early adopters.'], size:96, bg:C.ink, ink:'#ffffff', cta:'treniko.com'}), `${d}/frame-4-cta.png`);

// ---- STORIES ----
d=mk(`${S}/week-1`);
render(vpoll({question:['Where do you','track your','clients?'], opts:['Spreadsheet','Notes / messages'], note:'Poll sticker \u2014 add in the Instagram app.'}), `${d}/story-1-poll.png`);
render(vpoll({question:['What admin task','do you hate','most?'], opts:['Scheduling','Payments','Sessions','Progress'], note:'Poll sticker \u2014 add in the Instagram app.'}), `${d}/story-2-poll.png`);
d=mk(`${S}/week-2`);
render(vpage({lines:['What would save','you the most','time every week?'], size:84, support:['Answer in the question box \u2014','we are building around the replies.'], bg:C.tint}), `${d}/story-3-question.png`);
render(vpage({lines:['New on the','feed today.'], size:96, support:['Swipe up to the post.'], cta:'treniko.com'}), `${d}/story-4-reshare.png`);
d=mk(`${S}/highlights-product`);
render(vpage({label:'PRODUCT', lines:['TRENIKO is','software for','personal trainers.'], size:80}), `${d}/story-1-what.png`);
render(vpage({label:'PRODUCT', lines:['Built for','independent PTs','with 10\u201340 clients.'], size:76, bg:C.tint}), `${d}/story-2-who.png`);
render(vpage({label:'PRODUCT', lines:['Clients. Sessions.','Payments.','Progress.','One place.'], size:76, bg:C.ink, ink:'#ffffff', cta:'treniko.com'}), `${d}/story-3-benefit.png`);
console.log('reels + stories rendered');
