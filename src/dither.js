// ----- Error-diffusion kernels. Offsets are [dx, dy, weight]; forward-only
// so a single scanline pass fills in downstream pixels without revisiting.
const KERNELS = {
  fs: { denom: 16, offsets: [
    [1, 0, 7],
    [-1, 1, 3], [0, 1, 5], [1, 1, 1],
  ] },
  atkinson: { denom: 8, offsets: [
    [1, 0, 1], [2, 0, 1],
    [-1, 1, 1], [0, 1, 1], [1, 1, 1],
    [0, 2, 1],
  ] },
  jjn: { denom: 48, offsets: [
    [1, 0, 7], [2, 0, 5],
    [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3],
    [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1],
  ] },
  stucki: { denom: 42, offsets: [
    [1, 0, 8], [2, 0, 4],
    [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2],
    [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1],
  ] },
  burkes: { denom: 32, offsets: [
    [1, 0, 8], [2, 0, 4],
    [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2],
  ] },
  sierra: { denom: 32, offsets: [
    [1, 0, 5], [2, 0, 3],
    [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2],
    [-1, 2, 2], [0, 2, 3], [1, 2, 2],
  ] },
  sierraLite: { denom: 4, offsets: [
    [1, 0, 2],
    [-1, 1, 1], [0, 1, 1],
  ] },
};
const ERROR_DIFFUSION_KEYS = new Set(Object.keys(KERNELS));

const BAYER4 = [
  [  0, 128,  32, 160],
  [192,  64, 224,  96],
  [ 48, 176,  16, 144],
  [240, 112, 208,  80],
];
const BAYER8 = (() => {
  const raw = [
    [ 0, 32,  8, 40,  2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44,  4, 36, 14, 46,  6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [ 3, 35, 11, 43,  1, 33,  9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47,  7, 39, 13, 45,  5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
  ];
  return raw.map(row => row.map(v => (v + 0.5) / 64 * 255));
})();

function toGrayscale(imageData, s) {
  const n = W * H;
  const gray = new Float32Array(n);
  const d = imageData.data;
  const cMul = ((s.contrast / 100) + 1) ** 2;
  for (let i = 0; i < n; i++) {
    let v = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    v = (v - 128) * cMul + 128;
    v += s.brightness;
    if (s.invert) v = 255 - v;
    gray[i] = Math.max(0, Math.min(255, v));
  }
  return gray;
}

// ----- 1-bit path
function dither1bit(gray, s) {
  const n = W * H;
  const bits = new Uint8Array(n);
  const useGamma = s.gamma;
  const threshold = useGamma ? SRGB_TO_LIN[Math.round(s.threshold)] : s.threshold;
  const midpoint = useGamma ? SRGB_TO_LIN[127] : 127;
  const buf = new Float32Array(n);
  if (useGamma) {
    for (let i = 0; i < n; i++) buf[i] = SRGB_TO_LIN[Math.round(gray[i])];
  } else {
    for (let i = 0; i < n; i++) buf[i] = gray[i];
  }
  if (s.dither === 'none') {
    for (let i = 0; i < n; i++) bits[i] = buf[i] > threshold ? 1 : 0;
    return bits;
  }
  if (s.dither === 'bayer4' || s.dither === 'bayer8' || s.dither === 'blueNoise') {
    return orderedBits(buf, s.dither, useGamma);
  }
  const kernel = KERNELS[s.dither];
  const strength = s.fsStrength / 100;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      const old = buf[idx];
      const bit = old > midpoint ? 1 : 0;
      const newVal = bit ? 255 : 0;
      const target = useGamma ? SRGB_TO_LIN[newVal] : newVal;
      bits[idx] = bit;
      const err = (old - target) * strength;
      for (const [dx, dy, w] of kernel.offsets) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny >= H) continue;
        buf[ny * W + nx] += err * w / kernel.denom;
      }
    }
  }
  return bits;
}

function orderedBits(buf, mode, useGamma) {
  const bits = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let t;
      if (mode === 'bayer4')      t = BAYER4[y & 3][x & 3];
      else if (mode === 'bayer8') t = BAYER8[y & 7][x & 7];
      else                        t = ign(x, y) * 255;
      if (useGamma) t = SRGB_TO_LIN[Math.round(t)];
      bits[y * W + x] = buf[y * W + x] > t ? 1 : 0;
    }
  }
  return bits;
}
