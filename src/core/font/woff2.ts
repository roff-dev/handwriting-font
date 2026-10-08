import { isTrueType, readTables } from './sfnt';

// WOFF2's directory names common tables by their index in this list instead of spelling out the tag.
const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT',
  'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH',
  'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];
const ARBITRARY_TAG = 63;
/** For glyf and loca, transform version 3 means “stored as is”; for every other table that is version 0. */
const NULL_TRANSFORM_GLYF_LOCA = 3 << 6;

/** WOFF2's variable-length unsigned integer: 7 bits per byte, most significant first, high bit = more follows. */
export function uintBase128(value: number): number[] {
  const out = [value & 0x7f];
  for (let v = value >>> 7; v > 0; v >>>= 7) out.unshift(0x80 | (v & 0x7f));
  return out;
}

const pad4 = (n: number) => (n + 3) & ~3;

/**
 * WOFF2 with the null transform on every table: a 48-byte header, a compact table directory and one
 * Brotli stream of the tables back to back. Skipping the optional glyf/loca transform costs a few
 * percent of size, and avoids the WebAssembly WOFF2 encoders, which all need `eval` (blocked by our CSP).
 */
export function toWoff2(font: ArrayBuffer, brotli: (data: Uint8Array) => Uint8Array): Uint8Array {
  const tables = [...readTables(font)].sort(([a], [b]) => (a < b ? -1 : 1));
  // Decoders expect loca straight after glyf.
  const loca = tables.findIndex(([t]) => t === 'loca');
  if (loca >= 0) {
    const [entry] = tables.splice(loca, 1);
    tables.splice(tables.findIndex(([t]) => t === 'glyf') + 1, 0, entry!);
  }

  const directory: number[] = [];
  for (const [tag, data] of tables) {
    const known = KNOWN_TAGS.indexOf(tag);
    const transform = tag === 'glyf' || tag === 'loca' ? NULL_TRANSFORM_GLYF_LOCA : 0;
    directory.push((known >= 0 ? known : ARBITRARY_TAG) | transform);
    if (known < 0) for (let i = 0; i < 4; i++) directory.push(tag.charCodeAt(i));
    directory.push(...uintBase128(data.length));
  }

  const raw = new Uint8Array(tables.reduce((n, [, d]) => n + d.length, 0));
  let at = 0;
  for (const [, d] of tables) {
    raw.set(d, at);
    at += d.length;
  }
  const compressed = brotli(raw);

  const headerSize = 48;
  const length = pad4(headerSize + directory.length + compressed.length);
  const out = new Uint8Array(length), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x774f4632); // 'wOF2'
  dv.setUint32(4, isTrueType(font) ? 0x00010000 : 0x4f54544f);
  dv.setUint32(8, length);
  dv.setUint16(12, tables.length);
  dv.setUint32(16, 12 + 16 * tables.length + tables.reduce((n, [, d]) => n + pad4(d.length), 0));
  dv.setUint32(20, compressed.length);
  dv.setUint16(24, 1);
  out.set(directory, headerSize);
  out.set(compressed, headerSize + directory.length);
  return out;
}
