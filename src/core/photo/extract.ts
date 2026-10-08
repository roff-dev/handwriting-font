import { ringArea, type Contour, type Point } from '../geometry';
import { fitRing } from '../ink/fit';
import { orient } from '../ink/orient';
import { cellBox, COLS, identify, markerCorners, pageToUnit, PAGES, PAPER, ROWS, type Cell, type PaperSize } from '../template/layout';
import { homography, project, type Homography } from './homography';
import { flattenLighting, greyscale, sample, type Photo } from './image';
import { findMarkers, markerPairs, pageOf, type PageFix } from './markers';
import { dropSpecks, smoothRing, traceBitmap } from './trace';

/** Samples per PDF point when reading a box: about 300 dpi. */
const DENSITY = 4.17;
/**
 * Ink is anything darker than halfway between the box's ink and paper levels. Blur spreads a stroke evenly
 * both ways, so its true edge stays at the halfway point (0.55 in the spike thickened strokes in blurry
 * photos: median IoU 0.767 against 0.805 at 0.5 on the hard set).
 */
const INK_LEVEL = 0.5;
const MIN_SPECK = 120;
const MIN_RING_AREA = 150;
const PHOTO_FIT = { maxError: 3, cornerDeg: 75, simplify: 1.5 };

export type Placement = { size: PaperSize; page: number; toPhoto: Homography };
export type BoxResult = { index: number; cell: Cell; contours: Contour[] | null };

/** Mean distance between each marker's detected corners and where the fitted page puts them. */
function residuals(fix: PageFix, toPhoto: Homography): number[] {
  return fix.markers.map((m) => {
    const corners = markerCorners(fix.size, identify(m.id)!.corner);
    return m.corners.reduce((sum, c, k) => {
      const [x, y] = project(toPhoto, corners[k]!);
      return sum + Math.hypot(x - c[0], y - c[1]);
    }, 0) / m.corners.length;
  });
}

const fit = (fix: PageFix) => {
  const { page, photo } = markerPairs(fix);
  return homography(page, photo);
};

/**
 * Locate the page in a photo from its markers. Needs three of the four; with fewer, ask for corners. In
 * a blurry photo the detector can return a marker with misplaced corners; one that disagrees with the
 * fit far more than the others is dropped and the page refitted from the rest.
 */
export function locate(photo: Photo): Placement | { error: 'markers'; found: number } {
  const fix = pageOf(findMarkers(photo));
  if (!fix || fix.markers.length < 3) return { error: 'markers', found: fix?.markers.length ?? 0 };
  let toPhoto = fit(fix);
  while (fix.markers.length > 3) {
    const errors = residuals(fix, toPhoto), worst = errors.indexOf(Math.max(...errors));
    const others = errors.filter((_, i) => i !== worst).sort((a, b) => a - b);
    if (errors[worst]! <= Math.max(2, 3 * others[others.length >> 1]!)) break;
    fix.markers.splice(worst, 1);
    toPhoto = fit(fix);
  }
  return { size: fix.size, page: fix.page, toPhoto };
}

/** The page from four corners the user placed (top-left, top-right, bottom-right, bottom-left). */
export function placeByCorners(size: PaperSize, page: number, corners: Point[]): Placement {
  const { width, height } = PAPER[size];
  return { size, page, toPhoto: homography([[0, 0], [width, 0], [width, height], [0, height]], corners) };
}

/**
 * Read every box on the located page. Each box is sampled through the homography, thresholded against its
 * own paper and ink levels (so a shadow across one box doesn't decide another), cleaned of specks, traced
 * along pixel edges and fitted to curves in font units. An empty box comes back as null.
 */
export function readBoxes(photo: Photo, place: Placement, onBox?: (r: BoxResult) => void): BoxResult[] {
  const { width: W, height: H } = photo;
  const grey = flattenLighting(greyscale(photo), W, H, Math.round(W / 30));
  const cells = PAGES[place.page]!;
  const results: BoxResult[] = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const b = cellBox(place.size, i), w = Math.round(b.w * DENSITY), h = Math.round(b.h * DENSITY);
    const values = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const [px, py] = project(place.toPhoto, [b.x + x / DENSITY, b.y + y / DENSITY]);
      values[y * w + x] = sample(grey, W, H, px, py, 1);
    }
    const sorted = Float32Array.from(values).sort();
    const paper = sorted[Math.floor(sorted.length * 0.9)]!, dark = sorted[Math.floor(sorted.length * 0.005)]!;
    let contours: Contour[] | null = null;
    if (dark <= 0.6 * paper) {
      const threshold = dark + (paper - dark) * INK_LEVEL;
      const ink = new Uint8Array(w * h);
      for (let k = 0; k < w * h; k++) ink[k] = values[k]! < threshold ? 1 : 0;
      const rings = traceBitmap(dropSpecks(ink, w, h, MIN_SPECK), w, h)
        .map((ring) => ring.map(([x, y]) => pageToUnit(b, [b.x + x / DENSITY, b.y + y / DENSITY])))
        .filter((ring) => Math.abs(ringArea(ring)) > MIN_RING_AREA);
      const fitted = rings.map((r) => fitRing(smoothRing(r), PHOTO_FIT)).filter((c) => c.length);
      if (fitted.length) contours = orient(fitted);
    }
    const result = { index: i, cell: cells[i]!, contours };
    results.push(result);
    onBox?.(result);
  }
  return results;
}
