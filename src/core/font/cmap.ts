/**
 * opentype.js writes a single Windows (3,1) cmap subtable. Add a Unicode-platform (0,3) record pointing at
 * the same subtable, so Apple platforms find a platform-0 mapping as well.
 */
export function withUnicodePlatform(cmap: Uint8Array): Uint8Array {
  const dv = new DataView(cmap.buffer, cmap.byteOffset, cmap.byteLength), count = dv.getUint16(2);
  const records: [number, number, number][] = [];
  for (let i = 0; i < count; i++) records.push([dv.getUint16(4 + i * 8), dv.getUint16(6 + i * 8), dv.getUint32(8 + i * 8)]);
  const windows = records.find(([p, e]) => p === 3 && e === 1);
  if (!windows || records.some(([p]) => p === 0)) return cmap;
  records.push([0, 3, windows[2]]);
  records.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out = new Uint8Array(cmap.length + 8), o = new DataView(out.buffer);
  o.setUint16(0, 0);
  o.setUint16(2, records.length);
  records.forEach(([p, e, offset], i) => {
    o.setUint16(4 + i * 8, p);
    o.setUint16(6 + i * 8, e);
    o.setUint32(8 + i * 8, offset + 8);
  });
  out.set(cmap.subarray(4 + count * 8), 4 + records.length * 8);
  return out;
}
