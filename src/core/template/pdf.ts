import aruco from '../../vendor/aruco';
import { MARKS } from '../glyphs/marks';
import { cellBox, cellFrame, GUIDES, labelOrigin, MARKER_DICTIONARY, MARKER_MODULES, MARKER_SIZE, markerId, markerOrigins, PAGES, PAPER, unitToPage, type Cell, type PaperSize } from './layout';

const PAGE_TITLES = ['Lowercase, figures and punctuation', 'Capitals, symbols and accent marks', 'Second and third versions of your most used letters'];
const INSTRUCTIONS = 'Use a dark pen. One character per box, sitting on the lowest dotted line.';
const PRINTING = 'Print at 100% (not “fit to page”) and keep all four corner squares in the photo.';

// Helvetica in WinAnsiEncoding: ASCII plus the few others the labels need.
const WIN_ANSI: Record<string, number> = { '£': 0xa3, '€': 0x80, '“': 0x93, '”': 0x94, '—': 0x97 };

function pdfString(text: string): string {
  let out = '(';
  for (const ch of text) {
    const code = WIN_ANSI[ch] ?? ch.charCodeAt(0);
    if (code > 126 || code < 32) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += ch === '(' || ch === ')' || ch === '\\' ? `\\${ch}` : ch;
  }
  return `${out})`;
}

const ordinal = ['', '2nd', '3rd'];
const cellLabel = (c: Cell) => (c.ch in MARKS ? MARKS[c.ch as keyof typeof MARKS] : c.version ? `${c.ch} ${ordinal[c.version]}` : c.ch);

function pageContent(size: PaperSize, page: number, codes: string[]): string {
  const { height } = PAPER[size];
  const n = (v: number) => v.toFixed(2);
  const Y = (y: number) => n(height - y);
  const ops: string[] = [];
  const module = MARKER_SIZE / MARKER_MODULES;

  markerOrigins(size).forEach(([mx, my], corner) => {
    const code = codes[markerId(size, page, corner)]!;
    ops.push('0 g', `${n(mx)} ${Y(my + MARKER_SIZE)} ${n(MARKER_SIZE)} ${n(MARKER_SIZE)} re f`, '1 g');
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      if (code[y * 6 + x] === '1') ops.push(`${n(mx + (x + 1) * module)} ${Y(my + (y + 2) * module)} ${n(module)} ${n(module)} re f`);
    }
  });

  PAGES[page]!.forEach((cell, i) => {
    const b = cellBox(size, i), f = cellFrame(size, i), [lx, ly] = labelOrigin(size, i);
    ops.push('0.69 G 0.6 w [] 0 d', `${n(f.x)} ${Y(f.y + f.h)} ${n(f.w)} ${n(f.h)} re S`);
    ops.push('0.76 G 0.8 w [1.2 2.4] 0 d');
    for (const u of GUIDES) {
      const [, gy] = unitToPage(b, [0, u]);
      ops.push(`${n(b.x)} ${Y(gy)} m ${n(b.x + b.w)} ${Y(gy)} l S`);
    }
    ops.push('[] 0 d', 'BT /F1 8 Tf 0.45 g', `${n(lx)} ${Y(ly)} Td ${pdfString(cellLabel(cell))} Tj ET`);
  });

  ops.push('BT /F1 11 Tf 0.1 g', `${n(84)} ${Y(42)} Td ${pdfString(`Handwriting Font Maker — page ${page + 1} of 3`)} Tj ET`);
  ops.push('BT /F1 9 Tf 0.35 g', `${n(84)} ${Y(56)} Td ${pdfString(PAGE_TITLES[page]!)} Tj ET`);
  ops.push('BT /F1 9 Tf 0.35 g', `${n(84)} ${Y(72)} Td ${pdfString(INSTRUCTIONS)} Tj ET`);
  ops.push('BT /F1 8 Tf 0.45 g', `${n(84)} ${Y(height - 40)} Td ${pdfString(PRINTING)} Tj ET`);
  return ops.join('\n');
}

/** The three template pages for one paper size, as a self-contained PDF (Helvetica, no embedded fonts). */
export function templatePdf(size: PaperSize): Uint8Array {
  const { width, height } = PAPER[size];
  const codes = new aruco.AR.Dictionary(MARKER_DICTIONARY).codeList;
  const pages = PAGES.map((_, p) => pageContent(size, p, codes));
  // Objects: 1 catalog, 2 page tree, 3 font, then a page and its content stream for each page.
  const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    ...pages.flatMap((content, i) => [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ]),
  ];
  let pdf = '%PDF-1.4\n%âãÏÓ\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Every character above is below U+0100, so one byte each (the header's binary marker included).
  return Uint8Array.from(pdf, (c) => c.charCodeAt(0));
}

