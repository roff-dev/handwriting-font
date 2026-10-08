import type { Plugin } from 'vite';

/** The pages search engines should know about, as served paths. */
export const PUBLIC_PAGES = ['/', '/studio/', '/privacy/', '/terms/'];

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Every page carries the same set of icon, theme and social tags; they're built here from the page's own
 * <title> and description so the pages only state what's specific to them. Also emits the sitemap and
 * robots.txt, both of which need the site's absolute address.
 */
export function siteMeta(siteUrl: string): Plugin {
  const site = siteUrl.replace(/\/$/, '');
  return {
    name: 'site-meta',
    transformIndexHtml(html, ctx) {
      const path = ctx.path.replace(/index\.html$/, '');
      const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
      const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
      const tags = [
        '<link rel="icon" href="/favicon.ico" sizes="32x32" />',
        '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
        '<meta name="theme-color" content="#f4efe6" media="(prefers-color-scheme: light)" />',
        '<meta name="theme-color" content="#151412" media="(prefers-color-scheme: dark)" />',
      ];
      if (PUBLIC_PAGES.includes(path)) {
        tags.push(
          `<link rel="canonical" href="${site}${path}" />`,
          '<meta property="og:type" content="website" />',
          '<meta property="og:site_name" content="Handwriting Font Maker" />',
          `<meta property="og:title" content="${escape(title)}" />`,
          `<meta property="og:description" content="${escape(description)}" />`,
          `<meta property="og:url" content="${site}${path}" />`,
          `<meta property="og:image" content="${site}/og.png" />`,
          '<meta property="og:image:width" content="1200" />',
          '<meta property="og:image:height" content="630" />',
          '<meta property="og:image:alt" content="Your handwriting, as a real font. A writing pad asking for a lowercase a." />',
          '<meta name="twitter:card" content="summary_large_image" />',
        );
      }
      return html.replace(/\s*<\/head>/, `\n    ${tags.join('\n    ')}\n  </head>`);
    },
    generateBundle() {
      const urls = PUBLIC_PAGES.map((p) => `  <url><loc>${site}${p}</loc></url>`).join('\n');
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n` });
    },
  };
}
