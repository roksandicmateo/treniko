/**
 * A very small .xlsx writer. One sheet, no dependencies.
 *
 * ── Why this exists rather than a library ────────────────────────────────────
 * The free tracker template shipped as CSV, on the reasoning that a cell
 * beginning with `=` is imported as a live formula by every spreadsheet
 * application. That reasoning is correct in English locales and wrong in the
 * one that matters most here.
 *
 * On a Windows install set to Croatian — or German, or French, or most of
 * continental Europe — Excel's list separator is `;`, not `,`. Double-clicking
 * a comma-delimited .csv there does not open a table: it opens one column of
 * eleven-field strings. The formulas do not run because they were never parsed
 * as cells, and the file is useless to precisely the trainer TRENIKO is built
 * for. That is not a formatting nicety, it is the template not working.
 *
 * .xlsx has no separator and no locale. It also carries column widths, a frozen
 * header, and a date format that cannot be misread as month-first.
 *
 * ── Why not `npm i exceljs` ──────────────────────────────────────────────────
 * A build-time dependency of that size, pulled into a repo whose whole
 * deployment story is `npm ci`, to emit one static file that changes about
 * twice a year. The format's minimum viable subset is a zip of five small XML
 * parts; that is what this is, and it is auditable in one sitting.
 *
 * ── Reproducibility ──────────────────────────────────────────────────────────
 * Generated output is committed, so the bytes must not change when the content
 * has not. Every zip entry therefore carries a fixed 1980-01-01 timestamp
 * rather than the current time — otherwise every run would produce a diff and
 * the file would be re-committed forever with no change in it.
 *
 * ── Scope ────────────────────────────────────────────────────────────────────
 * Deliberately not a general-purpose writer. One worksheet, inline strings, the
 * handful of styles the tracker uses. Anything beyond that belongs in a
 * library, at which point use one.
 */

import { deflateRawSync } from 'node:zlib';

/* ── zip ───────────────────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// 1980-01-01 00:00:00 in MS-DOS date/time. The epoch of the format, and the
// only value that keeps the output byte-identical between runs.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

/**
 * @param {{name: string, data: string}[]} files
 * @returns {Buffer} the zip archive
 */
function zip(files) {
  const local = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const raw = Buffer.from(file.data, 'utf8');
    const deflated = deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0, 6); // flags
    header.writeUInt16LE(8, 8); // deflate
    header.writeUInt16LE(DOS_TIME, 10);
    header.writeUInt16LE(DOS_DATE, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(deflated.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28); // extra length
    local.push(header, name, deflated);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4); // version made by
    dir.writeUInt16LE(20, 6); // version needed
    dir.writeUInt16LE(0, 8);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt16LE(DOS_TIME, 12);
    dir.writeUInt16LE(DOS_DATE, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(deflated.length, 20);
    dir.writeUInt32LE(raw.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt16LE(0, 30); // extra
    dir.writeUInt16LE(0, 32); // comment
    dir.writeUInt16LE(0, 34); // disk
    dir.writeUInt16LE(0, 36); // internal attrs
    dir.writeUInt32LE(0, 38); // external attrs
    dir.writeUInt32LE(offset, 42);
    central.push(dir, name);

    offset += header.length + name.length + deflated.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...local, centralBuf, end]);
}

/* ── spreadsheet ───────────────────────────────────────────────────────────── */

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** 0-based column index to a spreadsheet column name: 0 → A, 26 → AA. */
export function colName(i) {
  let n = i + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * An ISO date to an Excel serial number.
 *
 * The epoch is 1899-12-30, not 1900-01-01: Excel deliberately reproduces a
 * Lotus 1-2-3 bug in which 1900 is a leap year, and shifting the epoch back two
 * days is how every implementation absorbs it.
 */
export function dateSerial(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30);
  return Math.round(ms / 86400000);
}

/**
 * Style indexes, matching the `cellXfs` order in STYLES below. Referenced by
 * name at the call site so a reordering of the stylesheet cannot silently
 * repaint the document.
 */
export const S = {
  DEFAULT: 0,
  TITLE: 1,
  MUTED: 2,
  HEADER: 3,
  TEXT: 4,
  INT: 5,
  MONEY: 6,
  DATE: 7,
  FORMULA: 8,
  SECTION: 9,
};

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/></numFmts>
<fonts count="6">
<font><sz val="11"/><color theme="1"/><name val="Calibri"/></font>
<font><b/><sz val="16"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
<font><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
<font><b/><sz val="12"/><color rgb="FF0369A1"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF0EA5E9"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="1" fontId="4" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/**
 * Build a one-sheet workbook.
 *
 * A row is an array of cells. A cell is `null` (skip), a string, a number, or
 * `{ v, f, s, t }` where `f` is a formula written without its leading `=`.
 *
 * Formulas are emitted without a cached `<v>`, and the workbook sets
 * `fullCalcOnLoad`, so every reader computes them itself on open. Writing a
 * cached value would mean shipping an answer that could disagree with the
 * formula next to it.
 *
 * @param {object} opts
 * @param {string} opts.sheetName
 * @param {Array<Array<any>>} opts.rows
 * @param {number[]} opts.columnWidths
 * @param {number} [opts.freezeAtRow] 1-based row below which the pane scrolls
 * @returns {Buffer}
 */
export function workbook({ sheetName, rows, columnWidths, freezeAtRow }) {
  const cols = columnWidths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  const body = rows
    .map((cells, r) => {
      const rowNum = r + 1;
      const rendered = cells
        .map((cell, c) => {
          if (cell === null || cell === undefined || cell === '') return '';
          const ref = `${colName(c)}${rowNum}`;
          const spec =
            typeof cell === 'object' && !Array.isArray(cell) ? cell : { v: cell };
          const style = spec.s ? ` s="${spec.s}"` : '';

          if (spec.f) return `<c r="${ref}"${style}><f>${esc(spec.f)}</f></c>`;
          if (typeof spec.v === 'number') return `<c r="${ref}"${style}><v>${spec.v}</v></c>`;
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(spec.v)}</t></is></c>`;
        })
        .join('');
      return rendered ? `<row r="${rowNum}">${rendered}</row>` : '';
    })
    .filter(Boolean)
    .join('');

  const pane = freezeAtRow
    ? `<sheetView workbookViewId="0"><pane ySplit="${freezeAtRow}" topLeftCell="A${freezeAtRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView>`
    : `<sheetView workbookViewId="0"/>`;

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews>${pane}</sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${body}</sheetData>
</worksheet>`;

  return zip([
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
<calcPr calcId="0" fullCalcOnLoad="1"/>
</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { name: 'xl/styles.xml', data: STYLES },
    { name: 'xl/worksheets/sheet1.xml', data: sheet },
  ]);
}
