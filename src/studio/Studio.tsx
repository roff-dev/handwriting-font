import { useState } from 'react';
import type { Stroke } from '../core/ink/strokes';
import { Pad } from '../ui/pad/Pad';
import './studio.css';

export function Studio() {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [penSeen, setPenSeen] = useState(false);
  return (
    <main className="studio">
      <h1 className="visually-hidden">Studio</h1>
      <p className="studio__prompt" id="prompt">Write a lowercase a.</p>
      <div className="studio__pad">
        <Pad
        strokes={strokes}
        pen="fineliner"
        weight={1}
        ignoreTouch={penSeen}
        onPen={() => setPenSeen(true)}
        onStroke={(s) => setStrokes((all) => [...all, s])}
        label="Drawing area for lowercase a"
        describedBy="prompt"
      />
      </div>
    </main>
  );
}
