// opentype.js 2.0 ships without type definitions. This covers the part of its API the font builder uses.
declare module 'opentype.js' {
  export class Path {
    moveTo(x: number, y: number): void;
    curveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void;
    close(): void;
  }
  export class Glyph {
    constructor(options: { name: string; unicode?: number; advanceWidth: number; path: Path });
  }
  export class Font {
    constructor(options: {
      familyName: string;
      styleName: string;
      unitsPerEm: number;
      ascender: number;
      descender: number;
      weightClass?: number;
      glyphs: Glyph[];
      tables?: { os2?: Record<string, number | string> };
    });
    toArrayBuffer(): ArrayBuffer;
  }
  export function parse(buffer: ArrayBuffer): { numGlyphs: number };
  const opentype: { Font: typeof Font; Glyph: typeof Glyph; Path: typeof Path; parse: typeof parse };
  export default opentype;
}
