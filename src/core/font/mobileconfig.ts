import { postScriptName, cleanFamily } from './names';

export const MOBILECONFIG_TYPE = 'application/x-apple-aspen-config';

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * An iOS/iPadOS configuration profile with one `com.apple.font` payload. Installing it from Settings makes
 * the font available to every app with a font picker (Apple: Font payload, iOS 7+, no supervision needed).
 */
export function makeMobileconfig(ttf: ArrayBuffer, family: string, uuid: () => string = () => crypto.randomUUID()): string {
  const ps = postScriptName(family);
  const id = `app.handwriting-font-maker.${ps.toLowerCase()}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>Font</key>
      <data>${base64(new Uint8Array(ttf))}</data>
      <key>Name</key>
      <string>${ps}.ttf</string>
      <key>PayloadIdentifier</key>
      <string>${id}.font</string>
      <key>PayloadType</key>
      <string>com.apple.font</string>
      <key>PayloadUUID</key>
      <string>${uuid()}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
    </dict>
  </array>
  <key>PayloadDisplayName</key>
  <string>${escapeXml(cleanFamily(family))} (font)</string>
  <key>PayloadDescription</key>
  <string>Installs the ${escapeXml(cleanFamily(family))} font, made with Handwriting Font Maker.</string>
  <key>PayloadIdentifier</key>
  <string>${id}</string>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${uuid()}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
`;
}
