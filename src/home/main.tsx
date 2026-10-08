import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Stroke } from '../core/ink/strokes';
import { emptyProject } from '../core/project/schema';
import { loadProject, saveProject } from '../ui/projectDb';
import { startBackdrop } from '../ui/backdrop';
import { applyTheme } from '../ui/theme';
import { HandFont } from './handFont';
import { applyHand, splitHeadline } from './headline';
import { HOME_LETTERS, HomePad } from './HomePad';

applyTheme();
startBackdrop();

const CTA_AFTER = 3;
const letters = splitHeadline(document.getElementById('headline')!);
const font = new HandFont();

function updateCta(count: number) {
  for (const cta of document.querySelectorAll<HTMLElement>('[data-cta]')) cta.textContent = count >= CTA_AFTER ? 'Make the whole font' : 'Start writing';
}

function Home() {
  const [drawn, setDrawn] = useState<Set<string>>(new Set());

  // A returning visitor's letters are already in the headline when they arrive.
  useEffect(() => {
    let cancelled = false;
    loadProject()
      .then(async (project) => {
        const mine = HOME_LETTERS.filter((ch) => project?.glyphs[ch]?.[0]?.source === 'pen').map((ch): [string, Stroke[]] => {
          const v = project!.glyphs[ch]![0]!;
          return [ch, v.source === 'pen' ? v.strokes : []];
        });
        if (!mine.length || cancelled) return;
        const family = await font.add(mine);
        if (cancelled) return;
        applyHand(letters, family, font.drawn, new Set());
        setDrawn(font.drawn);
        updateCta(font.drawn.size);
      })
      .catch(() => {
        // No storage in this browser: the home page still works, it just starts empty.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onLetter = async (ch: string, strokes: Stroke[]) => {
    setDrawn((d) => new Set([...d, ch]));
    const family = await font.add([[ch, strokes]]);
    applyHand(letters, family, font.drawn, new Set([ch]));
    updateCta(font.drawn.size);
    try {
      const project = (await loadProject()) ?? emptyProject();
      project.glyphs[ch] = [{ source: 'pen', strokes, updatedAt: Date.now() }];
      await saveProject(project);
    } catch {
      // Without storage the letters can't follow into the studio; the swap above still happened.
    }
  };

  return <HomePad drawn={drawn} onLetter={onLetter} />;
}

createRoot(document.getElementById('home-pad')!).render(
  <StrictMode>
    <Home />
  </StrictMode>,
);
