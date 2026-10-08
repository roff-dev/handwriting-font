import type { Photo } from '../../core/photo/image';

/** Longest side the reader works at; bigger photos are scaled down first (spike: 1.4–1.7 s a page at this size). */
const MAX_SIDE = 2000;

export class NotAPhotoError extends Error {}

/** Decode a chosen file to pixels, honouring its orientation, plus a JPEG preview for the corner editor. */
export async function decodePhoto(file: File): Promise<{ photo: Photo; preview: string }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new NotAPhotoError();
  }
  const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * k), height = Math.round(bitmap.height * k);
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  return { photo: { width, height, data }, preview: blob ? URL.createObjectURL(blob) : '' };
}
