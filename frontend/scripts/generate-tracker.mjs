/**
 * Generates the free client & session tracker template, in two formats.
 *
 * ── Why both, and why .xlsx is now the one we lead with ──────────────────────
 * The template originally shipped as CSV only, on the reasoning that a cell
 * beginning with `=` is imported as a live formula by Excel, Google Sheets,
 * LibreOffice and Numbers alike. That is true, and it misses a locale problem
 * that matters more than the formulas do.
 *
 * Excel splits a .csv on the system list separator. In Croatia — and across
 * most of continental Europe — that separator is `;`, not `,`. Double-clicking
 * this comma-delimited file on such a machine produces one column of long
 * strings: no table, no columns, and no formulas, because nothing was ever
 * parsed as a cell. The trainer this template is written for is disproportionately
 * likely to be on exactly that locale.
 *
 * .xlsx has no separator to get wrong. It also keeps column widths, a frozen
 * header row, an unambiguous `yyyy-mm-dd` date format, and currency-neutral
 * money formatting — none of which a CSV can carry.
 *
 * The CSV stays, because it is still the better file for importing into
 * something else and it is readable in a text editor. Both come from the one
 * row model below, so they cannot drift apart.
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
import { workbook, dateSerial, S } from './lib/xlsx.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'public', 'downloads');

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

const PREAMBLE = [
  ['TRENIKO — free client & session tracker'],
  ['Free to use and to change. No attribution needed. treniko.com'],
  [],
  ['HOW TO USE'],
  ['1. Fill in one row per client.'],
  ['2. "Sessions remaining" calculates itself — do not type over it.'],
  ['3. Update "Sessions used" as you complete sessions, not as you book them.'],
  ['4. Decide once whether a late cancellation and a no-show use a session,'],
  ['   write it in Notes, and tell the client before it first costs them one.'],
  [],
  ['The two rows below are examples. Delete them.'],
  [],
];

/** Header occupies row 13, so data starts at spreadsheet row 14. */
const FIRST_DATA_ROW = PREAMBLE.length + 2;
const DATA_ROWS = 20;

const EXAMPLES = [
  {
    client: 'Alex M.',
    contact: 'alex@example.com',
    pack: '10-session pack',
    bought: 10,
    used: 6,
    start: '2026-08-01',
    expires: '2026-11-01',
    paid: 300,
    status: 'Paid',
    notes: 'Shoulder — no overhead press',
  },
  {
    client: 'Jordan T.',
    contact: '+385 xx xxx xxxx',
    pack: '20-session pack',
    bought: 20,
    used: 18,
    start: '2026-06-15',
    expires: '2026-12-15',
    paid: 560,
    status: 'Paid',
    notes: 'Renew conversation due',
  },
];

const FOOTER = [
  [],
  ['WEEKLY CHECK — ten minutes, and most of client retention'],
  ['· Anyone with 2 or fewer sessions remaining — say something this week.'],
  ['· Anyone with an outstanding payment — one message, not a mental note.'],
  ['· Anyone who has not trained in 3 weeks and has not said why.'],
  [],
  ['When this stops being enough — usually somewhere past 15-20 clients, or'],
  ['when you are keeping sessions in a calendar and payments here and the two'],
  ['disagree — TRENIKO does the same job without the copying: treniko.com'],
];

/**
 * The remaining-sessions formula for a given spreadsheet row.
 *
 * The guard is not decoration. Without it, all eighteen blank rows would show
 * `0` remaining on open, which reads as eighteen clients who have used
 * everything they bought.
 */
const remaining = (r) => `IF(D${r}="","",D${r}-E${r})`;

/* ── XLSX ──────────────────────────────────────────────────────────────────── */

const xlsxRows = [];

PREAMBLE.forEach((line, i) => {
  if (!line.length) return xlsxRows.push([]);
  const style = i === 0 ? S.TITLE : i === 3 ? S.SECTION : S.MUTED;
  xlsxRows.push([{ v: line[0], s: style }]);
});

xlsxRows.push(HEADERS.map((h) => ({ v: h, s: S.HEADER })));

EXAMPLES.forEach((e, i) => {
  const r = FIRST_DATA_ROW + i;
  xlsxRows.push([
    { v: e.client, s: S.TEXT },
    { v: e.contact, s: S.TEXT },
    { v: e.pack, s: S.TEXT },
    { v: e.bought, s: S.INT },
    { v: e.used, s: S.INT },
    { f: remaining(r), s: S.FORMULA },
    { v: dateSerial(e.start), s: S.DATE },
    { v: dateSerial(e.expires), s: S.DATE },
    { v: e.paid, s: S.MONEY },
    { v: e.status, s: S.TEXT },
    { v: e.notes, s: S.TEXT },
  ]);
});

for (let i = EXAMPLES.length; i < DATA_ROWS; i += 1) {
  const r = FIRST_DATA_ROW + i;
  // Blank cells still carry their style, so a trainer typing into row 25 gets
  // the same date and money formatting as the example rows — otherwise the
  // template is only formatted for the two rows it ships with.
  xlsxRows.push([
    { v: '', s: S.TEXT },
    { v: '', s: S.TEXT },
    { v: '', s: S.TEXT },
    { v: '', s: S.INT },
    { v: '', s: S.INT },
    { f: remaining(r), s: S.FORMULA },
    { v: '', s: S.DATE },
    { v: '', s: S.DATE },
    { v: '', s: S.MONEY },
    { v: '', s: S.TEXT },
    { v: '', s: S.TEXT },
  ]);
}

FOOTER.forEach((line, i) => {
  if (!line.length) return xlsxRows.push([]);
  xlsxRows.push([{ v: line[0], s: i === 1 ? S.SECTION : S.MUTED }]);
});

const xlsx = workbook({
  sheetName: 'Clients',
  rows: xlsxRows,
  columnWidths: [18, 24, 18, 15, 14, 18, 14, 15, 13, 15, 34],
  freezeAtRow: FIRST_DATA_ROW - 1,
});

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'treniko-client-session-tracker.xlsx'), xlsx);
console.log(
  `  wrote public/downloads/treniko-client-session-tracker.xlsx (${xlsx.length} bytes)`
);

/* ── CSV ───────────────────────────────────────────────────────────────────── */

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

const lines = [];

PREAMBLE.forEach((line) => lines.push(row(line.length ? line : [])));
lines.push(row(HEADERS));

EXAMPLES.forEach((e, i) => {
  const r = FIRST_DATA_ROW + i;
  lines.push(
    row([e.client, e.contact, e.pack, e.bought, e.used, `=D${r}-E${r}`, e.start, e.expires, e.paid, e.status, e.notes])
  );
});

for (let i = EXAMPLES.length; i < DATA_ROWS; i += 1) {
  const r = FIRST_DATA_ROW + i;
  lines.push(row(['', '', '', '', '', `=${remaining(r)}`, '', '', '', '', '']));
}

FOOTER.forEach((line) => lines.push(row(line.length ? line : [])));

const csv = `﻿${lines.join('\r\n')}\r\n`;
writeFileSync(join(OUT_DIR, 'treniko-client-session-tracker.csv'), csv, 'utf8');

console.log(`  wrote public/downloads/treniko-client-session-tracker.csv (${csv.length} bytes)`);
