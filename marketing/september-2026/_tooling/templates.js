// TRENIKO — the September 2026 template set, rendered as specimens.
//
// Five reusable layouts. Each specimen is the real template with placeholder
// copy, so the spacing, type sizes and colour can be read off the file and
// rebuilt in Canva or Figma without guessing.
//
//   NODE_PATH=<scratchpad>/node_modules node marketing/september-2026/_tooling/templates.js
//
const S = require('./september.js');
const { C, mk, render, productFeed, storyFrame, storyPoll, compose, hookBody, stackBody,
        numberBody, statement } = S;

const OUT = 'marketing/september-2026/templates';

(async () => {
  mk(OUT);

  // 1 — Feed post: hook + rule + support + CTA (1080 × 1350)
  render(compose(hookBody({
    lines: ['Headline, three', 'lines at most,', 'broken by hand.'], size: 84,
    support: ['Support copy, two lines, 40 px regular.', 'Sentence case. No exclamation marks.'],
  }), { bg: C.white, cta: 'treniko.com' }), `${OUT}/01-feed-hook.png`);

  // 2 — Product screenshot template (1080 × 1350)
  await productFeed({ out: `${OUT}/02-feed-product.png`, crop: 'phone-attention', cropWidth: 640,
    lines: ['Headline over a', 'real screenshot.'], size: 66,
    support: ['One or two lines of support.'], cta: 'treniko.com' });

  // 3 — Quote / problem statement (1080 × 1350, dark ground)
  render(statement({ lines: ['A statement slide.', 'Dark ground.', 'Nothing else on it.'], size: 78,
    support: ['Used to close a carousel or carry a brand line.'], cta: 'treniko.com' }),
    `${OUT}/03-feed-statement.png`);

  // 4 — List / numbered slide (1080 × 1350)
  render(compose(stackBody({
    title: ['A list slide.'], items: ['First item', 'Second item', 'Third item', 'Fourth item'],
    support: 'One line under the card.',
  }), { bg: C.white }), `${OUT}/04-feed-list.png`);
  render(compose(numberBody({ n: 1, lines: ['A numbered slide,', 'one point per', 'card.'] }),
    { bg: C.tint }), `${OUT}/05-feed-number.png`);

  // 5 — Story templates (1080 × 1920)
  storyFrame({ out: `${OUT}/06-story-statement.png`,
    lines: ['A story frame.', 'Type sits in the', 'upper third.'], size: 84,
    support: ['The lower half is left empty for stickers', 'and the reply box.'], footer: 'treniko.com' });
  storyPoll({ out: `${OUT}/07-story-poll.png`,
    question: ['A poll frame.', 'Slots stay empty.'],
    options: ['Option one', 'Option two', 'Option three'],
    note: 'The sticker is added in the app at publish time.' });

  console.log('templates: 7 specimens in', OUT);
})().catch((e) => { console.error(e.message); process.exit(1); });
