/** A decoded photo: RGBA bytes, like canvas ImageData. */
export type Photo = { width: number; height: number; data: Uint8ClampedArray };

export function greyscale({ width, height, data }: Photo): Float32Array {
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
  return out;
}

/** Separable running-sum box blur, edges clamped. */
export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))]!;
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / n;
      acc += src[y * w + Math.min(w - 1, x + r + 1)]! - src[y * w + Math.max(0, x - r)]!;
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]!;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x]! - tmp[Math.max(0, y - r) * w + x]!;
    }
  }
  return out;
}

/**
 * Even out the lighting: divide every pixel by a heavily blurred copy of the photo, so paper reads as
 * about 1 everywhere, under a shadow or in the bright corner alike, and ink stays well below it.
 */
export function flattenLighting(grey: Float32Array, w: number, h: number, radius: number): Float32Array {
  const bg = boxBlur(grey, w, h, radius), out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1.2, grey[i]! / Math.max(1, bg[i]!));
  return out;
}

/** Bilinear sample with out-of-image reads returning `outside`. */
export function sample(img: Float32Array, w: number, h: number, x: number, y: number, outside: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) return outside;
  const fx = x - x0, fy = y - y0, i = y0 * w + x0;
  return img[i]! * (1 - fx) * (1 - fy) + img[i + 1]! * fx * (1 - fy) + img[i + w]! * (1 - fx) * fy + img[i + w + 1]! * fx * fy;
}
