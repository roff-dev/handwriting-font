# Handwriting Font Maker

![The studio with every character drawn, showing the specimen poster for the finished font](docs/screenshot.jpg)

Write each letter on your phone (or with a mouse, or on a printed template you photograph) and download a real font of your own handwriting. It spaces and kerns the letters for you, lets you draw your busiest letters up to three times so repeats take turns, and joins pairs like *th* the way you actually write them. You get OTF, TTF, WOFF2 and WOFF files, a one-tap install profile for iPhone and iPad, CSS for a website, and typed text as a PNG or SVG. Everything runs in the browser. There's no account and no server, and nothing you draw leaves your device.

## Why I built this

The tools I found for this want an account, a printer and a scanner, or an iPad app, and the free tiers stop well short of a full font. I wanted to see how far a phone browser could go on its own: from a fingertip to a font file that Word, Pages and Procreate will install, with the type engineering (spacing, kerning, contextual alternates, ligatures) done properly rather than skipped.

That meant writing most of the font file myself. `src/core/font/` writes the TrueType outlines, the GSUB and GPOS layout tables, a legacy `kern` table so older Windows apps kern too, and WOFF2 with its own Brotli stream. The exports are checked against the OpenType Sanitiser, fontTools, HarfBuzz, three browser engines and both Windows text stacks.

## Running it locally

You'll need Node 24.

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (Vitest)
npm run e2e          # builds, then runs the Playwright tests in Chromium, Firefox, WebKit and phone emulation
npm run bench        # times the outline and font-build pipeline at 1×, 4× and 6× CPU throttling
```

`npx playwright install` downloads the browsers the end-to-end tests need. `npm run build` puts the static site in `dist/`. The two settings in `.env` are the public site address (for the sitemap and social previews) and where the "Built by Kieron" link goes.

## How it's made

- **Vite** multi-page site: a static home page with one small React island, and the studio as a React app. **TypeScript** in strict mode.
- **Web Workers** (through **Comlink**) turn strokes into outlines and build the font, so drawing never waits on them.
- **perfect-freehand** draws the ink; **Clipper2** merges each letter's strokes into one clean outline; **fit-curve** fits Bézier curves, wrapped in a check that splits and refits any curve that strays from the points it replaced.
- **opentype.js** assembles the CFF outlines. The OpenType layout tables, the TrueType writer, WOFF and WOFF2 are my own code.
- **js-aruco2** finds the four markers on a photographed template, then my own homography and lighting correction straighten and flatten the page.
- **Zustand** for state, **Motion** for the studio's animation, **idb-keyval** for autosave, **fflate** for zips.
- Hosted on **Cloudflare Pages**, with Cloudflare Web Analytics (no cookies).

## Credits and licences

| What | Licence |
|---|---|
| [Instrument Serif](https://github.com/Instrument/instrument-serif), [Bricolage Grotesque](https://github.com/ateliertriay/bricolage), [Martian Mono](https://github.com/evilmartians/mono) (via Fontsource) | SIL Open Font License 1.1 |
| [React](https://react.dev), [Motion](https://motion.dev), [Zustand](https://github.com/pmndrs/zustand), [opentype.js](https://github.com/opentypejs/opentype.js), [perfect-freehand](https://github.com/steveruizok/perfect-freehand), [fit-curve](https://github.com/soswow/fit-curve), [fflate](https://github.com/101arrowz/fflate), [js-aruco2](https://github.com/damianofalcioni/js-aruco2) | MIT |
| [Comlink](https://github.com/GoogleChromeLabs/comlink), [idb-keyval](https://github.com/jakearchibald/idb-keyval), [brotli-wasm](https://github.com/httptoolkit/brotli-wasm) | Apache 2.0 |
| [Clipper2 (TypeScript port)](https://github.com/countertype/clipper2-ts) | Boost Software License 1.0 |
| Test fixtures: [Hershey fonts](https://github.com/techninja/hersheytextjs) stroke data, checked with [HarfBuzz](https://github.com/harfbuzz/harfbuzzjs) and [fontkit](https://github.com/foliojs/fontkit) | MIT |
