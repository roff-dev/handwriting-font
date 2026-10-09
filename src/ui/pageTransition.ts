/**
 * Pages transition into each other (base.css, opted into in scripts/site-meta.ts), except in WebKit: there, a
 * page that builds itself with script while the transition runs can crash, and the studio did, on up to one
 * arrival in four in tests. The opt-in has to be inline CSS, which can't tell engines apart, so the page being left
 * calls the transition off instead, and in WebKit the next page just appears, as it always did.
 */
export function limitPageTransitions() {
  if (!navigator.vendor.startsWith('Apple')) return;
  addEventListener('pageswap', (e) => e.viewTransition?.skipTransition());
}
