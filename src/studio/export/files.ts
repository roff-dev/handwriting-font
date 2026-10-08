import { strToU8, zipSync } from 'fflate';
import { MOBILECONFIG_TYPE } from '../../core/font/mobileconfig';
import { postScriptName } from '../../core/font/names';
import { serialize } from '../../core/project/serialize';
import { fontWorker, freshFont } from '../font';
import { useStudio } from '../store';
import { readme } from './guidance';

export type FileKind = 'otf' | 'ttf' | 'woff2' | 'woff' | 'css' | 'mobileconfig' | 'zip' | 'project';

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** A plain ArrayBuffer-backed copy, which is what Blob and zip accept. */
const bytes = (b: ArrayBuffer | Uint8Array) => new Uint8Array(b);

export const projectFileName = (name: string) => `${name.trim().replace(/[^A-Za-z0-9 ]+/g, '').replace(/\s+/g, '-') || 'My-Hand'}.hwfont`;

/** Build one export file from the current project, rebuilding the font first if anything changed. */
export async function makeFile(kind: FileKind): Promise<{ blob: Blob; name: string }> {
  const project = useStudio.getState().project;
  if (kind === 'project') return { blob: new Blob([bytes(serialize(project))], { type: 'application/octet-stream' }), name: projectFileName(project.name) };
  if (!(await freshFont())) throw new Error('The font could not be built');
  const ps = postScriptName(project.name), w = fontWorker();
  switch (kind) {
    case 'otf':
      return { blob: new Blob([await w.otf()], { type: 'font/otf' }), name: `${ps}.otf` };
    case 'ttf':
      return { blob: new Blob([await w.ttf()], { type: 'font/ttf' }), name: `${ps}.ttf` };
    case 'woff':
      return { blob: new Blob([bytes(await w.woff())], { type: 'font/woff' }), name: `${ps}.woff` };
    case 'woff2':
      return { blob: new Blob([bytes(await w.woff2())], { type: 'font/woff2' }), name: `${ps}.woff2` };
    case 'css':
      return { blob: new Blob([await w.css()], { type: 'text/css' }), name: `${ps}.css` };
    case 'mobileconfig':
      return { blob: new Blob([await w.mobileconfig()], { type: MOBILECONFIG_TYPE }), name: `${ps}.mobileconfig` };
    case 'zip': {
      const [otf, ttf, woff, css, profile] = await Promise.all([w.otf(), w.ttf(), w.woff(), w.css(), w.mobileconfig()]);
      const files: Record<string, Uint8Array> = {
        [`${ps}.otf`]: bytes(otf),
        [`${ps}.ttf`]: bytes(ttf),
        [`${ps}.woff`]: bytes(woff),
        [`${ps}.css`]: strToU8(css),
        [`${ps}.mobileconfig`]: strToU8(profile),
        'README.txt': strToU8(readme(project.name)),
      };
      try {
        files[`${ps}.woff2`] = bytes(await w.woff2());
      } catch {
        // Without the compressor the zip still has WOFF, which the CSS falls back to.
      }
      return { blob: new Blob([bytes(zipSync(files, { level: 6 }))], { type: 'application/zip' }), name: `${ps}.zip` };
    }
  }
}
