function ign(x, y) {
  const v = 52.9829189 * ((0.06711056 * x + 0.00583715 * y) % 1);
  return v - Math.floor(v);
}

const SRGB_TO_LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  const l = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  SRGB_TO_LIN[i] = l * 255;
}

function rgbLinearToOklab(lr, lg, lb) {
  lr /= 255; lg /= 255; lb /= 255;
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}

const PALETTE_LIN = PALETTE_7.map(p => ({
  r: SRGB_TO_LIN[p.r], g: SRGB_TO_LIN[p.g], b: SRGB_TO_LIN[p.b],
}));
const PALETTE_LAB = PALETTE_LIN.map(p => rgbLinearToOklab(p.r, p.g, p.b));

// ----- 7-color quantization
function nearestPaletteIndexRGB(r, g, b, palette) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i];
    const dr = r - p.r, dg = g - p.g, db = b - p.b;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function nearestPaletteIndexLab(lr, lg, lb) {
  const [L, a, b] = rgbLinearToOklab(lr, lg, lb);
  let best = 0, bestD = Infinity;
  for (let i = 0; i < PALETTE_LAB.length; i++) {
    const [pL, pa, pb] = PALETTE_LAB[i];
    const dL = L - pL, da = a - pa, db_ = b - pb;
    const d = dL * dL + da * da + db_ * db_;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}
