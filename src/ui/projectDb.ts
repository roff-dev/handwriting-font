import { createStore, get, set } from 'idb-keyval';
import type { Project } from '../core/project/schema';
import { deserialize, serialize } from '../core/project/serialize';

// One saved project per browser, shared by the home page and the studio, so letters written on the home
// page are already there when the studio opens.
const KEY = 'project';
let db: ReturnType<typeof createStore> | undefined;
const store = () => (db ??= createStore('handwriting-font-maker', 'projects'));

/** The saved project, or null if there isn't one. Throws when the browser won't give us storage. */
export async function loadProject(): Promise<Project | null> {
  const bytes = await get<Uint8Array>(KEY, store());
  return bytes ? deserialize(bytes) : null;
}

export const saveProject = (project: Project) => set(KEY, serialize(project), store());
