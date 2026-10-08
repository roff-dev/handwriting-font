import type { CSSProperties } from 'react';
import { useLiveFont } from '../font';

export type PreviewFeatures = { variants: boolean; pairs: boolean; kerning: boolean };

/**
 * Text set in the live font. Anything not drawn yet is shown in the specimen serif with a dotted
 * underline, so gaps are obvious rather than silently filled by a fallback font.
 */
export function Preview({ text, size, features, className }: { text: string; size: number; features: PreviewFeatures; className?: string }) {
  const { family, chars } = useLiveFont();
  const style: CSSProperties = {
    fontFamily: family ? `"${family}", var(--font-display)` : 'var(--font-display)',
    fontSize: `${size}px`,
    fontFeatureSettings: `"calt" ${features.variants ? 1 : 0}, "liga" ${features.pairs ? 1 : 0}`,
    fontKerning: features.kerning ? 'normal' : 'none',
  };
  // Runs of drawn and undrawn characters, so shaping (pairs, variants, kerning) sees whole words.
  const runs: { text: string; missing: boolean }[] = [];
  for (const ch of text) {
    const missing = !(ch === ' ' || ch === '\n' || chars.has(ch));
    const last = runs[runs.length - 1];
    if (last && last.missing === missing) last.text += ch;
    else runs.push({ text: ch, missing });
  }
  return (
    <p className={`preview${className ? ` ${className}` : ''}`} style={style}>
      {runs.map((r, i) =>
        r.missing ? (
          <mark key={i} className="missing" title="Not drawn yet" aria-description="not drawn yet">
            {r.text}
          </mark>
        ) : (
          <span key={i}>{r.text}</span>
        ),
      )}
    </p>
  );
}
