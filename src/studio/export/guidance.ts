export type Platform = 'iphone' | 'android' | 'mac' | 'windows' | 'other';

export function detectPlatform(ua = navigator.userAgent, touch = navigator.maxTouchPoints): Platform {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) return 'iphone';
  if (/Android/.test(ua)) return 'android';
  if (/Macintosh/.test(ua)) return 'mac';
  if (/Windows/.test(ua)) return 'windows';
  return 'other';
}

export const INSTALL: Record<Exclude<Platform, 'other'>, { title: string; steps: string }> = {
  windows: { title: 'Windows', steps: 'Right-click the .ttf file and choose Install.' },
  mac: { title: 'Mac', steps: 'Double-click the .otf file, then choose Install Font.' },
  iphone: {
    title: 'iPhone and iPad',
    steps: 'Tap Install on iPhone and allow the download. Then open Settings, tap Profile Downloaded and tap Install. Use it in Pages, Keynote and other apps with a font picker.',
  },
  android: {
    title: 'Android',
    steps: "Android can't install fonts system-wide. Use the .ttf in apps that let you import fonts, save your text as an image, or install the font on your computer.",
  },
};

export const USE_IN: { app: string; how: string }[] = [
  { app: 'Word', how: 'Pick your font from the list. To see your letter variants, tick Font ▸ Advanced ▸ Use Contextual Alternates. Joined pairs need Ligatures set to Standard or more.' },
  { app: 'Pages and Keynote', how: 'Install it first, then choose it in the Format panel.' },
  { app: 'Procreate', how: 'Add text, tap Aa, tap Import font, then choose the .ttf from Files.' },
  { app: 'Canva', how: 'Upload the .otf in Brand Kit ▸ Fonts. Canva only allows this on paid plans. On the free plan, save your text as an image.' },
  { app: 'Cricut Design Space', how: 'Install the font on this device, then pick it under the System filter. For a cut file, save your text as an SVG.' },
  { app: 'Google Docs', how: "Docs can't use your own fonts. Save your text as an image and insert it." },
  { app: 'Your website', how: 'Upload the .woff2 and .woff files, then paste this CSS.' },
];

/** The README.txt inside the zip: every install route and app, in plain text. */
export function readme(family: string): string {
  const lines = [
    `${family}`,
    'Your handwriting as a font, made with Handwriting Font Maker.',
    '',
    'INSTALL',
    ...Object.values(INSTALL).flatMap((i) => [`${i.title}: ${i.steps}`]),
    '',
    'USE IT IN',
    ...USE_IN.map((u) => `${u.app}: ${u.how}`),
    '',
    'WHAT EACH FILE IS FOR',
    '.otf  Mac, and most desktop apps',
    '.ttf  Windows, Procreate, Android apps that import fonts',
    '.woff2 and .woff  websites (see the .css file)',
    '.mobileconfig  open on an iPhone or iPad to install the font',
  ];
  return lines.join('\r\n') + '\r\n';
}
