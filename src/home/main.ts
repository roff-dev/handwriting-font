import { startBackdrop } from '../ui/backdrop';
import { applyTheme } from '../ui/theme';
import { splitHeadline } from './headline';
import { writeHeadline } from './intro';

applyTheme();
startBackdrop();

// The headline writes itself first, so this entry stays small; the pad's React island loads alongside.
const headline = document.getElementById('headline')!;
const letters = splitHeadline(headline);
const intro = writeHeadline(headline, letters);
void import('./island').then((m) => m.mountHome(letters, intro));
