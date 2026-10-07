import { createStore, get, set } from 'idb-keyval';
import { deserialize, serialize } from '../core/project/serialize';
import { characters } from '../core/project/sets';
import { useStudio } from './store';

const KEY = 'project';
const SAVE_DELAY = 500;
let db: ReturnType<typeof createStore> | undefined;
const store = () => (db ??= createStore('handwriting-font-maker', 'projects'));

export type Restored = { drawn: number; total: number } | null;

/** Load the autosaved project, if there is one. Ask the browser to keep our storage while we're at it. */
export async function restore(): Promise<Restored> {
  void navigator.storage?.persist?.().catch(() => false);
  try {
    const bytes = await get<Uint8Array>(KEY, store());
    useStudio.getState().setStorage('ok');
    if (!bytes) return null;
    const project = deserialize(bytes);
    useStudio.getState().replaceProject(project);
    const chars = characters(project.settings.sets);
    return { drawn: chars.filter((ch) => project.glyphs[ch]?.[0]).length, total: chars.length };
  } catch {
    useStudio.getState().setStorage('unavailable');
    return null;
  }
}

/** Save 500 ms after the project last changed. */
export function startAutosave() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return useStudio.subscribe((state, prev) => {
    if (state.project === prev.project || state.storage === 'unavailable') return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      set(KEY, serialize(useStudio.getState().project), store()).catch(() => useStudio.getState().setStorage('unavailable'));
    }, SAVE_DELAY);
  });
}
