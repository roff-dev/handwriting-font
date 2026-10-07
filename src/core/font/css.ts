import { cleanFamily, postScriptName } from './names';

export function fontFaceCss(family: string): string {
  const ps = postScriptName(family);
  return `@font-face {
  font-family: "${cleanFamily(family)}";
  src: url("${ps}.woff2") format("woff2"), url("${ps}.woff") format("woff");
  font-display: swap;
}
`;
}
