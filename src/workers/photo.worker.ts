import { expose } from 'comlink';
import type { Point } from '../core/geometry';
import { locate, placeByCorners, readBoxes, type BoxResult, type Placement } from '../core/photo/extract';
import type { Photo } from '../core/photo/image';
import type { PaperSize } from '../core/template/layout';

let photo: Photo | undefined;

const api = {
  /** Keep the decoded photo here and look for the page's markers. */
  load(p: Photo) {
    photo = p;
    return locate(p);
  },

  byCorners(size: PaperSize, page: number, corners: Point[]): Placement {
    return placeByCorners(size, page, corners);
  },

  /** Read every box, reporting each one as it's done so the grid can fill in. */
  read(place: Placement, onBox: (r: BoxResult) => void) {
    if (!photo) throw new Error('Load a photo first');
    return readBoxes(photo, place, onBox);
  },
};

export type PhotoWorkerApi = typeof api;
expose(api);
