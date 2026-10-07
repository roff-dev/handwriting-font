import { zlibSync } from 'fflate';
import { checksum, isTrueType, readTables } from './sfnt';

/**
 * WOFF 1.0: each table zlib-compressed when that makes it smaller, 4-byte aligned, with the original
 * checksums. Canva and some older site builders take WOFF but not WOFF2.
 */
export function toWoff(font: ArrayBuffer): Uint8Array {
  const tables = [...readTables(font)].sort(([a], [b]) => (a < b ? -1 : 1));
  const entries = tables.map(([tag, data]) => {
    const z = zlibSync(data, { level: 9 });
    return { tag, data, stored: z.length < data.length ? z : data };
  });
  const headerSize = 44 + entries.length * 20;
  const padded = (n: number) => (n + 3) & ~3;
  const total = headerSize + entries.reduce((a, e) => a + padded(e.stored.length), 0);
  const out = new Uint8Array(total), dv = new DataView(out.buffer);

  dv.setUint32(0, 0x774f4646); // 'wOFF'
  dv.setUint32(4, isTrueType(font) ? 0x00010000 : 0x4f54544f);
  dv.setUint32(8, total);
  dv.setUint16(12, entries.length);
  dv.setUint32(16, 12 + entries.length * 16 + entries.reduce((a, e) => a + padded(e.data.length), 0));
  dv.setUint16(20, 1);

  let offset = headerSize;
  entries.forEach(({ tag, data, stored }, i) => {
    const rec = 44 + i * 20;
    for (let k = 0; k < 4; k++) out[rec + k] = tag.charCodeAt(k);
    dv.setUint32(rec + 4, offset);
    dv.setUint32(rec + 8, stored.length);
    dv.setUint32(rec + 12, data.length);
    dv.setUint32(rec + 16, tag === 'head' ? headChecksum(data) : checksum(data));
    out.set(stored, offset);
    offset += padded(stored.length);
  });
  return out;
}

/** The directory checksum of `head` is computed with checkSumAdjustment zeroed. */
function headChecksum(head: Uint8Array) {
  const copy = head.slice();
  new DataView(copy.buffer).setUint32(8, 0);
  return checksum(copy);
}
