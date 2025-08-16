// Optional PDF417 rendering using bwip-js. Falls back gracefully if not installed.
// Usage: await renderPdf417(doc, x, y, maxWidth, height, text)

import { createRequire } from 'module';

export async function renderPdf417(doc, x, y, maxWidth, maxHeight, text) {
  if (!text) return false;
  let bwipjs;
  try {
    // dynamic import so tests/builds pass even if dependency is missing
    const mod = await import('bwip-js');
    bwipjs = mod.default || mod;
  } catch {
    try {
      // Fallback to CommonJS require for environments where dynamic import fails
      const req = createRequire(import.meta.url);
      const mod = req('bwip-js');
      bwipjs = mod.default || mod;
    } catch {
      return false;
    }
  }
  try {
    const png = await bwipjs.toBuffer({
      bcid: 'pdf417',
      text,
      scale: 2,
      height: 8, // module height; visual size will be scaled by width below
      includecheck: true,
      eclevel: 5,
      columns: 6,
    });
    // Constrain both width and height to the available band
    const opts = { width: maxWidth, height: Math.max(8, maxHeight) };
    doc.image(png, x, y, opts);
    return true;
  } catch {
    return false;
  }
}
