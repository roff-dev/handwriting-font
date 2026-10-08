import { imageFileName, pngScale, toSvg, type TextImage } from '../../core/font/image';

export async function deliver(blob: Blob, name: string) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const saveSvg = (image: TextImage, colour: string, text: string) =>
  deliver(new Blob([toSvg(image, colour)], { type: 'image/svg+xml' }), `${imageFileName(text)}.svg`);

/** Draw the same glyph paths onto a transparent canvas; no font or SVG decoding involved. */
export async function savePng(image: TextImage, colour: string, text: string) {
  const k = pngScale(image);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(image.width * k);
  canvas.height = Math.ceil(image.height * k);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = colour;
  for (const g of image.glyphs) {
    ctx.setTransform(k, 0, 0, k, g.x * k, g.y * k);
    ctx.fill(new Path2D(g.d));
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (blob) await deliver(blob, `${imageFileName(text)}.png`);
}
