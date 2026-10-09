import { useState } from 'react';
import type { Stroke } from '../core/ink/strokes';
import { Pad } from '../ui/pad/Pad';

/** The headline's lowercase letters, most frequent first, so the swap shows up quickly. */
export const HOME_LETTERS = [...'ourandhwitgself'];

type Props = { drawn: Set<string>; onLetter: (ch: string, strokes: Stroke[]) => void };

/** A small writing pad that asks for the headline's letters one by one. */
export function HomePad({ drawn, onLetter }: Props) {
  const [draft, setDraft] = useState<Stroke[]>([]);
  const [penSeen, setPenSeen] = useState(false);
  const next = HOME_LETTERS.find((ch) => !drawn.has(ch));

  if (!next) {
    return (
      <div className="home-pad home-pad--done">
        <p className="home-pad__prompt">That's every letter in the headline.</p>
        <p className="home-pad__hint">
          The rest of your font is waiting in the <a href="/studio/">studio</a>.
        </p>
      </div>
    );
  }

  const commit = () => {
    if (!draft.length) return;
    onLetter(next, draft);
    setDraft([]);
  };

  return (
    <div className="home-pad">
      <p className="home-pad__prompt" id="home-prompt">
        Write a lowercase {next}.
      </p>
      <Pad
        strokes={draft}
        pen="fineliner"
        weight={1}
        ignoreTouch={penSeen}
        onPen={() => setPenSeen(true)}
        onStroke={(s) => setDraft((d) => [...d, s])}
        label={`Drawing area for a lowercase ${next}`}
        describedBy="home-prompt"
      />
      <div className="home-pad__actions">
        <button type="button" className="button button--quiet" disabled={!draft.length} onClick={() => setDraft((d) => d.slice(0, -1))}>
          Undo
        </button>
        <button type="button" className="button button--primary" disabled={!draft.length} onClick={commit}>
          Use this {next}
        </button>
      </div>
    </div>
  );
}
