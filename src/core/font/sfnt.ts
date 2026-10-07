/** Big-endian byte writer with patchable 16-bit offset slots, for hand-built OpenType tables. */
export class Writer {
  private bytes: number[] = [];

  get pos() {
    return this.bytes.length;
  }
  u8(v: number) {
    this.bytes.push(v & 255);
  }
  u16(v: number) {
    this.bytes.push((v >> 8) & 255, v & 255);
  }
  i16(v: number) {
    this.u16(v & 0xffff);
  }
  u32(v: number) {
    this.bytes.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  }
  tag(t: string) {
    for (let i = 0; i < 4; i++) this.bytes.push(t.charCodeAt(i));
  }
  raw(data: ArrayLike<number>) {
    for (let i = 0; i < data.length; i++) this.bytes.push(data[i]!);
  }
  /** Reserve a 16-bit offset to fill in later with `patch`. */
  slot() {
    const at = this.pos;
    this.u16(0);
    return at;
  }
  /** Fill a slot with the distance from `base` to the current position. */
  patch(at: number, base: number) {
    const v = this.pos - base;
    if (v > 0xffff) throw new RangeError(`Offset ${v} does not fit in 16 bits`);
    this.bytes[at] = (v >> 8) & 255;
    this.bytes[at + 1] = v & 255;
  }
  slot32() {
    const at = this.pos;
    this.u32(0);
    return at;
  }
  patch32(at: number, base: number) {
    const v = this.pos - base;
    this.bytes[at] = (v >>> 24) & 255;
    this.bytes[at + 1] = (v >>> 16) & 255;
    this.bytes[at + 2] = (v >>> 8) & 255;
    this.bytes[at + 3] = v & 255;
  }
  finish(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

export type Tables = Map<string, Uint8Array>;

const TRUE_TYPE = 0x00010000;
const CFF = 0x4f54544f; // 'OTTO'
const CHECKSUM_MAGIC = 0xb1b0afba;

export function readTables(font: ArrayBuffer): Tables {
  const dv = new DataView(font), count = dv.getUint16(4), tables: Tables = new Map();
  for (let i = 0; i < count; i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(...new Uint8Array(font, rec, 4));
    const offset = dv.getUint32(rec + 8), length = dv.getUint32(rec + 12);
    tables.set(tag, new Uint8Array(font.slice(offset, offset + length)));
  }
  return tables;
}

export const isTrueType = (font: ArrayBuffer) => new DataView(font).getUint32(0) === TRUE_TYPE;

export function checksum(bytes: Uint8Array): number {
  let sum = 0;
  const n = bytes.length;
  for (let i = 0; i < n; i += 4) {
    sum = (sum + (((bytes[i]! << 24) | ((bytes[i + 1] ?? 0) << 16) | ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0)) >>> 0)) >>> 0;
  }
  return sum;
}

/**
 * Assemble an sfnt from a set of tables: sorted directory, 4-byte padding, per-table checksums and the
 * whole-file `head.checkSumAdjustment`.
 */
export function writeSfnt(tables: Tables, flavour: 'truetype' | 'cff'): ArrayBuffer {
  const sorted = [...tables].sort(([a], [b]) => (a < b ? -1 : 1));
  const n = sorted.length, selector = Math.floor(Math.log2(n)), range = 2 ** selector * 16;
  let size = 12 + n * 16;
  for (const [, data] of sorted) size += (data.length + 3) & ~3;
  const out = new ArrayBuffer(size), dv = new DataView(out), u8 = new Uint8Array(out);
  dv.setUint32(0, flavour === 'truetype' ? TRUE_TYPE : CFF);
  dv.setUint16(4, n);
  dv.setUint16(6, range);
  dv.setUint16(8, selector);
  dv.setUint16(10, n * 16 - range);
  let offset = 12 + n * 16, headAt = -1;
  sorted.forEach(([tag, source], i) => {
    let data = source;
    if (tag === 'head') {
      data = source.slice();
      new DataView(data.buffer).setUint32(8, 0);
      headAt = offset;
    }
    const rec = 12 + i * 16;
    for (let k = 0; k < 4; k++) u8[rec + k] = tag.charCodeAt(k);
    dv.setUint32(rec + 4, checksum(data));
    dv.setUint32(rec + 8, offset);
    dv.setUint32(rec + 12, data.length);
    u8.set(data, offset);
    offset += (data.length + 3) & ~3;
  });
  if (headAt < 0) throw new Error('A font needs a head table');
  dv.setUint32(headAt + 8, (CHECKSUM_MAGIC - checksum(u8)) >>> 0);
  return out;
}

export function withTables(font: ArrayBuffer, replace: Record<string, Uint8Array>, drop: string[] = []): ArrayBuffer {
  const tables = readTables(font);
  for (const tag of drop) tables.delete(tag);
  for (const [tag, data] of Object.entries(replace)) tables.set(tag, data);
  return writeSfnt(tables, isTrueType(font) ? 'truetype' : 'cff');
}
