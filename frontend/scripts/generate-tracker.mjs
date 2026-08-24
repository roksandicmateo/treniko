/**
 * Generates the free client & session tracker template.
 *
 * ── Why CSV ──────────────────────────────────────────────────────────────────
 * It opens in Excel, Google Sheets, LibreOffice and Numbers without conversion,
 * it is a few kilobytes, it is readable in a text editor, and it needs no
 * library to produce. An .xlsx would have to be assembled by hand as a zip of
 * XML parts, or by adding a dependency, and it would buy nothing a trainer
 * cares about.
 *
 * The one thing CSV appears to lose is formulas — and it does not. A cell whose
 * text begins with `=` is imported as a live formula by every one of those
 * applications, so the remaining-sessions column really does calculate itself
 * the moment the file is opened. That is the single most useful thing in the
 * template, because a hand-maintained count is the number that drifts.
 *
 * ── Why it is not gated ──────────────────────────────────────────────────────
 * No email wall. A trainer who wants a spreadsheet should get a spreadsheet;
 * making them trade an address for it would buy a list of addresses rather than
 * anyone who wants the product, and it would make the page worse for the exact
 * person it is meant to help.
 *
 * ── Honesty ──────────────────────────────────────────────────────────────────
 * The example rows are obviously examples — first name and initial, round
 * numbers — and the file says so. No invented business, no invented trainer.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'public', 'downloads');

/**
 * Quote a CSV field — including formulas.
 *
 * Leaving formulas unquoted looks tempting and is wrong: `=IF(D16="","",D16-E16)`
 * contains commas, so an unquoted field splits across three columns and corrupts
 * every row that uses it. Quoting is also harmless to the formula, because the
 * quotes are CSV transport: the parser strips them, the cell receives `=...`,
 * and the spreadsheet evaluates it exactly as if it had been typed.
 */
const f = (v) => `"${String(v).replace(/"/g, '""')}"`;
const row = (cells) => cells.map(f).join(',');

const HEADERS = [
  'Client',
  'Contact',
  'Package',
  'Sessions bought',
  'Sessions used',
  'Sessions remaining',
  'Package start',
  'Package expires',
  'Amount paid',
  'Payment status',
  'Notes',
];

/**
 * Two example rows and eighteen blank ones with the formula pre-filled, so the
 * count works from the first client the trainer types in rather than only for
 * the rows we happened to fill.
 */
const lines = [];

lines.push(row(['TRENIKO — free client & session tracker']));
lines.push(row(['Free to use and to change. No attribution needed. treniko.com']));
lines.push(row([]));
lines.push(row(['HOW TO USE']));
lines.push(row(['1. Fill in one row per client.']));
lines.push(row(['2. "Sessions remaining" calculates itself — do not type over it.']));
lines.push(row(['3. Update "Sessions used" as you complete sessions, not as you book them.']));
lines.push(row(['4. Decide once whether a late cancellation and a no-show use a session,']));
lines.push(row(['   write it in Notes, and tell the client before it first costs them one.']));
lines.push(row([]));
lines.push(row(['The two rows below are examples. Delete them.']));
lines.push(row([]));
lines.push(row(HEADERS));

// Header occupies row 13, so data starts at spreadsheet row 14.
const FIRST_DATA_ROW = 14;

const examples = [
  ['Alex M.', 'alex@example.com', '10-session pack', 10, 6, null, '2026-08-01', '2026-11-01', 300, 'Paid', 'Shoulder — no overhead press'],
  ['Jordan T.', '+385 xx xxx xxxx', '20-session pack', 20, 18, null, '2026-06-15', '2026-12-15', 560, 'Paid', 'Renew conversation due'],
];

examples.forEach((e, i) => {
  const r = FIRST_DATA_ROW + i;
  lines.push(row([e[0], e[1], e[2], e[3], e[4], `=D${r}-E${r}`, e[6], e[7], e[8], e[9], e[10]]));
});

for (let i = examples.length; i < 20; i += 1) {
  const r = FIRST_DATA_ROW + i;
  lines.push(row(['', '', '', '', '', `=IF(D${r}="","",D${r}-E${r})`, '', '', '', '', '']));
}

lines.push(row([]));
lines.push(row(['WEEKLY CHECK — ten minutes, and most of client retention']));
lines.push(row(['· Anyone with 2 or fewer sessions remaining — say something this week.']));
lines.push(row(['· Anyone with an outstanding payment — one message, not a mental note.']));
lines.push(row(['· Anyone who has not trained in 3 weeks and has not said why.']));
lines.push(row([]));
lines.push(row(['When this stops being enough — usually somewhere past 15-20 clients, or']));
lines.push(row(['when you are keeping sessions in a calendar and payments here and the two']));
lines.push(row(['disagree — TRENIKO does the same job without the copying: treniko.com']));

mkdirSync(OUT_DIR, { recursive: true });
const csv = `﻿${lines.join('\r\n')}\r\n`;
writeFileSync(join(OUT_DIR, 'treniko-client-session-tracker.csv'), csv, 'utf8');

console.log(`  wrote public/downloads/treniko-client-session-tracker.csv (${csv.length} bytes)`);
